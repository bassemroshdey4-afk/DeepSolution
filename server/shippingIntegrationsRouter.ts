import { z } from "zod";
import { router, tenantProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";

// ============================================
// Shipping Automation Add-on
// ============================================
// Paid add-on for shipping integrations:
// - API/Webhook mode
// - Sheet Import mode (CSV/Excel)
// - RPA Portal mode (n8n + Playwright)
// ============================================

// Add-on key
const ADDON_KEY = "shipping_automation";

// Integration modes
export const INTEGRATION_MODES = {
  API: "api",
  SHEET: "sheet",
  RPA: "rpa",
} as const;

export type IntegrationMode = typeof INTEGRATION_MODES[keyof typeof INTEGRATION_MODES];

// Normalized shipping statuses
const NORMALIZED_STATUSES = [
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RETURNED",
] as const;

// Default column mappings for common carriers
const DEFAULT_COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  aramex: {
    tracking_number: "AWB",
    status: "Status",
    location: "Location",
    occurred_at: "Date",
    cod_amount: "COD Amount",
    cod_collected: "COD Collected",
  },
  smsa: {
    tracking_number: "Waybill",
    status: "Activity",
    location: "City",
    occurred_at: "DateTime",
    cod_amount: "COD",
    cod_collected: "Collected",
  },
  dhl: {
    tracking_number: "Shipment ID",
    status: "Event",
    location: "Location",
    occurred_at: "Timestamp",
    cod_amount: "COD Value",
    cod_collected: "COD Status",
  },
  generic: {
    tracking_number: "tracking_number",
    status: "status",
    location: "location",
    occurred_at: "date",
    cod_amount: "cod_amount",
    cod_collected: "cod_collected",
  },
};

// ============================================
// Helper: Check and deduct usage
// ============================================
async function checkAndDeductUsage(
  tenantId: string,
  units: number = 1
): Promise<{ success: boolean; remaining: number; error?: string }> {
  // Get subscription
  const { data: subscription } = await supabaseAdmin
    .from("tenant_ai_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("addon_key", ADDON_KEY)
    .in("status", ["active", "trial"])
    .single();

  if (!subscription) {
    return { success: false, remaining: 0, error: "الإضافة غير مفعلة. يرجى تفعيل Shipping Automation أولاً." };
  }

  // Check expiry
  if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
    return { success: false, remaining: 0, error: "انتهت صلاحية الاشتراك. يرجى التجديد." };
  }

  // Check usage
  if (subscription.usage_remaining < units) {
    return { success: false, remaining: subscription.usage_remaining, error: "نفد رصيد الاستخدام. يرجى الترقية أو التجديد." };
  }

  // Deduct usage
  const { error: updateErr } = await supabaseAdmin
    .from("tenant_ai_subscriptions")
    .update({
      usage_remaining: subscription.usage_remaining - units,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (updateErr) {
    return { success: false, remaining: subscription.usage_remaining, error: "فشل في خصم الاستخدام" };
  }

  // Log usage
  await supabaseAdmin.from("ai_usage_logs").insert({
    tenant_id: tenantId,
    addon_key: ADDON_KEY,
    action: "shipping_sync",
    tokens_used: units,
    metadata: { units },
  });

  return { success: true, remaining: subscription.usage_remaining - units };
}

// ============================================
// Helper: Normalize status
// ============================================
function normalizeStatus(rawStatus: string): string {
  const lower = rawStatus.toLowerCase();
  
  if (lower.includes("delivered")) return "DELIVERED";
  if (lower.includes("return")) return "RETURNED";
  if (lower.includes("fail") || lower.includes("not delivered")) return "FAILED";
  if (lower.includes("out for delivery")) return "OUT_FOR_DELIVERY";
  if (lower.includes("transit")) return "IN_TRANSIT";
  if (lower.includes("picked") || lower.includes("pickup")) return "PICKED_UP";
  if (lower.includes("created") || lower.includes("received")) return "CREATED";
  
  return "IN_TRANSIT";
}

// ============================================
// Helper: Map shipping status to order status
// ============================================
function mapToOrderStatus(normalizedStatus: string): string | null {
  switch (normalizedStatus) {
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
}

// ============================================
// Router
// ============================================
export const shippingIntegrationsRouter = router({
  // ============================================
  // Get add-on status
  // ============================================
  getAddonStatus: tenantProcedure.query(async ({ ctx }) => {
    const { data: subscription } = await supabaseAdmin
      .from("tenant_ai_subscriptions")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("addon_key", ADDON_KEY)
      .single();

    if (!subscription) {
      return {
        isActive: false,
        status: null,
        usageRemaining: 0,
        usageLimit: 0,
        expiresAt: null,
      };
    }

    return {
      isActive: subscription.status === "active" || subscription.status === "trial",
      status: subscription.status,
      usageRemaining: subscription.usage_remaining,
      usageLimit: subscription.usage_limit,
      expiresAt: subscription.expires_at,
    };
  }),

  // ============================================
  // Activate add-on
  // ============================================
  activateAddon: tenantProcedure
    .input(z.object({
      startTrial: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if already active
      const { data: existing } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("addon_key", ADDON_KEY)
        .single();

      if (existing && (existing.status === "active" || existing.status === "trial")) {
        throw new TRPCError({ code: "CONFLICT", message: "الإضافة مفعلة بالفعل" });
      }

      // Get add-on details
      const { data: addon } = await supabaseAdmin
        .from("ai_addons")
        .select("*")
        .eq("key", ADDON_KEY)
        .single();

      if (!addon) {
        // Create the add-on if it doesn't exist
        const { data: newAddon, error: createErr } = await supabaseAdmin
          .from("ai_addons")
          .insert({
            key: ADDON_KEY,
            name: "Shipping Automation",
            name_ar: "أتمتة الشحن",
            description: "تتبع الشحنات وتحصيل COD تلقائياً",
            description_ar: "تتبع الشحنات وتحصيل COD تلقائياً من شركات الشحن",
            price_monthly: 99,
            usage_limit: 500,
            trial_days: 14,
            trial_usage_limit: 50,
            is_active: true,
          })
          .select()
          .single();

        if (createErr || !newAddon) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في إنشاء الإضافة" });
        }
      }

      // Get addon again
      const { data: addonData } = await supabaseAdmin
        .from("ai_addons")
        .select("*")
        .eq("key", ADDON_KEY)
        .single();

      if (!addonData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الإضافة غير موجودة" });
      }

      // Create subscription
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (input.startTrial ? addonData.trial_days : 30) * 24 * 60 * 60 * 1000);

      const { data: subscription, error: subErr } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .insert({
          tenant_id: ctx.tenantId,
          addon_key: ADDON_KEY,
          status: input.startTrial ? "trial" : "active",
          usage_limit: input.startTrial ? addonData.trial_usage_limit : addonData.usage_limit,
          usage_remaining: input.startTrial ? addonData.trial_usage_limit : addonData.usage_limit,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (subErr || !subscription) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في تفعيل الإضافة" });
      }

      return {
        success: true,
        status: subscription.status,
        usageRemaining: subscription.usage_remaining,
        expiresAt: subscription.expires_at,
      };
    }),

  // ============================================
  // Get carrier configs
  // ============================================
  getCarrierConfigs: tenantProcedure.query(async ({ ctx }) => {
    const { data: configs } = await supabaseAdmin
      .from("shipping_carrier_configs")
      .select("*")
      .eq("tenant_id", ctx.tenantId);

    return configs || [];
  }),

  // ============================================
  // Save carrier config
  // ============================================
  saveCarrierConfig: tenantProcedure
    .input(z.object({
      carrier: z.string(),
      mode: z.enum(["api", "sheet", "rpa"]),
      apiConfig: z.object({
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        webhookUrl: z.string().optional(),
      }).optional(),
      columnMapping: z.record(z.string(), z.string()).optional(),
      rpaConfig: z.object({
        portalUrl: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if config exists
      const { data: existing } = await supabaseAdmin
        .from("shipping_carrier_configs")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("carrier", input.carrier)
        .single();

      const configData = {
        tenant_id: ctx.tenantId,
        carrier: input.carrier,
        mode: input.mode,
        api_config: input.apiConfig || null,
        column_mapping: input.columnMapping || DEFAULT_COLUMN_MAPPINGS[input.carrier] || DEFAULT_COLUMN_MAPPINGS.generic,
        rpa_config: input.rpaConfig || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabaseAdmin
          .from("shipping_carrier_configs")
          .update(configData)
          .eq("id", existing.id);

        if (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في تحديث الإعدادات" });
        }
      } else {
        const { error } = await supabaseAdmin
          .from("shipping_carrier_configs")
          .insert(configData);

        if (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في حفظ الإعدادات" });
        }
      }

      return { success: true };
    }),

  // ============================================
  // Import from sheet (CSV/Excel)
  // ============================================
  importFromSheet: tenantProcedure
    .input(z.object({
      carrier: z.string(),
      data: z.array(z.record(z.string(), z.unknown())),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check and deduct usage (1 unit per import)
      const usageCheck = await checkAndDeductUsage(ctx.tenantId, 1);
      if (!usageCheck.success) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: usageCheck.error || "فشل في التحقق من الاستخدام" });
      }

      // Get column mapping
      const { data: config } = await supabaseAdmin
        .from("shipping_carrier_configs")
        .select("column_mapping")
        .eq("tenant_id", ctx.tenantId)
        .eq("carrier", input.carrier)
        .single();

      const mapping = (config?.column_mapping as Record<string, string>) || DEFAULT_COLUMN_MAPPINGS[input.carrier] || DEFAULT_COLUMN_MAPPINGS.generic;

      const results = {
        processed: 0,
        updated: 0,
        errors: [] as string[],
      };

      for (const row of input.data) {
        try {
          const trackingNumber = String(row[mapping.tracking_number] || "").trim();
          const rawStatus = String(row[mapping.status] || "").trim();
          const location = String(row[mapping.location] || "").trim();
          const occurredAt = row[mapping.occurred_at] ? new Date(String(row[mapping.occurred_at])).toISOString() : new Date().toISOString();
          const codAmount = row[mapping.cod_amount] ? Number(row[mapping.cod_amount]) : null;
          const codCollected = row[mapping.cod_collected] ? String(row[mapping.cod_collected]).toLowerCase() === "yes" || String(row[mapping.cod_collected]) === "1" : false;

          if (!trackingNumber || !rawStatus) {
            results.errors.push(`سطر بدون tracking_number أو status`);
            continue;
          }

          // Find shipment by tracking number
          const { data: shipment } = await supabaseAdmin
            .from("shipments")
            .select("*, orders!inner(id, tenant_id)")
            .eq("tracking_number", trackingNumber)
            .eq("tenant_id", ctx.tenantId)
            .single();

          if (!shipment) {
            results.errors.push(`لم يتم العثور على شحنة برقم: ${trackingNumber}`);
            continue;
          }

          // Normalize status
          const normalizedStatus = normalizeStatus(rawStatus);

          // Create tracking event
          const existingEvents = (shipment.tracking_events as any[]) || [];
          const newEvent = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            raw_status: rawStatus,
            normalized_status: normalizedStatus,
            carrier: input.carrier,
            location,
            source: "sheet",
            occurred_at: occurredAt,
            created_at: new Date().toISOString(),
            cod_amount: codAmount,
            cod_collected: codCollected,
          };

          const updatedEvents = [...existingEvents, newEvent];

          // Update shipment
          const updateData: Record<string, unknown> = {
            tracking_events: updatedEvents,
            status: normalizedStatus.toLowerCase(),
            updated_at: new Date().toISOString(),
          };

          if (normalizedStatus === "DELIVERED" && !shipment.delivered_at) {
            updateData.delivered_at = occurredAt;
          }

          // COD tracking
          if (codAmount !== null) {
            updateData.cod_amount = codAmount;
          }
          if (codCollected) {
            updateData.cod_collected = true;
            updateData.cod_collected_at = occurredAt;
          }

          await supabaseAdmin
            .from("shipments")
            .update(updateData)
            .eq("id", shipment.id);

          // Update order status
          const newOrderStatus = mapToOrderStatus(normalizedStatus);
          if (newOrderStatus) {
            await supabaseAdmin
              .from("orders")
              .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
              .eq("id", shipment.order_id);
          }

          results.processed++;
          results.updated++;
        } catch (e) {
          results.errors.push(`خطأ في معالجة السطر: ${String(e)}`);
        }
      }

      // Log sync
      await supabaseAdmin.from("shipping_sync_logs").insert({
        tenant_id: ctx.tenantId,
        carrier: input.carrier,
        mode: "sheet",
        records_processed: results.processed,
        records_updated: results.updated,
        errors: results.errors,
        synced_at: new Date().toISOString(),
      });

      return {
        ...results,
        usageRemaining: usageCheck.remaining,
      };
    }),

  // ============================================
  // Trigger RPA sync (stub for n8n)
  // ============================================
  triggerRpaSync: tenantProcedure
    .input(z.object({
      carrier: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check and deduct usage
      const usageCheck = await checkAndDeductUsage(ctx.tenantId, 1);
      if (!usageCheck.success) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: usageCheck.error || "فشل في التحقق من الاستخدام" });
      }

      // Get RPA config
      const { data: config } = await supabaseAdmin
        .from("shipping_carrier_configs")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("carrier", input.carrier)
        .eq("mode", "rpa")
        .single();

      if (!config) {
        throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم إعداد RPA لهذا الناقل" });
      }

      // In production, this would trigger an n8n webhook
      // For now, we log the request and return a stub response
      await supabaseAdmin.from("shipping_sync_logs").insert({
        tenant_id: ctx.tenantId,
        carrier: input.carrier,
        mode: "rpa",
        records_processed: 0,
        records_updated: 0,
        errors: [],
        status: "pending",
        synced_at: new Date().toISOString(),
      });

      return {
        success: true,
        message: "تم إرسال طلب المزامنة. سيتم تحديث البيانات قريباً.",
        usageRemaining: usageCheck.remaining,
      };
    }),

  // ============================================
  // Get sync logs
  // ============================================
  getSyncLogs: tenantProcedure
    .input(z.object({
      carrier: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("shipping_sync_logs")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .order("synced_at", { ascending: false })
        .limit(input.limit);

      if (input.carrier) {
        query = query.eq("carrier", input.carrier);
      }

      const { data } = await query;
      return data || [];
    }),

  // ============================================
  // Get default column mapping
  // ============================================
  getDefaultColumnMapping: tenantProcedure
    .input(z.object({ carrier: z.string() }))
    .query(({ input }) => {
      return DEFAULT_COLUMN_MAPPINGS[input.carrier] || DEFAULT_COLUMN_MAPPINGS.generic;
    }),
});
