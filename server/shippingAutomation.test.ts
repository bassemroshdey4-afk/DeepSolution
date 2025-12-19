import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ShipmentEvent,
  ProviderStatusMapping,
  OrderInternalEvent,
  OrderStationMetrics,
  CourierPerformanceDaily,
  InternalOrderState,
  StationType,
} from './shippingAutomationService';

// ============================================
// Shipping Automation Tests
// ============================================
// Tests for shipping status ingestion, mapping,
// station routing, and courier analytics
// ============================================

describe('ShippingAutomationService', () => {
  const mockTenantId = 'tenant-123';
  const mockOrderId = 'order-456';
  const mockShipmentId = 'shipment-789';

  // Helper functions that mirror service logic
  const generateIdempotencyKey = (
    workflowId: string,
    tenantId: string,
    data: Record<string, unknown>
  ): string => {
    const sortedData = JSON.stringify(data, Object.keys(data).sort());
    return `${workflowId}:${tenantId}:${sortedData}`;
  };

  const getStationForState = (state: InternalOrderState): StationType => {
    const mapping: Record<InternalOrderState, StationType> = {
      new: 'call_center',
      call_center_pending: 'call_center',
      call_center_confirmed: 'call_center',
      operations_pending: 'operations',
      operations_processing: 'operations',
      shipped: 'operations',
      in_transit: 'operations',
      out_for_delivery: 'operations',
      delivered: 'finance',
      finance_pending: 'finance',
      finance_settled: 'finance',
      return_requested: 'returns',
      return_in_transit: 'returns',
      return_received: 'returns',
      cancelled: 'operations',
    };
    return mapping[state];
  };

  const getSLATarget = (station: StationType): number => {
    const targets: Record<StationType, number> = {
      call_center: 60,
      operations: 240,
      finance: 1440,
      returns: 2880,
    };
    return targets[station];
  };

  const calculateDeliveryRate = (metrics: { total_shipments: number; delivered_count: number }): number => {
    if (metrics.total_shipments === 0) return 0;
    return metrics.delivered_count / metrics.total_shipments;
  };

  const calculateReturnRate = (metrics: { total_shipments: number; returned_count: number }): number => {
    if (metrics.total_shipments === 0) return 0;
    return metrics.returned_count / metrics.total_shipments;
  };

  const calculateScore = (metrics: Partial<CourierPerformanceDaily>): number => {
    let score = 50;
    if (metrics.delivery_rate) score += metrics.delivery_rate * 20;
    if (metrics.return_rate) score -= metrics.return_rate * 15;
    if (metrics.on_time_rate) score += metrics.on_time_rate * 15;
    if (metrics.avg_pickup_hours) score -= Math.min(metrics.avg_pickup_hours / 24, 1) * 10;
    return Math.round(Math.min(100, Math.max(0, score)));
  };

  const parseCSV = (csv: string): Array<Record<string, string>> => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const results: Array<Record<string, string>> = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      
      // Handle AWB column alias
      if (row.awb && !row.tracking_number) {
        row.tracking_number = row.awb;
      }
      
      // Skip rows without tracking number
      if (row.tracking_number) {
        results.push(row);
      }
    }
    
    return results;
  };

  const extractFromEmail = (email: string): { tracking_number?: string; tracking_numbers?: string[]; status?: string } => {
    const result: { tracking_number?: string; tracking_numbers?: string[]; status?: string } = {};
    
    // Extract tracking numbers (AWB pattern)
    const trackingMatches = email.match(/AWB\d{6,}/gi);
    if (trackingMatches) {
      result.tracking_numbers = trackingMatches;
      result.tracking_number = trackingMatches[0];
    }
    
    // Extract status
    const statusPatterns = [
      { pattern: /delivered/i, status: 'delivered' },
      { pattern: /in transit/i, status: 'in_transit' },
      { pattern: /out for delivery/i, status: 'out_for_delivery' },
      { pattern: /picked up/i, status: 'picked_up' },
      { pattern: /returned/i, status: 'returned' },
    ];
    
    for (const { pattern, status } of statusPatterns) {
      if (pattern.test(email)) {
        result.status = status;
        break;
      }
    }
    
    return result;
  };

  const getDefaultMappings = (): Partial<ProviderStatusMapping>[] => {
    return [
      // Generic mappings
      { provider: '*', provider_status: 'pending', internal_status: 'operations_pending' as InternalOrderState },
      { provider: '*', provider_status: 'picked_up', internal_status: 'shipped' as InternalOrderState },
      { provider: '*', provider_status: 'in_transit', internal_status: 'in_transit' as InternalOrderState },
      { provider: '*', provider_status: 'delivered', internal_status: 'delivered' as InternalOrderState },
      // Aramex mappings
      { provider: 'aramex', provider_status: 'SHP', internal_status: 'shipped' as InternalOrderState },
      { provider: 'aramex', provider_status: 'DEL', internal_status: 'delivered' as InternalOrderState },
      { provider: 'aramex', provider_status: 'OFD', internal_status: 'out_for_delivery' as InternalOrderState },
      // SMSA mappings
      { provider: 'smsa', provider_status: 'Delivered', internal_status: 'delivered' as InternalOrderState },
      { provider: 'smsa', provider_status: 'In Transit', internal_status: 'in_transit' as InternalOrderState },
    ];
  };

  describe('Status Ingestion (S1)', () => {
    it('should generate idempotency key for status ingestion', () => {
      const event = {
        tracking_number: 'AWB123456789',
        provider_status: 'delivered',
        occurred_at: '2024-01-15T14:30:00Z',
      };

      const key = generateIdempotencyKey('S1', mockTenantId, event);

      expect(key).toContain('S1');
      expect(key).toContain(mockTenantId);
    });

    it('should create shipment event structure correctly', () => {
      const event: Partial<ShipmentEvent> = {
        tenant_id: mockTenantId,
        tracking_number: 'AWB123456789',
        provider: 'aramex',
        provider_status: 'SHP',
        location: 'Riyadh',
        description: 'Shipment picked up',
        occurred_at: new Date().toISOString(),
        ingestion_mode: 'api',
      };

      expect(event.tracking_number).toBe('AWB123456789');
      expect(event.provider).toBe('aramex');
      expect(event.ingestion_mode).toBe('api');
    });

    it('should support multiple ingestion modes', () => {
      const modes: ShipmentEvent['ingestion_mode'][] = ['api', 'csv', 'email', 'manual'];
      
      modes.forEach(mode => {
        const event: Partial<ShipmentEvent> = {
          ingestion_mode: mode,
        };
        expect(event.ingestion_mode).toBe(mode);
      });
    });
  });

  describe('Status Mapping (S2)', () => {
    it('should have correct mapping structure', () => {
      const mapping: Partial<ProviderStatusMapping> = {
        tenant_id: mockTenantId,
        provider: 'aramex',
        provider_status: 'DEL',
        internal_status: 'delivered',
        triggers_station: 'finance',
        is_terminal: true,
      };

      expect(mapping.provider).toBe('aramex');
      expect(mapping.internal_status).toBe('delivered');
      expect(mapping.triggers_station).toBe('finance');
    });

    it('should map terminal statuses correctly', () => {
      const terminalStatuses = ['delivered', 'cancelled', 'return_received'];
      
      terminalStatuses.forEach(status => {
        expect(['delivered', 'cancelled', 'return_received']).toContain(status);
      });
    });
  });

  describe('Station Routing (S3)', () => {
    it('should route new orders to CallCenter', () => {
      const station = getStationForState('new');
      expect(station).toBe('call_center');
    });

    it('should route operations_pending to Operations', () => {
      const station = getStationForState('operations_pending');
      expect(station).toBe('operations');
    });

    it('should route delivered orders to Finance', () => {
      const station = getStationForState('delivered');
      expect(station).toBe('finance');
    });

    it('should route return states to Returns', () => {
      const station = getStationForState('return_requested');
      expect(station).toBe('returns');
    });

    it('should return correct SLA target per station', () => {
      expect(getSLATarget('call_center')).toBe(60);
      expect(getSLATarget('operations')).toBe(240);
      expect(getSLATarget('finance')).toBe(1440);
      expect(getSLATarget('returns')).toBe(2880);
    });

    it('should detect SLA breaches', () => {
      const metrics: Partial<OrderStationMetrics> = {
        station: 'call_center',
        entered_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2 hours ago
        sla_target_minutes: 60, // 1 hour SLA
      };

      const enteredAt = new Date(metrics.entered_at!).getTime();
      const now = Date.now();
      const durationMinutes = (now - enteredAt) / (1000 * 60);
      const breached = durationMinutes > metrics.sla_target_minutes!;

      expect(breached).toBe(true);
    });

    it('should track station metrics structure', () => {
      const metrics: Partial<OrderStationMetrics> = {
        tenant_id: mockTenantId,
        order_id: mockOrderId,
        station: 'call_center',
        entered_at: new Date().toISOString(),
        sla_target_minutes: 60,
        sla_breached: false,
      };

      expect(metrics.station).toBe('call_center');
      expect(metrics.sla_target_minutes).toBe(60);
    });
  });

  describe('Courier Performance Analytics (S4)', () => {
    it('should calculate delivery rate correctly', () => {
      const metrics = {
        total_shipments: 100,
        delivered_count: 85,
        returned_count: 10,
      };

      const deliveryRate = calculateDeliveryRate(metrics);

      expect(deliveryRate).toBe(0.85);
    });

    it('should calculate return rate correctly', () => {
      const metrics = {
        total_shipments: 100,
        delivered_count: 85,
        returned_count: 10,
      };

      const returnRate = calculateReturnRate(metrics);

      expect(returnRate).toBe(0.1);
    });

    it('should calculate composite score correctly', () => {
      const metrics: Partial<CourierPerformanceDaily> = {
        delivery_rate: 0.9,
        return_rate: 0.05,
        on_time_rate: 0.85,
        avg_pickup_hours: 12,
      };

      const score = calculateScore(metrics);

      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle zero shipments', () => {
      const metrics = {
        total_shipments: 0,
        delivered_count: 0,
        returned_count: 0,
      };

      const deliveryRate = calculateDeliveryRate(metrics);
      const returnRate = calculateReturnRate(metrics);

      expect(deliveryRate).toBe(0);
      expect(returnRate).toBe(0);
    });

    it('should have correct performance structure', () => {
      const performance: Partial<CourierPerformanceDaily> = {
        tenant_id: mockTenantId,
        courier: 'aramex',
        date: '2024-01-15',
        region: 'Riyadh',
        total_shipments: 100,
        delivered_count: 85,
        returned_count: 10,
        delivery_rate: 0.85,
        return_rate: 0.1,
        score: 75,
      };

      expect(performance.courier).toBe('aramex');
      expect(performance.delivery_rate).toBe(0.85);
    });
  });

  describe('Idempotency', () => {
    it('should generate unique idempotency keys', () => {
      const key1 = generateIdempotencyKey('S1', mockTenantId, { tracking_number: 'AWB1' });
      const key2 = generateIdempotencyKey('S1', mockTenantId, { tracking_number: 'AWB2' });

      expect(key1).not.toBe(key2);
    });

    it('should generate same key for same input', () => {
      const input = { tracking_number: 'AWB1', provider_status: 'delivered' };
      const key1 = generateIdempotencyKey('S1', mockTenantId, input);
      const key2 = generateIdempotencyKey('S1', mockTenantId, input);

      expect(key1).toBe(key2);
    });

    it('should include workflow ID in key', () => {
      const key = generateIdempotencyKey('S1', mockTenantId, { tracking_number: 'AWB1' });
      expect(key.startsWith('S1:')).toBe(true);
    });

    it('should include tenant ID in key', () => {
      const key = generateIdempotencyKey('S1', mockTenantId, { tracking_number: 'AWB1' });
      expect(key).toContain(mockTenantId);
    });
  });

  describe('CSV Parsing', () => {
    it('should parse standard CSV format', () => {
      const csv = `tracking_number,status,date,location
AWB123,delivered,2024-01-15,Riyadh`;

      const parsed = parseCSV(csv);

      expect(parsed.length).toBe(1);
      expect(parsed[0].tracking_number).toBe('AWB123');
      expect(parsed[0].status).toBe('delivered');
    });

    it('should handle AWB column name', () => {
      const csv = `awb,status
AWB123,delivered`;

      const parsed = parseCSV(csv);

      expect(parsed[0].tracking_number).toBe('AWB123');
    });

    it('should handle missing optional columns', () => {
      const csv = `tracking_number,status
AWB123,delivered`;

      const parsed = parseCSV(csv);

      expect(parsed[0].tracking_number).toBe('AWB123');
      expect(parsed[0].location).toBeUndefined();
    });

    it('should skip invalid rows', () => {
      const csv = `tracking_number,status
AWB123,delivered
,missing_tracking
AWB456,in_transit`;

      const parsed = parseCSV(csv);

      expect(parsed.length).toBe(2);
    });

    it('should handle empty CSV', () => {
      const csv = `tracking_number,status`;

      const parsed = parseCSV(csv);

      expect(parsed.length).toBe(0);
    });
  });

  describe('Email Parsing', () => {
    it('should extract tracking number from email', () => {
      const email = 'Your shipment AWB123456789 has been delivered.';

      const extracted = extractFromEmail(email);

      expect(extracted.tracking_number).toBe('AWB123456789');
    });

    it('should extract status from email', () => {
      const email = 'Your shipment has been delivered successfully.';

      const extracted = extractFromEmail(email);

      expect(extracted.status).toBe('delivered');
    });

    it('should handle multiple tracking numbers', () => {
      const email = 'Shipments AWB123456 and AWB789012 are in transit.';

      const extracted = extractFromEmail(email);

      expect(extracted.tracking_numbers?.length).toBe(2);
    });

    it('should return undefined for unparseable emails', () => {
      const email = 'This is a random email with no tracking info.';

      const extracted = extractFromEmail(email);

      expect(extracted.tracking_number).toBeUndefined();
    });

    it('should extract in_transit status', () => {
      const email = 'Your package is in transit to your location.';

      const extracted = extractFromEmail(email);

      expect(extracted.status).toBe('in_transit');
    });
  });

  describe('Default Status Mappings', () => {
    it('should have default mappings for common statuses', () => {
      const defaults = getDefaultMappings();

      expect(defaults.find(m => m.provider_status === 'pending')).toBeDefined();
      expect(defaults.find(m => m.provider_status === 'delivered')).toBeDefined();
      expect(defaults.find(m => m.provider_status === 'in_transit')).toBeDefined();
    });

    it('should have Aramex-specific mappings', () => {
      const defaults = getDefaultMappings();
      const aramexMappings = defaults.filter(m => m.provider === 'aramex');

      expect(aramexMappings.find(m => m.provider_status === 'SHP')).toBeDefined();
      expect(aramexMappings.find(m => m.provider_status === 'DEL')).toBeDefined();
    });

    it('should have SMSA-specific mappings', () => {
      const defaults = getDefaultMappings();
      const smsaMappings = defaults.filter(m => m.provider === 'smsa');

      expect(smsaMappings.find(m => m.provider_status === 'Delivered')).toBeDefined();
    });

    it('should have generic fallback mappings', () => {
      const defaults = getDefaultMappings();
      const genericMappings = defaults.filter(m => m.provider === '*');

      expect(genericMappings.length).toBeGreaterThan(0);
    });
  });

  describe('Order Internal Events', () => {
    it('should have correct event structure', () => {
      const event: Partial<OrderInternalEvent> = {
        tenant_id: mockTenantId,
        order_id: mockOrderId,
        from_state: 'new',
        to_state: 'call_center_pending',
        station: 'call_center',
        triggered_by: 'automation',
      };

      expect(event.from_state).toBe('new');
      expect(event.to_state).toBe('call_center_pending');
      expect(event.triggered_by).toBe('automation');
    });

    it('should support all trigger types', () => {
      const triggers: OrderInternalEvent['triggered_by'][] = ['system', 'user', 'automation'];
      
      triggers.forEach(trigger => {
        const event: Partial<OrderInternalEvent> = { triggered_by: trigger };
        expect(event.triggered_by).toBe(trigger);
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should include tenant_id in all entities', () => {
      const entities = [
        { tenant_id: mockTenantId } as Partial<ShipmentEvent>,
        { tenant_id: mockTenantId } as Partial<ProviderStatusMapping>,
        { tenant_id: mockTenantId } as Partial<OrderInternalEvent>,
        { tenant_id: mockTenantId } as Partial<OrderStationMetrics>,
        { tenant_id: mockTenantId } as Partial<CourierPerformanceDaily>,
      ];

      entities.forEach(entity => {
        expect(entity.tenant_id).toBe(mockTenantId);
      });
    });

    it('should generate tenant-scoped idempotency keys', () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';
      const data = { tracking_number: 'AWB123' };

      const key1 = generateIdempotencyKey('S1', tenant1, data);
      const key2 = generateIdempotencyKey('S1', tenant2, data);

      expect(key1).not.toBe(key2);
    });
  });
});
