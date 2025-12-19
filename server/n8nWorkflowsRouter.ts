import { z } from "zod";
import { router, tenantProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";
import crypto from "crypto";

// ============================================
// n8n Automation Workflows
// ============================================
// Implements 5 critical workflows with:
// - Idempotency (prevent duplicates)
// - Audit logging (every money/stock change)
// - Error handling with dead-letter queue
// ============================================

// ============================================
// Types
// ============================================
interface WorkflowResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  data?: Record<string, unknown>;
  auditLogId?: string;
}

interface AuditLogEntry {
  tenant_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value?: Record<string, unknown> | null;
  new_value: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  workflow_name?: string;
}

// ============================================
// Helper: Check idempotency
// ============================================
async function checkIdempotency(key: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("workflow_executions")
    .select("id")
    .eq("idempotency_key", key)
    .single();
  
  return !!data;
}

// ============================================
// Helper: Record workflow execution
// ============================================
async function recordExecution(
  key: string,
  workflowName: string,
  result: "success" | "failed",
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from("workflow_executions").insert({
    idempotency_key: key,
    workflow_name: workflowName,
    result,
    metadata,
    executed_at: new Date().toISOString(),
  });
}

// ============================================
// Helper: Create audit log
// ============================================
async function createAuditLog(entry: AuditLogEntry): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      ...entry,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create audit log:", error);
    throw new Error("Failed to create audit log");
  }

  return data.id;
}

// ============================================
// Helper: Log to dead letter queue
// ============================================
async function logDeadLetter(
  workflowName: string,
  triggerData: Record<string, unknown>,
  error: Error,
  retryCount: number = 0
): Promise<void> {
  await supabaseAdmin.from("n8n_dead_letters").insert({
    workflow_name: workflowName,
    trigger_data: triggerData,
    error_message: error.message,
    error_stack: error.stack || "",
    retry_count: retryCount,
    max_retries: 3,
    created_at: new Date().toISOString(),
  });
}

// ============================================
// Workflow 1: Order Created → Reserve Stock
// ============================================
async function reserveStockForOrder(
  tenantId: string,
  orderId: string
): Promise<WorkflowResult> {
  const idempotencyKey = `${orderId}:reserve`;
  const workflowName = "order-created-reserve-stock";

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already processed" };
  }

  try {
    // Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*, order_items:order_items(*)")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status !== "pending") {
      return { success: true, skipped: true, reason: `Order status is ${order.status}, not pending` };
    }

    const items = order.order_items || [];
    const reservations: Array<{ productId: string; quantity: number }> = [];

    // Reserve stock for each item
    for (const item of items) {
      const { data: product, error: productError } = await supabaseAdmin
        .from("products")
        .select("id, name, quantity, reserved_stock")
        .eq("id", item.product_id)
        .eq("tenant_id", tenantId)
        .single();

      if (productError || !product) {
        throw new Error(`Product not found: ${item.product_id}`);
      }

      const availableStock = (product.quantity || 0) - (product.reserved_stock || 0);
      if (availableStock < item.quantity) {
        // Log insufficient stock but continue
        await createAuditLog({
          tenant_id: tenantId,
          event_type: "STOCK_INSUFFICIENT",
          entity_type: "order",
          entity_id: orderId,
          action: "reserve_failed",
          new_value: {
            product_id: item.product_id,
            requested: item.quantity,
            available: availableStock,
          },
          workflow_name: workflowName,
        });
        continue;
      }

      // Update reserved stock
      const newReservedStock = (product.reserved_stock || 0) + item.quantity;
      await supabaseAdmin
        .from("products")
        .update({ reserved_stock: newReservedStock, updated_at: new Date().toISOString() })
        .eq("id", item.product_id);

      // Create stock movement
      await supabaseAdmin.from("stock_movements").insert({
        tenant_id: tenantId,
        product_id: item.product_id,
        order_id: orderId,
        type: "reserve",
        quantity: item.quantity,
        reference: `Order ${order.order_number || orderId}`,
        created_at: new Date().toISOString(),
      });

      reservations.push({ productId: item.product_id, quantity: item.quantity });
    }

    // Create audit log
    const auditLogId = await createAuditLog({
      tenant_id: tenantId,
      event_type: "STOCK_RESERVED",
      entity_type: "order",
      entity_id: orderId,
      action: "reserve",
      new_value: { reservations },
      workflow_name: workflowName,
    });

    // Record execution
    await recordExecution(idempotencyKey, workflowName, "success", { reservations });

    return { success: true, data: { reservations }, auditLogId };
  } catch (error) {
    await logDeadLetter(workflowName, { tenantId, orderId }, error as Error);
    throw error;
  }
}

// ============================================
// Workflow 2: Order Fulfilled → Deduct Stock + COGS + P&L
// ============================================
async function deductStockAndComputePnL(
  tenantId: string,
  orderId: string
): Promise<WorkflowResult> {
  const idempotencyKey = `${orderId}:deduct`;
  const workflowName = "order-fulfilled-deduct-stock";

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already processed" };
  }

  try {
    // Get order with items
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*, order_items:order_items(*)")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (!["shipped", "delivered", "fulfilled"].includes(order.status)) {
      return { success: true, skipped: true, reason: `Order status is ${order.status}, not fulfilled` };
    }

    const items = order.order_items || [];
    let totalCOGS = 0;
    const deductions: Array<{ productId: string; quantity: number; cogs: number }> = [];

    // Deduct stock for each item
    for (const item of items) {
      const { data: product, error: productError } = await supabaseAdmin
        .from("products")
        .select("id, name, quantity, reserved_stock, cost_price")
        .eq("id", item.product_id)
        .eq("tenant_id", tenantId)
        .single();

      if (productError || !product) {
        throw new Error(`Product not found: ${item.product_id}`);
      }

      // Calculate COGS
      const unitCost = product.cost_price || 0;
      const itemCOGS = unitCost * item.quantity;
      totalCOGS += itemCOGS;

      // Deduct actual stock
      const newQuantity = Math.max(0, (product.quantity || 0) - item.quantity);
      const newReservedStock = Math.max(0, (product.reserved_stock || 0) - item.quantity);

      await supabaseAdmin
        .from("products")
        .update({
          quantity: newQuantity,
          reserved_stock: newReservedStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.product_id);

      // Create stock movement
      await supabaseAdmin.from("stock_movements").insert({
        tenant_id: tenantId,
        product_id: item.product_id,
        order_id: orderId,
        type: "sale",
        quantity: -item.quantity,
        reference: `Order fulfilled ${order.order_number || orderId}`,
        created_at: new Date().toISOString(),
      });

      deductions.push({ productId: item.product_id, quantity: item.quantity, cogs: itemCOGS });
    }

    // Record COGS
    await supabaseAdmin.from("order_costs").upsert({
      order_id: orderId,
      tenant_id: tenantId,
      cogs: totalCOGS,
      updated_at: new Date().toISOString(),
    });

    // Compute P&L
    const revenue = order.total || 0;
    const shippingCost = order.shipping_cost || 0;
    const netProfit = revenue - totalCOGS - shippingCost;

    await supabaseAdmin.from("order_pnl").upsert({
      order_id: orderId,
      tenant_id: tenantId,
      revenue,
      cogs: totalCOGS,
      shipping_cost: shippingCost,
      net_profit: netProfit,
      status: "estimated",
      computed_at: new Date().toISOString(),
    });

    // Create audit logs
    await createAuditLog({
      tenant_id: tenantId,
      event_type: "STOCK_DEDUCTED",
      entity_type: "order",
      entity_id: orderId,
      action: "deduct",
      new_value: { deductions },
      workflow_name: workflowName,
    });

    await createAuditLog({
      tenant_id: tenantId,
      event_type: "COGS_RECORDED",
      entity_type: "order",
      entity_id: orderId,
      action: "record_cogs",
      new_value: { totalCOGS },
      workflow_name: workflowName,
    });

    const auditLogId = await createAuditLog({
      tenant_id: tenantId,
      event_type: "PNL_COMPUTED",
      entity_type: "order",
      entity_id: orderId,
      action: "compute_pnl",
      new_value: { revenue, cogs: totalCOGS, shippingCost, netProfit },
      workflow_name: workflowName,
    });

    // Record execution
    await recordExecution(idempotencyKey, workflowName, "success", { totalCOGS, netProfit });

    return { success: true, data: { totalCOGS, netProfit, deductions }, auditLogId };
  } catch (error) {
    await logDeadLetter(workflowName, { tenantId, orderId }, error as Error);
    throw error;
  }
}

// ============================================
// Workflow 3: Shipping Status Sync
// ============================================
async function syncShippingStatus(
  tenantId: string,
  shipmentId: string,
  newStatus: string,
  eventData: Record<string, unknown>
): Promise<WorkflowResult> {
  const eventTimestamp = eventData.occurred_at || new Date().toISOString();
  const idempotencyKey = `${shipmentId}:${newStatus}:${eventTimestamp}`;
  const workflowName = "shipping-status-sync";

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already processed" };
  }

  try {
    // Get shipment
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from("shipments")
      .select("*, orders!inner(id, tenant_id, status)")
      .eq("id", shipmentId)
      .eq("tenant_id", tenantId)
      .single();

    if (shipmentError || !shipment) {
      throw new Error(`Shipment not found: ${shipmentId}`);
    }

    const oldStatus = shipment.status;

    // Add tracking event
    const existingEvents = (shipment.tracking_events as unknown[]) || [];
    const newEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      raw_status: eventData.raw_status || newStatus,
      normalized_status: newStatus,
      carrier: eventData.carrier || shipment.carrier,
      location: eventData.location || null,
      occurred_at: eventTimestamp,
      created_at: new Date().toISOString(),
    };

    // Update shipment
    const updateData: Record<string, unknown> = {
      tracking_events: [...existingEvents, newEvent],
      status: newStatus.toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "DELIVERED" && !shipment.delivered_at) {
      updateData.delivered_at = eventTimestamp;
    }

    await supabaseAdmin
      .from("shipments")
      .update(updateData)
      .eq("id", shipmentId);

    // Update order status if needed
    const orderStatusMap: Record<string, string> = {
      PICKED_UP: "in_transit",
      IN_TRANSIT: "in_transit",
      OUT_FOR_DELIVERY: "out_for_delivery",
      DELIVERED: "delivered",
      FAILED: "failed",
      RETURNED: "returned",
    };

    const newOrderStatus = orderStatusMap[newStatus];
    if (newOrderStatus && shipment.order_id) {
      await supabaseAdmin
        .from("orders")
        .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
        .eq("id", shipment.order_id);
    }

    // Create audit log
    const auditLogId = await createAuditLog({
      tenant_id: tenantId,
      event_type: "SHIPPING_STATUS_CHANGED",
      entity_type: "shipment",
      entity_id: shipmentId,
      action: "status_update",
      old_value: { status: oldStatus },
      new_value: { status: newStatus, event: newEvent },
      workflow_name: workflowName,
    });

    // Record execution
    await recordExecution(idempotencyKey, workflowName, "success", { oldStatus, newStatus });

    return { success: true, data: { oldStatus, newStatus, orderId: shipment.order_id }, auditLogId };
  } catch (error) {
    await logDeadLetter(workflowName, { tenantId, shipmentId, newStatus, eventData }, error as Error);
    throw error;
  }
}

// ============================================
// Workflow 4: COD Settlement Sync
// ============================================
async function syncCODSettlement(
  tenantId: string,
  trackingNumber: string,
  settlementData: {
    amount: number;
    settledAt: string;
    settlementId: string;
    carrier: string;
  }
): Promise<WorkflowResult> {
  const idempotencyKey = `${settlementData.settlementId}:${trackingNumber}`;
  const workflowName = "cod-settlement-sync";

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already processed" };
  }

  try {
    // Find shipment by tracking number
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from("shipments")
      .select("*, orders!inner(id, tenant_id, total, payment_method)")
      .eq("tracking_number", trackingNumber)
      .eq("tenant_id", tenantId)
      .single();

    if (shipmentError || !shipment) {
      throw new Error(`Shipment not found for tracking: ${trackingNumber}`);
    }

    if (shipment.cod_collected) {
      return { success: true, skipped: true, reason: "COD already collected" };
    }

    // Update shipment
    await supabaseAdmin
      .from("shipments")
      .update({
        cod_collected: true,
        cod_collected_at: settlementData.settledAt,
        cod_amount: settlementData.amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipment.id);

    // Record settlement
    await supabaseAdmin.from("cod_settlements").insert({
      tenant_id: tenantId,
      shipment_id: shipment.id,
      order_id: shipment.order_id,
      tracking_number: trackingNumber,
      carrier: settlementData.carrier,
      amount: settlementData.amount,
      settlement_id: settlementData.settlementId,
      settled_at: settlementData.settledAt,
      created_at: new Date().toISOString(),
    });

    // Finalize order P&L
    await supabaseAdmin
      .from("order_pnl")
      .update({
        status: "finalized",
        finalized_at: new Date().toISOString(),
      })
      .eq("order_id", shipment.order_id);

    // Create wallet transaction for COD
    await supabaseAdmin.from("wallet_transactions").insert({
      tenant_id: tenantId,
      type: "cod_collection",
      amount: settlementData.amount,
      reference_type: "order",
      reference_id: shipment.order_id,
      description: `COD collection for order - ${trackingNumber}`,
      created_at: new Date().toISOString(),
    });

    // Create audit logs
    await createAuditLog({
      tenant_id: tenantId,
      event_type: "COD_COLLECTED",
      entity_type: "shipment",
      entity_id: shipment.id,
      action: "cod_collected",
      new_value: { amount: settlementData.amount, settlementId: settlementData.settlementId },
      workflow_name: workflowName,
    });

    const auditLogId = await createAuditLog({
      tenant_id: tenantId,
      event_type: "PROFIT_FINALIZED",
      entity_type: "order",
      entity_id: shipment.order_id,
      action: "finalize_profit",
      new_value: { codAmount: settlementData.amount },
      workflow_name: workflowName,
    });

    // Record execution
    await recordExecution(idempotencyKey, workflowName, "success", { amount: settlementData.amount });

    return { success: true, data: { orderId: shipment.order_id, amount: settlementData.amount }, auditLogId };
  } catch (error) {
    await logDeadLetter(workflowName, { tenantId, trackingNumber, settlementData }, error as Error);
    throw error;
  }
}

// ============================================
// Workflow 5: Low Stock Alert
// ============================================
async function checkLowStockAndAlert(
  tenantId: string,
  threshold: number = 10
): Promise<WorkflowResult> {
  const today = new Date().toISOString().split("T")[0];
  const idempotencyKey = `${tenantId}:low-stock:${today}`;
  const workflowName = "low-stock-alert";

  // Check idempotency (only one alert per day per tenant)
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already alerted today" };
  }

  try {
    // Get low stock products
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, quantity, reserved_stock, low_stock_threshold")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (productsError) {
      throw new Error("Failed to fetch products");
    }

    const lowStockProducts = (products || []).filter((p) => {
      const available = (p.quantity || 0) - (p.reserved_stock || 0);
      const productThreshold = p.low_stock_threshold || threshold;
      return available < productThreshold;
    });

    if (lowStockProducts.length === 0) {
      return { success: true, skipped: true, reason: "No low stock products" };
    }

    // Get tenant info for email
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name, owner_email")
      .eq("id", tenantId)
      .single();

    // Create alert record
    const alertData = {
      tenant_id: tenantId,
      products: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        available: (p.quantity || 0) - (p.reserved_stock || 0),
        threshold: p.low_stock_threshold || threshold,
      })),
      alert_date: today,
      created_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("stock_alerts").insert(alertData);

    // Create audit log
    const auditLogId = await createAuditLog({
      tenant_id: tenantId,
      event_type: "LOW_STOCK_ALERT_SENT",
      entity_type: "inventory",
      entity_id: tenantId,
      action: "alert_sent",
      new_value: {
        productCount: lowStockProducts.length,
        products: lowStockProducts.map((p) => p.id),
        recipientEmail: tenant?.owner_email,
      },
      workflow_name: workflowName,
    });

    // Record execution
    await recordExecution(idempotencyKey, workflowName, "success", {
      productCount: lowStockProducts.length,
    });

    return {
      success: true,
      data: {
        productCount: lowStockProducts.length,
        products: lowStockProducts,
        email: tenant?.owner_email,
      },
      auditLogId,
    };
  } catch (error) {
    await logDeadLetter(workflowName, { tenantId, threshold }, error as Error);
    throw error;
  }
}

// ============================================
// Router
// ============================================
export const n8nWorkflowsRouter = router({
  // Workflow 1: Reserve stock for new order
  reserveStock: tenantProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await reserveStockForOrder(ctx.tenantId, input.orderId);
    }),

  // Workflow 2: Deduct stock and compute P&L
  deductStockAndPnL: tenantProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await deductStockAndComputePnL(ctx.tenantId, input.orderId);
    }),

  // Workflow 3: Sync shipping status
  syncShippingStatus: tenantProcedure
    .input(z.object({
      shipmentId: z.string(),
      status: z.string(),
      eventData: z.object({
        raw_status: z.string().optional(),
        carrier: z.string().optional(),
        location: z.string().optional(),
        occurred_at: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await syncShippingStatus(
        ctx.tenantId,
        input.shipmentId,
        input.status,
        input.eventData || {}
      );
    }),

  // Workflow 4: Sync COD settlement
  syncCODSettlement: tenantProcedure
    .input(z.object({
      trackingNumber: z.string(),
      amount: z.number(),
      settledAt: z.string(),
      settlementId: z.string(),
      carrier: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await syncCODSettlement(ctx.tenantId, input.trackingNumber, {
        amount: input.amount,
        settledAt: input.settledAt,
        settlementId: input.settlementId,
        carrier: input.carrier,
      });
    }),

  // Workflow 5: Check low stock and alert
  checkLowStock: tenantProcedure
    .input(z.object({ threshold: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      return await checkLowStockAndAlert(ctx.tenantId, input.threshold);
    }),

  // Get workflow execution history
  getExecutionHistory: tenantProcedure
    .input(z.object({
      workflowName: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("workflow_executions")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(input.limit);

      if (input.workflowName) {
        query = query.eq("workflow_name", input.workflowName);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data || [];
    }),

  // Get dead letters
  getDeadLetters: tenantProcedure
    .input(z.object({
      resolved: z.boolean().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      let query = supabaseAdmin
        .from("n8n_dead_letters")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(input.limit);

      if (input.resolved === true) {
        query = query.not("resolved_at", "is", null);
      } else if (input.resolved === false) {
        query = query.is("resolved_at", null);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data || [];
    }),

  // Resolve dead letter
  resolveDeadLetter: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("n8n_dead_letters")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", input.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});
