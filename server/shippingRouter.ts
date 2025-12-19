import { z } from "zod";
import { router, tenantProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";

// ============================================
// Shipping Intelligence Engine
// ============================================
// Extends existing shipments table with intelligence layer
// Uses tracking_events JSONB for event history
// ============================================

// Unified shipping statuses (normalized across all carriers)
export const SHIPPING_STATUS = {
  CREATED: "CREATED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  RETURNED: "RETURNED",
} as const;

export type ShippingStatus = typeof SHIPPING_STATUS[keyof typeof SHIPPING_STATUS];

// Tracking event structure (stored in tracking_events JSONB array)
interface TrackingEvent {
  id: string;
  raw_status: string;
  normalized_status: ShippingStatus;
  carrier: string;
  location?: string;
  description?: string;
  raw_response?: Record<string, unknown>;
  source: "webhook" | "polling" | "manual";
  occurred_at: string;
  created_at: string;
}

// Carrier status mapping
const CARRIER_STATUS_MAP: Record<string, Record<string, ShippingStatus>> = {
  aramex: {
    "Shipment Created": "CREATED",
    "Picked Up": "PICKED_UP",
    "In Transit": "IN_TRANSIT",
    "Out for Delivery": "OUT_FOR_DELIVERY",
    "Delivered": "DELIVERED",
    "Delivery Failed": "FAILED",
    "Returned to Shipper": "RETURNED",
  },
  smsa: {
    "Created": "CREATED",
    "Picked": "PICKED_UP",
    "In Transit": "IN_TRANSIT",
    "Out For Delivery": "OUT_FOR_DELIVERY",
    "Delivered": "DELIVERED",
    "Not Delivered": "FAILED",
    "Returned": "RETURNED",
  },
  dhl: {
    "Shipment information received": "CREATED",
    "Picked up": "PICKED_UP",
    "In transit": "IN_TRANSIT",
    "With delivery courier": "OUT_FOR_DELIVERY",
    "Delivered": "DELIVERED",
    "Delivery attempt unsuccessful": "FAILED",
    "Returned to shipper": "RETURNED",
  },
  generic: {
    "created": "CREATED",
    "picked_up": "PICKED_UP",
    "in_transit": "IN_TRANSIT",
    "out_for_delivery": "OUT_FOR_DELIVERY",
    "delivered": "DELIVERED",
    "failed": "FAILED",
    "returned": "RETURNED",
  },
};

// Risk thresholds (in hours)
const RISK_THRESHOLDS = {
  DELAY_WARNING: 48,
  DELAY_CRITICAL: 72,
  DELIVERY_EXPECTED: 168,
};

// ============================================
// Helper: Normalize carrier status
// ============================================
function normalizeStatus(carrier: string, rawStatus: string): ShippingStatus {
  const carrierMap = CARRIER_STATUS_MAP[carrier.toLowerCase()] || CARRIER_STATUS_MAP.generic;
  
  if (carrierMap[rawStatus]) return carrierMap[rawStatus];
  
  const lowerStatus = rawStatus.toLowerCase();
  for (const [key, value] of Object.entries(carrierMap)) {
    if (key.toLowerCase() === lowerStatus) return value;
  }
  
  // Fuzzy matching
  if (lowerStatus.includes("deliver") && lowerStatus.includes("fail")) return "FAILED";
  if (lowerStatus.includes("delivered")) return "DELIVERED";
  if (lowerStatus.includes("return")) return "RETURNED";
  if (lowerStatus.includes("out for delivery")) return "OUT_FOR_DELIVERY";
  if (lowerStatus.includes("transit")) return "IN_TRANSIT";
  if (lowerStatus.includes("picked") || lowerStatus.includes("pickup")) return "PICKED_UP";
  if (lowerStatus.includes("created") || lowerStatus.includes("received")) return "CREATED";
  
  return "IN_TRANSIT";
}

// ============================================
// Helper: Map shipping status to order status
// ============================================
function mapShippingToOrderStatus(shippingStatus: ShippingStatus): string | null {
  switch (shippingStatus) {
    case "CREATED":
    case "PICKED_UP":
      return "processing";
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    case "FAILED":
      return "shipped";
    case "RETURNED":
      return "returned";
    default:
      return null;
  }
}

// ============================================
// Helper: Calculate risk level
// ============================================
function calculateRiskLevel(
  lastEventAt: Date,
  currentStatus: ShippingStatus
): { isAtRisk: boolean; riskReason: string | null; hoursSinceUpdate: number } {
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastEventAt.getTime()) / (1000 * 60 * 60);
  
  if (currentStatus === "DELIVERED" || currentStatus === "RETURNED") {
    return { isAtRisk: false, riskReason: null, hoursSinceUpdate };
  }
  
  if (currentStatus === "FAILED") {
    return { isAtRisk: true, riskReason: "delivery_failed", hoursSinceUpdate };
  }
  
  if (hoursSinceUpdate >= RISK_THRESHOLDS.DELAY_CRITICAL) {
    return { isAtRisk: true, riskReason: "critical_delay", hoursSinceUpdate };
  }
  
  if (hoursSinceUpdate >= RISK_THRESHOLDS.DELAY_WARNING) {
    return { isAtRisk: true, riskReason: "delay_warning", hoursSinceUpdate };
  }
  
  return { isAtRisk: false, riskReason: null, hoursSinceUpdate };
}

// ============================================
// Automation Hooks
// ============================================
interface AutomationEvent {
  type: "delayed_order" | "failed_delivery" | "returned_shipment";
  orderId: string;
  tenantId: string;
  shipmentId: string;
  data: Record<string, unknown>;
  triggeredAt: Date;
}

const automationEventQueue: AutomationEvent[] = [];

function triggerAutomation(event: AutomationEvent) {
  automationEventQueue.push(event);
  console.log(`[Shipping] Automation triggered: ${event.type} for order ${event.orderId}`);
}

export function getAutomationEvents(): AutomationEvent[] {
  return [...automationEventQueue];
}

export function clearAutomationEvents(): void {
  automationEventQueue.length = 0;
}

// ============================================
// Generate unique event ID
// ============================================
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Shipping Router
// ============================================
export const shippingRouter = router({
  // ============================================
  // Record shipping event (adds to tracking_events array)
  // ============================================
  recordEvent: tenantProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      carrier: z.string(),
      trackingNumber: z.string().optional(),
      rawStatus: z.string(),
      location: z.string().optional(),
      description: z.string().optional(),
      rawResponse: z.record(z.string(), z.unknown()).optional(),
      occurredAt: z.string().datetime().optional(),
      source: z.enum(["webhook", "polling", "manual"]).default("manual"),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      const { orderId, carrier, trackingNumber, rawStatus, location, description, rawResponse, occurredAt, source } = input;

      // 1. Get or create shipment for this order
      let { data: shipment, error: shipErr } = await supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("order_id", orderId)
        .eq("tenant_id", tenantId)
        .single();

      if (shipErr || !shipment) {
        // Create shipment if doesn't exist
        const { data: newShipment, error: createErr } = await supabaseAdmin
          .from("shipments")
          .insert({
            tenant_id: tenantId,
            order_id: orderId,
            tracking_number: trackingNumber || null,
            status: "pending",
            tracking_events: [],
          })
          .select()
          .single();

        if (createErr || !newShipment) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في إنشاء سجل الشحن" });
        }
        shipment = newShipment;
      }

      // 2. Normalize status
      const normalizedStatus = normalizeStatus(carrier, rawStatus);

      // 3. Create tracking event
      const newEvent: TrackingEvent = {
        id: generateEventId(),
        raw_status: rawStatus,
        normalized_status: normalizedStatus,
        carrier,
        location,
        description,
        raw_response: rawResponse,
        source,
        occurred_at: occurredAt || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // 4. Append to tracking_events array
      const existingEvents = (shipment.tracking_events as TrackingEvent[]) || [];
      const updatedEvents = [...existingEvents, newEvent];

      // 5. Update shipment
      const updateData: Record<string, unknown> = {
        tracking_events: updatedEvents,
        status: normalizedStatus.toLowerCase(),
        updated_at: new Date().toISOString(),
      };

      if (trackingNumber && !shipment.tracking_number) {
        updateData.tracking_number = trackingNumber;
      }

      if (normalizedStatus === "DELIVERED" && !shipment.delivered_at) {
        updateData.delivered_at = occurredAt || new Date().toISOString();
      }

      if ((normalizedStatus === "PICKED_UP" || normalizedStatus === "IN_TRANSIT") && !shipment.shipped_at) {
        updateData.shipped_at = occurredAt || new Date().toISOString();
      }

      const { error: updateErr } = await supabaseAdmin
        .from("shipments")
        .update(updateData)
        .eq("id", shipment.id);

      if (updateErr) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في تحديث سجل الشحن" });
      }

      // 6. Update order status
      const newOrderStatus = mapShippingToOrderStatus(normalizedStatus);
      if (newOrderStatus) {
        await supabaseAdmin
          .from("orders")
          .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("tenant_id", tenantId);
      }

      // 7. Trigger automations
      if (normalizedStatus === "FAILED") {
        triggerAutomation({
          type: "failed_delivery",
          orderId,
          tenantId,
          shipmentId: shipment.id,
          data: { carrier, trackingNumber, rawStatus },
          triggeredAt: new Date(),
        });
      }

      if (normalizedStatus === "RETURNED") {
        triggerAutomation({
          type: "returned_shipment",
          orderId,
          tenantId,
          shipmentId: shipment.id,
          data: { carrier, trackingNumber, rawStatus },
          triggeredAt: new Date(),
        });
      }

      return {
        shipmentId: shipment.id,
        eventId: newEvent.id,
        normalizedStatus,
        totalEvents: updatedEvents.length,
      };
    }),

  // ============================================
  // Webhook endpoint (public)
  // ============================================
  webhook: publicProcedure
    .input(z.object({
      carrier: z.string(),
      secret: z.string(),
      payload: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const { carrier, secret, payload } = input;

      // Validate webhook secret (stored in tenant settings)
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("id, settings")
        .eq("settings->>webhook_secret", secret)
        .single();

      if (!tenant) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid webhook secret" });
      }

      // Parse carrier-specific payload
      let orderId: string | undefined;
      let trackingNumber: string | undefined;
      let rawStatus: string | undefined;
      let location: string | undefined;

      if (carrier === "aramex") {
        orderId = payload.reference as string;
        trackingNumber = payload.waybill as string;
        rawStatus = payload.status as string;
        location = payload.location as string;
      } else if (carrier === "smsa") {
        orderId = payload.refNo as string;
        trackingNumber = payload.awb as string;
        rawStatus = payload.activity as string;
        location = payload.city as string;
      } else {
        orderId = (payload.order_id || payload.orderId || payload.reference) as string;
        trackingNumber = (payload.tracking_number || payload.trackingNumber || payload.awb) as string;
        rawStatus = (payload.status || payload.event) as string;
        location = payload.location as string;
      }

      if (!orderId || !rawStatus) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Missing required fields" });
      }

      // Get shipment
      const { data: shipment } = await supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("order_id", orderId)
        .eq("tenant_id", tenant.id)
        .single();

      if (!shipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }

      // Normalize and create event
      const normalizedStatus = normalizeStatus(carrier, rawStatus);
      const newEvent: TrackingEvent = {
        id: generateEventId(),
        raw_status: rawStatus,
        normalized_status: normalizedStatus,
        carrier,
        location,
        raw_response: payload,
        source: "webhook",
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const existingEvents = (shipment.tracking_events as TrackingEvent[]) || [];
      const updatedEvents = [...existingEvents, newEvent];

      await supabaseAdmin
        .from("shipments")
        .update({
          tracking_events: updatedEvents,
          status: normalizedStatus.toLowerCase(),
          tracking_number: trackingNumber || shipment.tracking_number,
          updated_at: new Date().toISOString(),
        })
        .eq("id", shipment.id);

      // Update order
      const newOrderStatus = mapShippingToOrderStatus(normalizedStatus);
      if (newOrderStatus) {
        await supabaseAdmin
          .from("orders")
          .update({ status: newOrderStatus })
          .eq("id", orderId);
      }

      return { success: true, eventId: newEvent.id };
    }),

  // ============================================
  // Get shipment with history
  // ============================================
  getShipment: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: shipment, error } = await supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("order_id", input.orderId)
        .eq("tenant_id", ctx.tenantId)
        .single();

      if (error || !shipment) {
        return null;
      }

      const events = (shipment.tracking_events as TrackingEvent[]) || [];
      const latestEvent = events.length > 0 ? events[events.length - 1] : null;

      let riskInfo = null;
      if (latestEvent) {
        riskInfo = calculateRiskLevel(
          new Date(latestEvent.occurred_at),
          latestEvent.normalized_status
        );
      }

      return {
        ...shipment,
        events,
        latestStatus: latestEvent?.normalized_status || null,
        riskInfo,
      };
    }),

  // ============================================
  // Get at-risk orders
  // ============================================
  getAtRiskOrders: tenantProcedure.query(async ({ ctx }) => {
    const { data: shipments } = await supabaseAdmin
      .from("shipments")
      .select(`
        *,
        orders!inner (
          id,
          order_number,
          customer_name,
          status,
          created_at
        )
      `)
      .eq("tenant_id", ctx.tenantId)
      .not("status", "in", "(delivered,returned)");

    const atRiskOrders = [];

    for (const shipment of shipments || []) {
      const events = (shipment.tracking_events as TrackingEvent[]) || [];
      
      if (events.length === 0) {
        const shipmentAge = (Date.now() - new Date(shipment.created_at).getTime()) / (1000 * 60 * 60);
        if (shipmentAge > RISK_THRESHOLDS.DELAY_WARNING) {
          atRiskOrders.push({
            shipmentId: shipment.id,
            order: shipment.orders,
            riskReason: "no_tracking_events",
            hoursSinceCreation: Math.round(shipmentAge),
          });
        }
        continue;
      }

      const latestEvent = events[events.length - 1];
      const riskInfo = calculateRiskLevel(
        new Date(latestEvent.occurred_at),
        latestEvent.normalized_status
      );

      if (riskInfo.isAtRisk) {
        atRiskOrders.push({
          shipmentId: shipment.id,
          order: shipment.orders,
          latestStatus: latestEvent.normalized_status,
          riskReason: riskInfo.riskReason,
          hoursSinceUpdate: Math.round(riskInfo.hoursSinceUpdate),
          carrier: latestEvent.carrier,
          trackingNumber: shipment.tracking_number,
        });
      }
    }

    return atRiskOrders;
  }),

  // ============================================
  // Check delays and trigger automations (for n8n/cron)
  // ============================================
  checkDelaysAndTrigger: tenantProcedure.mutation(async ({ ctx }) => {
    const { data: shipments } = await supabaseAdmin
      .from("shipments")
      .select("*, orders!inner(id, order_number)")
      .eq("tenant_id", ctx.tenantId)
      .not("status", "in", "(delivered,returned)");

    let delayedCount = 0;

    for (const shipment of shipments || []) {
      const events = (shipment.tracking_events as TrackingEvent[]) || [];
      if (events.length === 0) continue;

      const latestEvent = events[events.length - 1];
      const riskInfo = calculateRiskLevel(
        new Date(latestEvent.occurred_at),
        latestEvent.normalized_status
      );

      if (riskInfo.isAtRisk && riskInfo.riskReason?.includes("delay")) {
        triggerAutomation({
          type: "delayed_order",
          orderId: shipment.order_id,
          tenantId: ctx.tenantId,
          shipmentId: shipment.id,
          data: {
            orderNumber: (shipment.orders as any)?.order_number,
            hoursSinceUpdate: riskInfo.hoursSinceUpdate,
            currentStatus: latestEvent.normalized_status,
          },
          triggeredAt: new Date(),
        });
        delayedCount++;
      }
    }

    return { checkedShipments: shipments?.length || 0, delayedOrders: delayedCount };
  }),

  // ============================================
  // Get automation events (for n8n polling)
  // ============================================
  getAutomationEvents: tenantProcedure
    .input(z.object({
      type: z.enum(["delayed_order", "failed_delivery", "returned_shipment"]).optional(),
      since: z.string().datetime().optional(),
      clearAfterRead: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      let events = getAutomationEvents().filter(e => e.tenantId === ctx.tenantId);

      if (input.type) {
        events = events.filter(e => e.type === input.type);
      }

      if (input.since) {
        const sinceDate = new Date(input.since);
        events = events.filter(e => e.triggeredAt >= sinceDate);
      }

      if (input.clearAfterRead) {
        clearAutomationEvents();
      }

      return events;
    }),

  // ============================================
  // Bulk update (for n8n polling multiple carriers)
  // ============================================
  bulkRecordEvents: tenantProcedure
    .input(z.object({
      events: z.array(z.object({
        orderId: z.string().uuid(),
        carrier: z.string(),
        trackingNumber: z.string().optional(),
        rawStatus: z.string(),
        location: z.string().optional(),
        rawResponse: z.record(z.string(), z.unknown()).optional(),
        occurredAt: z.string().datetime().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = [];

      for (const event of input.events) {
        try {
          // Get or create shipment
          let { data: shipment } = await supabaseAdmin
            .from("shipments")
            .select("*")
            .eq("order_id", event.orderId)
            .eq("tenant_id", ctx.tenantId)
            .single();

          if (!shipment) {
            const { data: newShipment } = await supabaseAdmin
              .from("shipments")
              .insert({
                tenant_id: ctx.tenantId,
                order_id: event.orderId,
                tracking_number: event.trackingNumber,
                status: "pending",
                tracking_events: [],
              })
              .select()
              .single();
            shipment = newShipment;
          }

          if (!shipment) {
            results.push({ orderId: event.orderId, success: false, error: "Failed to create shipment" });
            continue;
          }

          const normalizedStatus = normalizeStatus(event.carrier, event.rawStatus);
          const newEvent: TrackingEvent = {
            id: generateEventId(),
            raw_status: event.rawStatus,
            normalized_status: normalizedStatus,
            carrier: event.carrier,
            location: event.location,
            raw_response: event.rawResponse,
            source: "polling",
            occurred_at: event.occurredAt || new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          const existingEvents = (shipment.tracking_events as TrackingEvent[]) || [];
          const updatedEvents = [...existingEvents, newEvent];

          await supabaseAdmin
            .from("shipments")
            .update({
              tracking_events: updatedEvents,
              status: normalizedStatus.toLowerCase(),
              tracking_number: event.trackingNumber || shipment.tracking_number,
              updated_at: new Date().toISOString(),
            })
            .eq("id", shipment.id);

          // Update order
          const newOrderStatus = mapShippingToOrderStatus(normalizedStatus);
          if (newOrderStatus) {
            await supabaseAdmin
              .from("orders")
              .update({ status: newOrderStatus })
              .eq("id", event.orderId);
          }

          results.push({ orderId: event.orderId, success: true, normalizedStatus });
        } catch (e) {
          results.push({ orderId: event.orderId, success: false, error: String(e) });
        }
      }

      return { processed: results.length, results };
    }),

  // ============================================
  // Get shipping stats
  // ============================================
  getStats: tenantProcedure.query(async ({ ctx }) => {
    const { data: shipments } = await supabaseAdmin
      .from("shipments")
      .select("status, tracking_events")
      .eq("tenant_id", ctx.tenantId);

    const stats = {
      total: 0,
      pending: 0,
      in_transit: 0,
      delivered: 0,
      failed: 0,
      returned: 0,
      at_risk: 0,
    };

    for (const shipment of shipments || []) {
      stats.total++;
      const status = shipment.status?.toLowerCase() || "pending";
      
      if (status === "pending" || status === "created") stats.pending++;
      else if (status === "in_transit" || status === "picked_up" || status === "out_for_delivery") stats.in_transit++;
      else if (status === "delivered") stats.delivered++;
      else if (status === "failed") stats.failed++;
      else if (status === "returned") stats.returned++;

      // Check if at risk
      const events = (shipment.tracking_events as TrackingEvent[]) || [];
      if (events.length > 0) {
        const latestEvent = events[events.length - 1];
        const riskInfo = calculateRiskLevel(
          new Date(latestEvent.occurred_at),
          latestEvent.normalized_status
        );
        if (riskInfo.isAtRisk) stats.at_risk++;
      }
    }

    return stats;
  }),
});
