import { z } from "zod";
import { router, tenantProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";
import crypto from "crypto";

// ============================================
// SHIPPING OPS Automation Service
// ============================================
// Handles shipping status tracking, station routing,
// and courier performance analytics
// ============================================

// ============================================
// Types & Schemas
// ============================================

// Internal order states for station routing
export type InternalOrderState = 
  | "new"
  | "call_center_pending"
  | "call_center_confirmed"
  | "operations_pending"
  | "operations_processing"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "finance_pending"
  | "finance_settled"
  | "return_requested"
  | "return_in_transit"
  | "return_received"
  | "cancelled";

// Station types for routing
export type StationType = "call_center" | "operations" | "finance" | "returns";

// Shipment event from provider
export interface ShipmentEvent {
  id: string;
  tenant_id: string;
  shipment_id: string;
  tracking_number: string;
  provider: string;
  provider_status: string;
  internal_status?: string;
  location?: string;
  description?: string;
  occurred_at: string;
  raw_data?: Record<string, unknown>;
  ingestion_mode: "api" | "csv" | "email" | "manual";
  created_at: string;
}

// Provider status mapping
export interface ProviderStatusMapping {
  id: string;
  tenant_id: string;
  provider: string;
  provider_status: string;
  internal_status: InternalOrderState;
  triggers_station?: StationType;
  is_terminal: boolean;
  created_at: string;
}

// Order internal event (station timeline)
export interface OrderInternalEvent {
  id: string;
  tenant_id: string;
  order_id: string;
  from_state?: InternalOrderState;
  to_state: InternalOrderState;
  station: StationType;
  triggered_by: "system" | "user" | "automation";
  user_id?: string;
  notes?: string;
  created_at: string;
}

// Order station metrics (SLA timers)
export interface OrderStationMetrics {
  id: string;
  tenant_id: string;
  order_id: string;
  station: StationType;
  entered_at: string;
  exited_at?: string;
  duration_minutes?: number;
  sla_target_minutes: number;
  sla_breached: boolean;
  created_at: string;
}

// Courier performance daily aggregate
export interface CourierPerformanceDaily {
  id: string;
  tenant_id: string;
  courier: string;
  date: string;
  region?: string;
  total_shipments: number;
  delivered_count: number;
  returned_count: number;
  avg_pickup_hours: number;
  avg_delivery_hours: number;
  avg_return_cycle_hours: number;
  avg_cod_remittance_hours: number;
  delivery_rate: number;
  return_rate: number;
  on_time_rate: number;
  score: number;
  recommendations?: string[];
  created_at: string;
}

// ============================================
// Default Provider Status Mappings
// ============================================
export const DEFAULT_STATUS_MAPPINGS: Array<{
  provider: string;
  provider_status: string;
  internal_status: InternalOrderState;
  triggers_station?: StationType;
  is_terminal: boolean;
}> = [
  // Generic mappings
  { provider: "*", provider_status: "pending", internal_status: "operations_pending", triggers_station: "operations", is_terminal: false },
  { provider: "*", provider_status: "picked_up", internal_status: "shipped", triggers_station: "operations", is_terminal: false },
  { provider: "*", provider_status: "in_transit", internal_status: "in_transit", is_terminal: false },
  { provider: "*", provider_status: "out_for_delivery", internal_status: "out_for_delivery", is_terminal: false },
  { provider: "*", provider_status: "delivered", internal_status: "delivered", triggers_station: "finance", is_terminal: true },
  { provider: "*", provider_status: "returned", internal_status: "return_received", triggers_station: "returns", is_terminal: true },
  { provider: "*", provider_status: "cancelled", internal_status: "cancelled", is_terminal: true },
  
  // Aramex mappings
  { provider: "aramex", provider_status: "SHP", internal_status: "shipped", is_terminal: false },
  { provider: "aramex", provider_status: "OFD", internal_status: "out_for_delivery", is_terminal: false },
  { provider: "aramex", provider_status: "DEL", internal_status: "delivered", triggers_station: "finance", is_terminal: true },
  { provider: "aramex", provider_status: "RTS", internal_status: "return_in_transit", triggers_station: "returns", is_terminal: false },
  
  // SMSA mappings
  { provider: "smsa", provider_status: "Shipped", internal_status: "shipped", is_terminal: false },
  { provider: "smsa", provider_status: "Out for Delivery", internal_status: "out_for_delivery", is_terminal: false },
  { provider: "smsa", provider_status: "Delivered", internal_status: "delivered", triggers_station: "finance", is_terminal: true },
  
  // J&T mappings
  { provider: "jnt", provider_status: "PICKUP_DONE", internal_status: "shipped", is_terminal: false },
  { provider: "jnt", provider_status: "ON_DELIVERY", internal_status: "out_for_delivery", is_terminal: false },
  { provider: "jnt", provider_status: "DELIVERED", internal_status: "delivered", triggers_station: "finance", is_terminal: true },
];

// ============================================
// Station Routing Rules
// ============================================
export const STATION_ROUTING_RULES: Record<InternalOrderState, StationType | null> = {
  new: "call_center",
  call_center_pending: "call_center",
  call_center_confirmed: "operations",
  operations_pending: "operations",
  operations_processing: "operations",
  shipped: null, // No specific station, in transit
  in_transit: null,
  out_for_delivery: null,
  delivered: "finance",
  finance_pending: "finance",
  finance_settled: null, // Completed
  return_requested: "returns",
  return_in_transit: "returns",
  return_received: "returns",
  cancelled: null, // Terminal
};

// SLA targets in minutes per station
export const SLA_TARGETS: Record<StationType, number> = {
  call_center: 60, // 1 hour to confirm
  operations: 240, // 4 hours to process
  finance: 1440, // 24 hours to settle COD
  returns: 2880, // 48 hours to process return
};

// ============================================
// Helper Functions
// ============================================

// Check idempotency
async function checkIdempotency(key: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("workflow_executions")
    .select("id")
    .eq("idempotency_key", key)
    .single();
  
  return !!data;
}

// Record workflow execution
async function recordExecution(
  workflowId: string,
  idempotencyKey: string,
  tenantId: string,
  entityId: string,
  entityType: string,
  status: "completed" | "failed" = "completed"
): Promise<void> {
  await supabaseAdmin.from("workflow_executions").insert({
    workflow_id: workflowId,
    idempotency_key: idempotencyKey,
    tenant_id: tenantId,
    entity_id: entityId,
    entity_type: entityType,
    status,
    created_at: new Date().toISOString(),
  });
}

// Create workflow audit log
async function createWorkflowAuditLog(
  workflowId: string,
  tenantId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("workflow_audit_logs")
    .insert({
      workflow_id: workflowId,
      tenant_id: tenantId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create workflow audit log:", error);
    return "";
  }

  return data?.id || "";
}

// Log to dead letter queue
async function logDeadLetter(
  workflowId: string,
  tenantId: string | null,
  payload: Record<string, unknown>,
  errorMessage: string
): Promise<void> {
  await supabaseAdmin.from("n8n_dead_letters").insert({
    workflow_id: workflowId,
    tenant_id: tenantId,
    payload,
    error_message: errorMessage,
    retry_count: 0,
    created_at: new Date().toISOString(),
  });
}

// ============================================
// S1: Shipping Status Ingestion
// ============================================
export async function ingestShippingStatus(
  tenantId: string,
  events: Array<{
    tracking_number: string;
    provider: string;
    provider_status: string;
    location?: string;
    description?: string;
    occurred_at: string;
    raw_data?: Record<string, unknown>;
  }>,
  ingestionMode: "api" | "csv" | "email" | "manual"
): Promise<{
  success: boolean;
  processed: number;
  skipped: number;
  errors: string[];
}> {
  const workflowId = "S1";
  const results = { processed: 0, skipped: 0, errors: [] as string[] };

  for (const event of events) {
    const idempotencyKey = `${workflowId}:${tenantId}:${event.tracking_number}:${event.provider_status}:${event.occurred_at}`;

    try {
      // Check idempotency
      if (await checkIdempotency(idempotencyKey)) {
        results.skipped++;
        continue;
      }

      // Find shipment by tracking number
      const { data: shipment } = await supabaseAdmin
        .from("shipments")
        .select("id, order_id")
        .eq("tenant_id", tenantId)
        .eq("tracking_number", event.tracking_number)
        .single();

      if (!shipment) {
        results.errors.push(`Shipment not found: ${event.tracking_number}`);
        continue;
      }

      // Get status mapping
      const { data: mapping } = await supabaseAdmin
        .from("provider_status_mapping")
        .select("internal_status, triggers_station, is_terminal")
        .eq("tenant_id", tenantId)
        .eq("provider", event.provider)
        .eq("provider_status", event.provider_status)
        .single();

      // Fallback to default mapping
      let internalStatus: InternalOrderState | undefined;
      let triggersStation: StationType | undefined;
      let isTerminal = false;

      if (mapping) {
        internalStatus = mapping.internal_status as InternalOrderState;
        triggersStation = mapping.triggers_station as StationType | undefined;
        isTerminal = mapping.is_terminal;
      } else {
        // Try generic mapping
        const defaultMapping = DEFAULT_STATUS_MAPPINGS.find(
          m => (m.provider === event.provider || m.provider === "*") && 
               m.provider_status.toLowerCase() === event.provider_status.toLowerCase()
        );
        if (defaultMapping) {
          internalStatus = defaultMapping.internal_status;
          triggersStation = defaultMapping.triggers_station;
          isTerminal = defaultMapping.is_terminal;
        }
      }

      // Insert shipment event
      const { data: insertedEvent, error: insertError } = await supabaseAdmin
        .from("shipment_events")
        .insert({
          tenant_id: tenantId,
          shipment_id: shipment.id,
          tracking_number: event.tracking_number,
          provider: event.provider,
          provider_status: event.provider_status,
          internal_status: internalStatus,
          location: event.location,
          description: event.description,
          occurred_at: event.occurred_at,
          raw_data: event.raw_data,
          ingestion_mode: ingestionMode,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        results.errors.push(`Failed to insert event for ${event.tracking_number}: ${insertError.message}`);
        continue;
      }

      // Update shipment status
      await supabaseAdmin
        .from("shipments")
        .update({
          status: event.provider_status,
          internal_status: internalStatus,
          last_event_at: event.occurred_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", shipment.id);

      // Record execution
      await recordExecution(workflowId, idempotencyKey, tenantId, insertedEvent?.id || "", "shipment_event");

      // Audit log
      await createWorkflowAuditLog(
        workflowId,
        tenantId,
        "SHIPMENT_STATUS_INGESTED",
        "shipment",
        shipment.id,
        {
          tracking_number: event.tracking_number,
          provider_status: event.provider_status,
          internal_status: internalStatus,
          ingestion_mode: ingestionMode,
        }
      );

      results.processed++;

      // Trigger S2 if we have internal status
      if (internalStatus && insertedEvent?.id) {
        await mapProviderToInternalStatus(tenantId, insertedEvent.id);
      }
    } catch (error) {
      results.errors.push(`Error processing ${event.tracking_number}: ${(error as Error).message}`);
      await logDeadLetter(workflowId, tenantId, { event }, (error as Error).message);
    }
  }

  return { success: results.errors.length === 0, ...results };
}

// ============================================
// S2: Provider→Internal Status Mapping
// ============================================
export async function mapProviderToInternalStatus(
  tenantId: string,
  shipmentEventId: string
): Promise<{
  success: boolean;
  orderUpdated: boolean;
  stationRouted?: StationType;
}> {
  const workflowId = "S2";
  const idempotencyKey = `${workflowId}:${tenantId}:${shipmentEventId}`;

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, orderUpdated: false };
  }

  try {
    // Get shipment event
    const { data: event, error: eventError } = await supabaseAdmin
      .from("shipment_events")
      .select("*, shipments:shipment_id(order_id)")
      .eq("id", shipmentEventId)
      .eq("tenant_id", tenantId)
      .single();

    if (eventError || !event) {
      throw new Error(`Shipment event not found: ${shipmentEventId}`);
    }

    const orderId = (event.shipments as { order_id: string } | null)?.order_id;
    if (!orderId) {
      throw new Error(`Order not found for shipment event: ${shipmentEventId}`);
    }

    // Get current order state
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, state")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .single();

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const fromState = order.state as InternalOrderState;
    const toState = event.internal_status as InternalOrderState;

    if (!toState) {
      return { success: true, orderUpdated: false };
    }

    // Update order state
    await supabaseAdmin
      .from("orders")
      .update({
        state: toState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    // Determine station
    const station = STATION_ROUTING_RULES[toState];

    // Create order internal event
    await supabaseAdmin.from("order_internal_events").insert({
      tenant_id: tenantId,
      order_id: orderId,
      from_state: fromState,
      to_state: toState,
      station: station || "operations",
      triggered_by: "automation",
      notes: `Status mapped from ${event.provider}: ${event.provider_status}`,
      created_at: new Date().toISOString(),
    });

    // Record execution
    await recordExecution(workflowId, idempotencyKey, tenantId, orderId, "order");

    // Audit log
    await createWorkflowAuditLog(
      workflowId,
      tenantId,
      "ORDER_STATUS_MAPPED",
      "order",
      orderId,
      {
        from_state: fromState,
        to_state: toState,
        station,
        shipment_event_id: shipmentEventId,
      }
    );

    // Trigger S3 for station routing
    if (station) {
      await routeToStation(tenantId, orderId, toState);
    }

    return { success: true, orderUpdated: true, stationRouted: station || undefined };
  } catch (error) {
    await logDeadLetter(workflowId, tenantId, { shipmentEventId }, (error as Error).message);
    throw error;
  }
}

// ============================================
// S3: Ops Station Routing
// ============================================
export async function routeToStation(
  tenantId: string,
  orderId: string,
  state: InternalOrderState
): Promise<{
  success: boolean;
  station?: StationType;
  metricsUpdated: boolean;
}> {
  const workflowId = "S3";
  const idempotencyKey = `${workflowId}:${tenantId}:${orderId}:${state}`;

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, metricsUpdated: false };
  }

  try {
    const station = STATION_ROUTING_RULES[state];

    if (!station) {
      // No station routing needed for this state
      return { success: true, metricsUpdated: false };
    }

    // Check if order is already in this station
    const { data: existingMetric } = await supabaseAdmin
      .from("order_station_metrics")
      .select("id, exited_at")
      .eq("tenant_id", tenantId)
      .eq("order_id", orderId)
      .eq("station", station)
      .is("exited_at", null)
      .single();

    if (existingMetric) {
      // Already in this station
      return { success: true, station, metricsUpdated: false };
    }

    // Close previous station metrics
    const { data: previousMetrics } = await supabaseAdmin
      .from("order_station_metrics")
      .select("id, station, entered_at")
      .eq("tenant_id", tenantId)
      .eq("order_id", orderId)
      .is("exited_at", null);

    if (previousMetrics?.length) {
      const now = new Date();
      for (const metric of previousMetrics) {
        const enteredAt = new Date(metric.entered_at);
        const durationMinutes = Math.round((now.getTime() - enteredAt.getTime()) / 60000);
        const slaTarget = SLA_TARGETS[metric.station as StationType];
        
        await supabaseAdmin
          .from("order_station_metrics")
          .update({
            exited_at: now.toISOString(),
            duration_minutes: durationMinutes,
            sla_breached: durationMinutes > slaTarget,
          })
          .eq("id", metric.id);
      }
    }

    // Create new station metric
    await supabaseAdmin.from("order_station_metrics").insert({
      tenant_id: tenantId,
      order_id: orderId,
      station,
      entered_at: new Date().toISOString(),
      sla_target_minutes: SLA_TARGETS[station],
      sla_breached: false,
      created_at: new Date().toISOString(),
    });

    // Update order's current station
    await supabaseAdmin
      .from("orders")
      .update({
        current_station: station,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    // Record execution
    await recordExecution(workflowId, idempotencyKey, tenantId, orderId, "order");

    // Audit log
    await createWorkflowAuditLog(
      workflowId,
      tenantId,
      "ORDER_ROUTED_TO_STATION",
      "order",
      orderId,
      { station, state }
    );

    return { success: true, station, metricsUpdated: true };
  } catch (error) {
    await logDeadLetter(workflowId, tenantId, { orderId, state }, (error as Error).message);
    throw error;
  }
}

// ============================================
// S4: Courier Performance Analytics
// ============================================
export async function computeCourierPerformance(
  tenantId: string,
  date?: string
): Promise<{
  success: boolean;
  couriersAnalyzed: number;
  recommendations: Array<{
    courier: string;
    region?: string;
    recommendation: string;
    score: number;
  }>;
}> {
  const workflowId = "S4";
  const targetDate = date || new Date().toISOString().split('T')[0];
  const idempotencyKey = `${workflowId}:${tenantId}:${targetDate}`;

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, couriersAnalyzed: 0, recommendations: [] };
  }

  try {
    // Get all shipments for the date range (last 30 days for analysis)
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data: shipments } = await supabaseAdmin
      .from("shipments")
      .select(`
        id,
        carrier,
        region,
        created_at,
        picked_up_at,
        delivered_at,
        returned_at,
        cod_amount,
        cod_settled_at,
        status
      `)
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate);

    if (!shipments?.length) {
      return { success: true, couriersAnalyzed: 0, recommendations: [] };
    }

    // Group by courier and region
    const courierStats: Record<string, {
      courier: string;
      region?: string;
      totalShipments: number;
      deliveredCount: number;
      returnedCount: number;
      pickupHours: number[];
      deliveryHours: number[];
      returnCycleHours: number[];
      codRemittanceHours: number[];
    }> = {};

    for (const shipment of shipments) {
      const key = `${shipment.carrier}:${shipment.region || "all"}`;
      
      if (!courierStats[key]) {
        courierStats[key] = {
          courier: shipment.carrier,
          region: shipment.region,
          totalShipments: 0,
          deliveredCount: 0,
          returnedCount: 0,
          pickupHours: [],
          deliveryHours: [],
          returnCycleHours: [],
          codRemittanceHours: [],
        };
      }

      const stats = courierStats[key];
      stats.totalShipments++;

      if (shipment.status === "delivered") {
        stats.deliveredCount++;
      }
      if (shipment.status === "returned") {
        stats.returnedCount++;
      }

      // Calculate time metrics
      const createdAt = new Date(shipment.created_at);
      
      if (shipment.picked_up_at) {
        const pickedUpAt = new Date(shipment.picked_up_at);
        stats.pickupHours.push((pickedUpAt.getTime() - createdAt.getTime()) / 3600000);
      }

      if (shipment.delivered_at) {
        const deliveredAt = new Date(shipment.delivered_at);
        stats.deliveryHours.push((deliveredAt.getTime() - createdAt.getTime()) / 3600000);
      }

      if (shipment.returned_at) {
        const returnedAt = new Date(shipment.returned_at);
        stats.returnCycleHours.push((returnedAt.getTime() - createdAt.getTime()) / 3600000);
      }

      if (shipment.cod_amount && shipment.cod_settled_at) {
        const settledAt = new Date(shipment.cod_settled_at);
        const deliveredAt = shipment.delivered_at ? new Date(shipment.delivered_at) : createdAt;
        stats.codRemittanceHours.push((settledAt.getTime() - deliveredAt.getTime()) / 3600000);
      }
    }

    // Calculate aggregates and store
    const recommendations: Array<{
      courier: string;
      region?: string;
      recommendation: string;
      score: number;
    }> = [];

    for (const [key, stats] of Object.entries(courierStats)) {
      const avgPickupHours = stats.pickupHours.length 
        ? stats.pickupHours.reduce((a, b) => a + b, 0) / stats.pickupHours.length 
        : 0;
      const avgDeliveryHours = stats.deliveryHours.length 
        ? stats.deliveryHours.reduce((a, b) => a + b, 0) / stats.deliveryHours.length 
        : 0;
      const avgReturnCycleHours = stats.returnCycleHours.length 
        ? stats.returnCycleHours.reduce((a, b) => a + b, 0) / stats.returnCycleHours.length 
        : 0;
      const avgCodRemittanceHours = stats.codRemittanceHours.length 
        ? stats.codRemittanceHours.reduce((a, b) => a + b, 0) / stats.codRemittanceHours.length 
        : 0;

      const deliveryRate = stats.totalShipments > 0 
        ? stats.deliveredCount / stats.totalShipments 
        : 0;
      const returnRate = stats.totalShipments > 0 
        ? stats.returnedCount / stats.totalShipments 
        : 0;

      // Calculate on-time rate (delivery within 72 hours)
      const onTimeDeliveries = stats.deliveryHours.filter(h => h <= 72).length;
      const onTimeRate = stats.deliveryHours.length > 0 
        ? onTimeDeliveries / stats.deliveryHours.length 
        : 0;

      // Calculate score (0-100)
      let score = 50; // Base score
      score += deliveryRate * 20; // Up to 20 points for delivery rate
      score -= returnRate * 15; // Lose up to 15 points for returns
      score += onTimeRate * 15; // Up to 15 points for on-time
      score -= Math.min(avgPickupHours / 24, 1) * 10; // Lose points for slow pickup
      score = Math.max(0, Math.min(100, score));

      // Generate recommendations
      const courierRecommendations: string[] = [];
      if (deliveryRate > 0.9 && returnRate < 0.1) {
        courierRecommendations.push("Excellent performance - consider as primary carrier");
      } else if (returnRate > 0.2) {
        courierRecommendations.push("High return rate - investigate delivery quality");
      }
      if (avgPickupHours > 24) {
        courierRecommendations.push("Slow pickup times - consider for non-urgent orders only");
      }
      if (avgCodRemittanceHours > 168) { // More than 7 days
        courierRecommendations.push("Slow COD remittance - monitor cash flow impact");
      }

      // Upsert daily performance
      await supabaseAdmin.from("courier_performance_daily").upsert({
        tenant_id: tenantId,
        courier: stats.courier,
        date: targetDate,
        region: stats.region,
        total_shipments: stats.totalShipments,
        delivered_count: stats.deliveredCount,
        returned_count: stats.returnedCount,
        avg_pickup_hours: Math.round(avgPickupHours * 10) / 10,
        avg_delivery_hours: Math.round(avgDeliveryHours * 10) / 10,
        avg_return_cycle_hours: Math.round(avgReturnCycleHours * 10) / 10,
        avg_cod_remittance_hours: Math.round(avgCodRemittanceHours * 10) / 10,
        delivery_rate: Math.round(deliveryRate * 1000) / 1000,
        return_rate: Math.round(returnRate * 1000) / 1000,
        on_time_rate: Math.round(onTimeRate * 1000) / 1000,
        score: Math.round(score),
        recommendations: courierRecommendations,
        created_at: new Date().toISOString(),
      }, {
        onConflict: "tenant_id,courier,date,region",
      });

      if (courierRecommendations.length > 0) {
        recommendations.push({
          courier: stats.courier,
          region: stats.region,
          recommendation: courierRecommendations[0],
          score: Math.round(score),
        });
      }
    }

    // Record execution
    await recordExecution(workflowId, idempotencyKey, tenantId, targetDate, "performance_report");

    // Audit log
    await createWorkflowAuditLog(
      workflowId,
      tenantId,
      "COURIER_PERFORMANCE_COMPUTED",
      "performance_report",
      targetDate,
      {
        couriers_analyzed: Object.keys(courierStats).length,
        recommendations_count: recommendations.length,
      }
    );

    return {
      success: true,
      couriersAnalyzed: Object.keys(courierStats).length,
      recommendations,
    };
  } catch (error) {
    await logDeadLetter(workflowId, tenantId, { date: targetDate }, (error as Error).message);
    throw error;
  }
}

// ============================================
// CSV Ingestion Helper
// ============================================
export function parseShippingCSV(
  csvContent: string,
  provider: string
): Array<{
  tracking_number: string;
  provider: string;
  provider_status: string;
  location?: string;
  description?: string;
  occurred_at: string;
}> {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const events: Array<{
    tracking_number: string;
    provider: string;
    provider_status: string;
    location?: string;
    description?: string;
    occurred_at: string;
  }> = [];

  // Find column indices
  const trackingIdx = headers.findIndex(h => 
    h.includes('tracking') || h.includes('awb') || h.includes('waybill')
  );
  const statusIdx = headers.findIndex(h => 
    h.includes('status') || h.includes('state')
  );
  const dateIdx = headers.findIndex(h => 
    h.includes('date') || h.includes('time') || h.includes('timestamp')
  );
  const locationIdx = headers.findIndex(h => 
    h.includes('location') || h.includes('city')
  );
  const descIdx = headers.findIndex(h => 
    h.includes('description') || h.includes('remark') || h.includes('note')
  );

  if (trackingIdx === -1 || statusIdx === -1) {
    throw new Error("CSV must have tracking_number and status columns");
  }

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < 2) continue;

    const trackingNumber = values[trackingIdx];
    const status = values[statusIdx];
    
    if (!trackingNumber || !status) continue;

    events.push({
      tracking_number: trackingNumber,
      provider,
      provider_status: status,
      location: locationIdx !== -1 ? values[locationIdx] : undefined,
      description: descIdx !== -1 ? values[descIdx] : undefined,
      occurred_at: dateIdx !== -1 && values[dateIdx] 
        ? new Date(values[dateIdx]).toISOString() 
        : new Date().toISOString(),
    });
  }

  return events;
}

// ============================================
// Email Parsing Helper
// ============================================
export function parseShippingEmail(
  emailContent: string,
  provider: string
): Array<{
  tracking_number: string;
  provider: string;
  provider_status: string;
  description?: string;
  occurred_at: string;
}> {
  const events: Array<{
    tracking_number: string;
    provider: string;
    provider_status: string;
    description?: string;
    occurred_at: string;
  }> = [];

  // Common patterns for tracking numbers
  const trackingPatterns = [
    /(?:tracking|awb|waybill)[:\s#]*([A-Z0-9]{8,20})/gi,
    /(?:shipment|order)[:\s#]*([A-Z0-9]{8,20})/gi,
  ];

  // Common status patterns
  const statusPatterns = [
    { pattern: /delivered/i, status: "delivered" },
    { pattern: /out for delivery/i, status: "out_for_delivery" },
    { pattern: /in transit/i, status: "in_transit" },
    { pattern: /picked up/i, status: "picked_up" },
    { pattern: /return/i, status: "returned" },
    { pattern: /failed delivery/i, status: "delivery_failed" },
  ];

  // Extract tracking numbers
  const trackingNumbers: string[] = [];
  for (const pattern of trackingPatterns) {
    const matches = Array.from(emailContent.matchAll(pattern));
    for (const match of matches) {
      if (match[1] && !trackingNumbers.includes(match[1])) {
        trackingNumbers.push(match[1]);
      }
    }
  }

  // Detect status
  let detectedStatus = "unknown";
  for (const { pattern, status } of statusPatterns) {
    if (pattern.test(emailContent)) {
      detectedStatus = status;
      break;
    }
  }

  // Create events for each tracking number
  for (const trackingNumber of trackingNumbers) {
    events.push({
      tracking_number: trackingNumber,
      provider,
      provider_status: detectedStatus,
      description: emailContent.substring(0, 200),
      occurred_at: new Date().toISOString(),
    });
  }

  return events;
}

// ============================================
// Get Orders by Station (for UI queues)
// ============================================
export async function getOrdersByStation(
  tenantId: string,
  station: StationType,
  options?: {
    limit?: number;
    offset?: number;
    includeBreached?: boolean;
  }
): Promise<{
  orders: Array<{
    id: string;
    order_number: string;
    state: InternalOrderState;
    customer_name: string;
    total: number;
    entered_station_at: string;
    sla_remaining_minutes: number;
    sla_breached: boolean;
  }>;
  total: number;
  breachedCount: number;
}> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  // Get orders currently in this station
  let query = supabaseAdmin
    .from("orders")
    .select(`
      id,
      order_number,
      state,
      customer_name,
      total,
      current_station,
      order_station_metrics!inner(
        entered_at,
        sla_target_minutes,
        sla_breached
      )
    `, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("current_station", station)
    .is("order_station_metrics.exited_at", null)
    .order("order_station_metrics.entered_at", { ascending: true })
    .range(offset, offset + limit - 1);

  const { data: orders, count, error } = await query;

  if (error) {
    throw new Error(`Failed to get orders: ${error.message}`);
  }

  const now = new Date();
  const result = (orders || []).map(order => {
    const metrics = order.order_station_metrics as unknown as Array<{
      entered_at: string;
      sla_target_minutes: number;
      sla_breached: boolean;
    }>;
    const metric = metrics?.[0];
    const enteredAt = metric ? new Date(metric.entered_at) : now;
    const elapsedMinutes = Math.round((now.getTime() - enteredAt.getTime()) / 60000);
    const slaTarget = metric?.sla_target_minutes || SLA_TARGETS[station];
    const slaRemainingMinutes = slaTarget - elapsedMinutes;

    return {
      id: order.id,
      order_number: order.order_number,
      state: order.state as InternalOrderState,
      customer_name: order.customer_name,
      total: order.total,
      entered_station_at: metric?.entered_at || now.toISOString(),
      sla_remaining_minutes: slaRemainingMinutes,
      sla_breached: metric?.sla_breached || slaRemainingMinutes < 0,
    };
  });

  const breachedCount = result.filter(o => o.sla_breached).length;

  return {
    orders: result,
    total: count || 0,
    breachedCount,
  };
}

// ============================================
// Router
// ============================================
export const shippingAutomationRouter = router({
  // S1: Ingest shipping status (API/CSV/Email)
  ingestStatus: tenantProcedure
    .input(z.object({
      events: z.array(z.object({
        tracking_number: z.string(),
        provider: z.string(),
        provider_status: z.string(),
        location: z.string().optional(),
        description: z.string().optional(),
        occurred_at: z.string(),
        raw_data: z.record(z.string(), z.unknown()).optional(),
      })),
      ingestion_mode: z.enum(["api", "csv", "email", "manual"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ingestShippingStatus(ctx.tenantId, input.events, input.ingestion_mode);
    }),

  // S1: Ingest from CSV
  ingestFromCSV: tenantProcedure
    .input(z.object({
      csv_content: z.string(),
      provider: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const events = parseShippingCSV(input.csv_content, input.provider);
      return await ingestShippingStatus(ctx.tenantId, events, "csv");
    }),

  // S1: Ingest from Email
  ingestFromEmail: tenantProcedure
    .input(z.object({
      email_content: z.string(),
      provider: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const events = parseShippingEmail(input.email_content, input.provider);
      return await ingestShippingStatus(ctx.tenantId, events, "email");
    }),

  // S2: Map provider status (triggered internally)
  mapStatus: tenantProcedure
    .input(z.object({
      shipment_event_id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await mapProviderToInternalStatus(ctx.tenantId, input.shipment_event_id);
    }),

  // S3: Route to station (triggered internally)
  routeToStation: tenantProcedure
    .input(z.object({
      order_id: z.string(),
      state: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await routeToStation(ctx.tenantId, input.order_id, input.state as InternalOrderState);
    }),

  // S4: Compute courier performance
  computePerformance: tenantProcedure
    .input(z.object({
      date: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await computeCourierPerformance(ctx.tenantId, input.date);
    }),

  // Get orders by station (for UI queues)
  getOrdersByStation: tenantProcedure
    .input(z.object({
      station: z.enum(["call_center", "operations", "finance", "returns"]),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      return await getOrdersByStation(ctx.tenantId, input.station, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // Get station metrics summary
  getStationMetrics: tenantProcedure
    .query(async ({ ctx }) => {
      const stations: StationType[] = ["call_center", "operations", "finance", "returns"];
      const metrics: Record<StationType, { count: number; breached: number; avgWaitMinutes: number }> = {
        call_center: { count: 0, breached: 0, avgWaitMinutes: 0 },
        operations: { count: 0, breached: 0, avgWaitMinutes: 0 },
        finance: { count: 0, breached: 0, avgWaitMinutes: 0 },
        returns: { count: 0, breached: 0, avgWaitMinutes: 0 },
      };

      for (const station of stations) {
        const result = await getOrdersByStation(ctx.tenantId, station, { limit: 1000 });
        metrics[station].count = result.total;
        metrics[station].breached = result.breachedCount;
        
        if (result.orders.length > 0) {
          const totalWait = result.orders.reduce((sum, o) => {
            const slaTarget = SLA_TARGETS[station];
            return sum + (slaTarget - o.sla_remaining_minutes);
          }, 0);
          metrics[station].avgWaitMinutes = Math.round(totalWait / result.orders.length);
        }
      }

      return metrics;
    }),

  // Get courier performance
  getCourierPerformance: tenantProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
      courier: z.string().optional(),
      region: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let query = supabaseAdmin
        .from("courier_performance_daily")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .gte("date", startDate)
        .order("date", { ascending: false });

      if (input.courier) {
        query = query.eq("courier", input.courier);
      }
      if (input.region) {
        query = query.eq("region", input.region);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data || [];
    }),

  // Get provider status mappings
  getStatusMappings: tenantProcedure
    .input(z.object({
      provider: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("provider_status_mapping")
        .select("*")
        .eq("tenant_id", ctx.tenantId);

      if (input.provider) {
        query = query.eq("provider", input.provider);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      
      // Include default mappings
      const tenantMappings = data || [];
      const defaultMappings = DEFAULT_STATUS_MAPPINGS.map(m => ({
        ...m,
        id: `default:${m.provider}:${m.provider_status}`,
        tenant_id: ctx.tenantId,
        is_default: true,
        created_at: new Date().toISOString(),
      }));

      return [...tenantMappings, ...defaultMappings];
    }),

  // Create/update status mapping
  upsertStatusMapping: tenantProcedure
    .input(z.object({
      provider: z.string(),
      provider_status: z.string(),
      internal_status: z.string(),
      triggers_station: z.enum(["call_center", "operations", "finance", "returns"]).optional(),
      is_terminal: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await supabaseAdmin
        .from("provider_status_mapping")
        .upsert({
          tenant_id: ctx.tenantId,
          provider: input.provider,
          provider_status: input.provider_status,
          internal_status: input.internal_status,
          triggers_station: input.triggers_station,
          is_terminal: input.is_terminal,
          created_at: new Date().toISOString(),
        }, {
          onConflict: "tenant_id,provider,provider_status",
        })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),
});
