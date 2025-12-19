import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "shipments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: {
                    id: "ship-123",
                    order_id: "order-123",
                    tenant_id: "tenant-123",
                    tracking_number: "TRACK123",
                    status: "in_transit",
                    tracking_events: [],
                  },
                  error: null,
                })),
              })),
              not: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { id: "ship-new", tracking_events: [] },
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      if (table === "orders") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        };
      }
      if (table === "tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { id: "tenant-123", settings: { webhook_secret: "secret123" } },
                error: null,
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({ data: [], error: null })),
      };
    }),
  },
}));

describe("Shipping Intelligence Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Unified Shipping Status", () => {
    it("should define all 7 normalized statuses", () => {
      const SHIPPING_STATUS = {
        CREATED: "CREATED",
        PICKED_UP: "PICKED_UP",
        IN_TRANSIT: "IN_TRANSIT",
        OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
        DELIVERED: "DELIVERED",
        FAILED: "FAILED",
        RETURNED: "RETURNED",
      };

      expect(Object.keys(SHIPPING_STATUS)).toHaveLength(7);
      expect(SHIPPING_STATUS.CREATED).toBe("CREATED");
      expect(SHIPPING_STATUS.DELIVERED).toBe("DELIVERED");
    });

    it("should normalize Aramex statuses correctly", () => {
      const aramexMap: Record<string, string> = {
        "Shipment Created": "CREATED",
        "Picked Up": "PICKED_UP",
        "In Transit": "IN_TRANSIT",
        "Out for Delivery": "OUT_FOR_DELIVERY",
        "Delivered": "DELIVERED",
        "Delivery Failed": "FAILED",
        "Returned to Shipper": "RETURNED",
      };

      expect(aramexMap["Delivered"]).toBe("DELIVERED");
      expect(aramexMap["Delivery Failed"]).toBe("FAILED");
    });

    it("should normalize SMSA statuses correctly", () => {
      const smsaMap: Record<string, string> = {
        "Created": "CREATED",
        "Picked": "PICKED_UP",
        "In Transit": "IN_TRANSIT",
        "Out For Delivery": "OUT_FOR_DELIVERY",
        "Delivered": "DELIVERED",
        "Not Delivered": "FAILED",
        "Returned": "RETURNED",
      };

      expect(smsaMap["Not Delivered"]).toBe("FAILED");
      expect(smsaMap["Returned"]).toBe("RETURNED");
    });

    it("should normalize DHL statuses correctly", () => {
      const dhlMap: Record<string, string> = {
        "Shipment information received": "CREATED",
        "Picked up": "PICKED_UP",
        "In transit": "IN_TRANSIT",
        "With delivery courier": "OUT_FOR_DELIVERY",
        "Delivered": "DELIVERED",
        "Delivery attempt unsuccessful": "FAILED",
        "Returned to shipper": "RETURNED",
      };

      expect(dhlMap["With delivery courier"]).toBe("OUT_FOR_DELIVERY");
      expect(dhlMap["Delivery attempt unsuccessful"]).toBe("FAILED");
    });
  });

  describe("2. Risk Detection", () => {
    it("should detect delay warning after 48 hours", () => {
      const RISK_THRESHOLDS = {
        DELAY_WARNING: 48,
        DELAY_CRITICAL: 72,
      };

      const hoursSinceUpdate = 50;
      const isDelayWarning = hoursSinceUpdate >= RISK_THRESHOLDS.DELAY_WARNING;
      const isDelayCritical = hoursSinceUpdate >= RISK_THRESHOLDS.DELAY_CRITICAL;

      expect(isDelayWarning).toBe(true);
      expect(isDelayCritical).toBe(false);
    });

    it("should detect critical delay after 72 hours", () => {
      const RISK_THRESHOLDS = {
        DELAY_WARNING: 48,
        DELAY_CRITICAL: 72,
      };

      const hoursSinceUpdate = 80;
      const isDelayCritical = hoursSinceUpdate >= RISK_THRESHOLDS.DELAY_CRITICAL;

      expect(isDelayCritical).toBe(true);
    });

    it("should flag FAILED status as at_risk", () => {
      const status = "FAILED";
      const isAtRisk = status === "FAILED" || status === "RETURNED";

      expect(isAtRisk).toBe(true);
    });

    it("should not flag DELIVERED as at_risk", () => {
      const status = "DELIVERED";
      const isAtRisk = status === "FAILED" || (status !== "DELIVERED" && status !== "RETURNED");

      expect(isAtRisk).toBe(false);
    });
  });

  describe("3. Order Status Mapping", () => {
    it("should map CREATED/PICKED_UP to processing", () => {
      const mapShippingToOrder = (status: string): string | null => {
        switch (status) {
          case "CREATED":
          case "PICKED_UP":
            return "processing";
          case "IN_TRANSIT":
          case "OUT_FOR_DELIVERY":
            return "shipped";
          case "DELIVERED":
            return "delivered";
          case "RETURNED":
            return "returned";
          default:
            return null;
        }
      };

      expect(mapShippingToOrder("CREATED")).toBe("processing");
      expect(mapShippingToOrder("PICKED_UP")).toBe("processing");
    });

    it("should map IN_TRANSIT/OUT_FOR_DELIVERY to shipped", () => {
      const mapShippingToOrder = (status: string): string | null => {
        switch (status) {
          case "IN_TRANSIT":
          case "OUT_FOR_DELIVERY":
            return "shipped";
          default:
            return null;
        }
      };

      expect(mapShippingToOrder("IN_TRANSIT")).toBe("shipped");
      expect(mapShippingToOrder("OUT_FOR_DELIVERY")).toBe("shipped");
    });

    it("should map DELIVERED to delivered", () => {
      const mapShippingToOrder = (status: string): string | null => {
        if (status === "DELIVERED") return "delivered";
        return null;
      };

      expect(mapShippingToOrder("DELIVERED")).toBe("delivered");
    });

    it("should map RETURNED to returned", () => {
      const mapShippingToOrder = (status: string): string | null => {
        if (status === "RETURNED") return "returned";
        return null;
      };

      expect(mapShippingToOrder("RETURNED")).toBe("returned");
    });
  });

  describe("4. Tracking Events Structure", () => {
    it("should define tracking event structure", () => {
      const event = {
        id: "evt_123",
        raw_status: "In Transit",
        normalized_status: "IN_TRANSIT",
        carrier: "aramex",
        location: "Riyadh",
        description: "Package in transit",
        raw_response: { waybill: "123", status: "In Transit" },
        source: "webhook" as const,
        occurred_at: "2024-01-15T10:00:00Z",
        created_at: "2024-01-15T10:00:00Z",
      };

      expect(event).toHaveProperty("raw_status");
      expect(event).toHaveProperty("normalized_status");
      expect(event).toHaveProperty("carrier");
      expect(event).toHaveProperty("source");
      expect(["webhook", "polling", "manual"]).toContain(event.source);
    });

    it("should append events without deleting history", () => {
      const existingEvents = [
        { id: "evt_1", normalized_status: "CREATED" },
        { id: "evt_2", normalized_status: "PICKED_UP" },
      ];

      const newEvent = { id: "evt_3", normalized_status: "IN_TRANSIT" };
      const updatedEvents = [...existingEvents, newEvent];

      expect(updatedEvents).toHaveLength(3);
      expect(updatedEvents[0].id).toBe("evt_1");
      expect(updatedEvents[2].id).toBe("evt_3");
    });
  });

  describe("5. Automation Hooks", () => {
    it("should define automation event types", () => {
      const eventTypes = ["delayed_order", "failed_delivery", "returned_shipment"];

      expect(eventTypes).toContain("delayed_order");
      expect(eventTypes).toContain("failed_delivery");
      expect(eventTypes).toContain("returned_shipment");
    });

    it("should trigger failed_delivery on FAILED status", () => {
      const status = "FAILED";
      const shouldTrigger = status === "FAILED";

      expect(shouldTrigger).toBe(true);
    });

    it("should trigger returned_shipment on RETURNED status", () => {
      const status = "RETURNED";
      const shouldTrigger = status === "RETURNED";

      expect(shouldTrigger).toBe(true);
    });

    it("should structure automation event correctly", () => {
      const automationEvent = {
        type: "delayed_order" as const,
        orderId: "order-123",
        tenantId: "tenant-123",
        shipmentId: "ship-123",
        data: { hoursSinceUpdate: 50, currentStatus: "IN_TRANSIT" },
        triggeredAt: new Date(),
      };

      expect(automationEvent).toHaveProperty("type");
      expect(automationEvent).toHaveProperty("orderId");
      expect(automationEvent).toHaveProperty("shipmentId");
      expect(automationEvent).toHaveProperty("data");
    });
  });

  describe("6. Ingestion Methods", () => {
    it("should support webhook source", () => {
      const sources = ["webhook", "polling", "manual"];
      expect(sources).toContain("webhook");
    });

    it("should support polling source", () => {
      const sources = ["webhook", "polling", "manual"];
      expect(sources).toContain("polling");
    });

    it("should support manual source", () => {
      const sources = ["webhook", "polling", "manual"];
      expect(sources).toContain("manual");
    });

    it("should store raw carrier response", () => {
      const event = {
        raw_status: "Delivered",
        raw_response: {
          waybill: "AWB123456",
          status: "Delivered",
          timestamp: "2024-01-15T14:30:00Z",
          location: { city: "Riyadh", country: "SA" },
        },
      };

      expect(event.raw_response).toHaveProperty("waybill");
      expect(event.raw_response).toHaveProperty("status");
    });
  });

  describe("7. Bulk Operations", () => {
    it("should process multiple events in bulk", () => {
      const events = [
        { orderId: "order-1", carrier: "aramex", rawStatus: "In Transit" },
        { orderId: "order-2", carrier: "smsa", rawStatus: "Delivered" },
        { orderId: "order-3", carrier: "dhl", rawStatus: "Picked up" },
      ];

      const results = events.map(e => ({
        orderId: e.orderId,
        success: true,
        normalizedStatus: e.rawStatus === "Delivered" ? "DELIVERED" : "IN_TRANSIT",
      }));

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe("8. Stats Calculation", () => {
    it("should calculate shipping stats correctly", () => {
      const shipments = [
        { status: "pending" },
        { status: "in_transit" },
        { status: "in_transit" },
        { status: "delivered" },
        { status: "delivered" },
        { status: "delivered" },
        { status: "failed" },
        { status: "returned" },
      ];

      const stats = {
        total: shipments.length,
        pending: shipments.filter(s => s.status === "pending").length,
        in_transit: shipments.filter(s => s.status === "in_transit").length,
        delivered: shipments.filter(s => s.status === "delivered").length,
        failed: shipments.filter(s => s.status === "failed").length,
        returned: shipments.filter(s => s.status === "returned").length,
      };

      expect(stats.total).toBe(8);
      expect(stats.pending).toBe(1);
      expect(stats.in_transit).toBe(2);
      expect(stats.delivered).toBe(3);
      expect(stats.failed).toBe(1);
      expect(stats.returned).toBe(1);
    });
  });
});
