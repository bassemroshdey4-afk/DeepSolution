import { z } from "zod";
import { router, tenantProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";

// ============================================
// Profit Intelligence Engine
// ============================================
// Per-order P&L + Product & Time Analytics
// ============================================

// ============================================
// Types
// ============================================
interface OrderCosts {
  orderId: string;
  cogs: number;
  shippingCost: number;
  codFee: number;
  gatewayFee: number;
  returnCost: number;
  failedDeliveryCost: number;
  adSpendAllocated: number;
  aiCostAllocated: number;
  platformFee: number;
}

interface OrderPnL {
  orderId: string;
  revenue: number;
  totalCost: number;
  netProfit: number;
  margin: number;
  status: "pending" | "profit" | "loss" | "break_even";
  lossReasons: string[];
  computedAt: string;
}

interface ProductSnapshot {
  productId: string;
  ordersCount: number;
  revenue: number;
  totalCost: number;
  netProfit: number;
  avgProfitPerOrder: number;
  returnRate: number;
  failedRate: number;
  avgAdCost: number;
  avgShippingCost: number;
  avgReturnLoss: number;
}

interface PriceInsight {
  productId: string;
  breakEvenPrice: number;
  minPrice10: number;
  minPrice20: number;
  currentPrice: number;
  recommendation: string;
}

// ============================================
// Config
// ============================================
const DEFAULT_CONFIG = {
  aiCostPerUnit: 0.05, // $0.05 per AI usage unit
  platformFeePercent: 2.5, // 2.5% platform fee
  codFeePercent: 3, // 3% COD fee
  gatewayFeePercent: 2.5, // 2.5% payment gateway fee
};

// ============================================
// Helper: Get tenant config
// ============================================
async function getTenantProfitConfig(tenantId: string) {
  const { data } = await supabaseAdmin
    .from("tenant_profit_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  return data || DEFAULT_CONFIG;
}

// ============================================
// Helper: Calculate order costs
// ============================================
async function calculateOrderCosts(
  tenantId: string,
  orderId: string,
  config: typeof DEFAULT_CONFIG
): Promise<OrderCosts> {
  // Get order
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .single();

  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  }

  const orderTotal = Number(order.total_amount) || 0;

  // Get shipment costs
  const { data: shipment } = await supabaseAdmin
    .from("shipments")
    .select("shipping_cost, cod_amount, cod_collected")
    .eq("order_id", orderId)
    .single();

  const shippingCost = Number(shipment?.shipping_cost) || 0;

  // COD fee (if COD order)
  const codFee = order.payment_method === "cod" && shipment?.cod_collected
    ? orderTotal * (config.codFeePercent / 100)
    : 0;

  // Gateway fee (if prepaid)
  const gatewayFee = order.payment_method !== "cod"
    ? orderTotal * (config.gatewayFeePercent / 100)
    : 0;

  // Return cost (if returned)
  const returnCost = order.status === "returned" ? shippingCost : 0;

  // Failed delivery cost
  const failedDeliveryCost = order.status === "failed" ? shippingCost * 0.5 : 0;

  // Ad spend allocation
  const { data: adSpend } = await supabaseAdmin
    .from("campaign_daily_spend")
    .select("allocated_per_order")
    .eq("order_id", orderId)
    .single();

  const adSpendAllocated = Number(adSpend?.allocated_per_order) || 0;

  // AI cost allocation
  const { data: aiUsage } = await supabaseAdmin
    .from("ai_usage_logs")
    .select("tokens_used")
    .eq("tenant_id", tenantId)
    .eq("metadata->>order_id", orderId);

  const totalAiTokens = (aiUsage || []).reduce((sum: number, u: any) => sum + (u.tokens_used || 0), 0);
  const aiCostAllocated = totalAiTokens * config.aiCostPerUnit;

  // Platform fee
  const platformFee = orderTotal * (config.platformFeePercent / 100);

  // COGS (from order items)
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("quantity, unit_cost")
    .eq("order_id", orderId);

  const cogs = (items || []).reduce((sum: number, item: any) =>
    sum + (Number(item.quantity) * Number(item.unit_cost || 0)), 0);

  return {
    orderId,
    cogs,
    shippingCost,
    codFee,
    gatewayFee,
    returnCost,
    failedDeliveryCost,
    adSpendAllocated,
    aiCostAllocated,
    platformFee,
  };
}

// ============================================
// Helper: Calculate order P&L
// ============================================
function calculateOrderPnL(
  order: any,
  costs: OrderCosts,
  shipment: any
): OrderPnL {
  const orderTotal = Number(order.total_amount) || 0;

  // Revenue rules
  let revenue = 0;
  const isDelivered = order.status === "delivered";
  const isPrepaid = order.payment_method !== "cod";
  const isCodCollected = shipment?.cod_collected === true;

  if (isDelivered && (isPrepaid || isCodCollected)) {
    revenue = orderTotal;
  } else if (order.status === "returned" || order.status === "failed") {
    revenue = 0;
  } else {
    // Pending
    revenue = orderTotal; // Will be adjusted when status changes
  }

  // Total cost
  const totalCost =
    costs.cogs +
    costs.shippingCost +
    costs.codFee +
    costs.gatewayFee +
    costs.returnCost +
    costs.failedDeliveryCost +
    costs.adSpendAllocated +
    costs.aiCostAllocated +
    costs.platformFee;

  // Net profit
  const netProfit = revenue - totalCost;

  // Margin
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // Status
  let status: "pending" | "profit" | "loss" | "break_even";
  if (!isDelivered && order.status !== "returned" && order.status !== "failed") {
    status = "pending";
  } else if (netProfit > 0) {
    status = "profit";
  } else if (netProfit < 0) {
    status = "loss";
  } else {
    status = "break_even";
  }

  // Loss reasons
  const lossReasons: string[] = [];
  if (netProfit < 0) {
    const costBreakdown = [
      { name: "shipping", value: costs.shippingCost + costs.returnCost + costs.failedDeliveryCost },
      { name: "ad_spend", value: costs.adSpendAllocated },
      { name: "cogs", value: costs.cogs },
      { name: "fees", value: costs.codFee + costs.gatewayFee + costs.platformFee },
    ].sort((a, b) => b.value - a.value);

    // Top 3 reasons
    for (let i = 0; i < Math.min(3, costBreakdown.length); i++) {
      if (costBreakdown[i].value > 0) {
        const percent = Math.round((costBreakdown[i].value / totalCost) * 100);
        lossReasons.push(`${costBreakdown[i].name}: ${percent}%`);
      }
    }

    if (order.status === "returned") {
      lossReasons.unshift("order_returned");
    }
    if (order.status === "failed") {
      lossReasons.unshift("delivery_failed");
    }
  }

  return {
    orderId: order.id,
    revenue,
    totalCost: Math.round(totalCost * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    status,
    lossReasons,
    computedAt: new Date().toISOString(),
  };
}

// ============================================
// Helper: Compute product snapshot
// ============================================
async function computeProductSnapshot(
  tenantId: string,
  productId: string
): Promise<ProductSnapshot> {
  // Get all orders for this product
  const { data: orderItems } = await supabaseAdmin
    .from("order_items")
    .select("order_id, quantity")
    .eq("product_id", productId);

  if (!orderItems || orderItems.length === 0) {
    return {
      productId,
      ordersCount: 0,
      revenue: 0,
      totalCost: 0,
      netProfit: 0,
      avgProfitPerOrder: 0,
      returnRate: 0,
      failedRate: 0,
      avgAdCost: 0,
      avgShippingCost: 0,
      avgReturnLoss: 0,
    };
  }

  const orderIds = Array.from(new Set(orderItems.map((i: any) => i.order_id)));

  // Get P&L for all orders
  const { data: pnls } = await supabaseAdmin
    .from("order_pnl")
    .select("*")
    .in("order_id", orderIds);

  const { data: costs } = await supabaseAdmin
    .from("order_costs")
    .select("*")
    .in("order_id", orderIds);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .in("id", orderIds);

  const ordersCount = orderIds.length;
  const revenue = (pnls || []).reduce((sum: number, p: any) => sum + Number(p.revenue || 0), 0);
  const totalCost = (pnls || []).reduce((sum: number, p: any) => sum + Number(p.total_cost || 0), 0);
  const netProfit = revenue - totalCost;
  const avgProfitPerOrder = ordersCount > 0 ? netProfit / ordersCount : 0;

  const returnedCount = (orders || []).filter((o: any) => o.status === "returned").length;
  const failedCount = (orders || []).filter((o: any) => o.status === "failed").length;
  const returnRate = ordersCount > 0 ? (returnedCount / ordersCount) * 100 : 0;
  const failedRate = ordersCount > 0 ? (failedCount / ordersCount) * 100 : 0;

  const avgAdCost = (costs || []).reduce((sum: number, c: any) => sum + Number(c.ad_spend_allocated || 0), 0) / ordersCount;
  const avgShippingCost = (costs || []).reduce((sum: number, c: any) => sum + Number(c.shipping_cost || 0), 0) / ordersCount;
  const avgReturnLoss = (costs || []).reduce((sum: number, c: any) => sum + Number(c.return_cost || 0), 0) / ordersCount;

  return {
    productId,
    ordersCount,
    revenue: Math.round(revenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    avgProfitPerOrder: Math.round(avgProfitPerOrder * 100) / 100,
    returnRate: Math.round(returnRate * 100) / 100,
    failedRate: Math.round(failedRate * 100) / 100,
    avgAdCost: Math.round(avgAdCost * 100) / 100,
    avgShippingCost: Math.round(avgShippingCost * 100) / 100,
    avgReturnLoss: Math.round(avgReturnLoss * 100) / 100,
  };
}

// ============================================
// Helper: Calculate minimum price
// ============================================
function calculateMinimumPrice(
  snapshot: ProductSnapshot,
  config: typeof DEFAULT_CONFIG
): PriceInsight {
  // Average cost per order
  const avgCostPerOrder = snapshot.ordersCount > 0
    ? snapshot.totalCost / snapshot.ordersCount
    : 0;

  // Break-even price (covers all costs)
  const breakEvenPrice = avgCostPerOrder;

  // Minimum price for 10% margin
  const minPrice10 = avgCostPerOrder / (1 - 0.10);

  // Minimum price for 20% margin
  const minPrice20 = avgCostPerOrder / (1 - 0.20);

  // Current average price
  const currentPrice = snapshot.ordersCount > 0
    ? snapshot.revenue / snapshot.ordersCount
    : 0;

  // Recommendation
  let recommendation = "";
  if (currentPrice < breakEvenPrice) {
    recommendation = "السعر الحالي أقل من نقطة التعادل - يجب رفع السعر";
  } else if (currentPrice < minPrice10) {
    recommendation = "السعر الحالي لا يحقق هامش 10% - يُنصح برفع السعر";
  } else if (currentPrice < minPrice20) {
    recommendation = "السعر الحالي يحقق هامش أقل من 20%";
  } else {
    recommendation = "السعر الحالي جيد - يحقق هامش ربح صحي";
  }

  return {
    productId: snapshot.productId,
    breakEvenPrice: Math.round(breakEvenPrice * 100) / 100,
    minPrice10: Math.round(minPrice10 * 100) / 100,
    minPrice20: Math.round(minPrice20 * 100) / 100,
    currentPrice: Math.round(currentPrice * 100) / 100,
    recommendation,
  };
}

// ============================================
// Router
// ============================================
export const profitRouter = router({
  // ============================================
  // Compute P&L for single order
  // ============================================
  computeOrderPnL: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const config = await getTenantProfitConfig(ctx.tenantId);

      // Get order
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", input.orderId)
        .eq("tenant_id", ctx.tenantId)
        .single();

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      // Get shipment
      const { data: shipment } = await supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("order_id", input.orderId)
        .single();

      // Calculate costs
      const costs = await calculateOrderCosts(ctx.tenantId, input.orderId, config);

      // Calculate P&L
      const pnl = calculateOrderPnL(order, costs, shipment);

      // Save costs
      await supabaseAdmin
        .from("order_costs")
        .upsert({
          order_id: input.orderId,
          tenant_id: ctx.tenantId,
          cogs: costs.cogs,
          shipping_cost: costs.shippingCost,
          cod_fee: costs.codFee,
          gateway_fee: costs.gatewayFee,
          return_cost: costs.returnCost,
          failed_delivery_cost: costs.failedDeliveryCost,
          ad_spend_allocated: costs.adSpendAllocated,
          ai_cost_allocated: costs.aiCostAllocated,
          platform_fee: costs.platformFee,
          updated_at: new Date().toISOString(),
        }, { onConflict: "order_id" });

      // Save P&L
      await supabaseAdmin
        .from("order_pnl")
        .upsert({
          order_id: input.orderId,
          tenant_id: ctx.tenantId,
          revenue: pnl.revenue,
          total_cost: pnl.totalCost,
          net_profit: pnl.netProfit,
          margin: pnl.margin,
          status: pnl.status,
          loss_reasons: pnl.lossReasons,
          computed_at: pnl.computedAt,
        }, { onConflict: "order_id" });

      return { costs, pnl };
    }),

  // ============================================
  // Get order P&L
  // ============================================
  getOrderPnL: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: pnl } = await supabaseAdmin
        .from("order_pnl")
        .select("*")
        .eq("order_id", input.orderId)
        .eq("tenant_id", ctx.tenantId)
        .single();

      const { data: costs } = await supabaseAdmin
        .from("order_costs")
        .select("*")
        .eq("order_id", input.orderId)
        .eq("tenant_id", ctx.tenantId)
        .single();

      return { pnl, costs };
    }),

  // ============================================
  // List all orders P&L
  // ============================================
  listOrdersPnL: tenantProcedure
    .input(z.object({
      status: z.enum(["all", "profit", "loss", "pending"]).optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("order_pnl")
        .select("*, orders!inner(order_number, customer_name, status, created_at)")
        .eq("tenant_id", ctx.tenantId)
        .order("computed_at", { ascending: false });

      if (input.status && input.status !== "all") {
        query = query.eq("status", input.status);
      }

      if (input.limit) {
        query = query.limit(input.limit);
      }

      if (input.offset) {
        query = query.range(input.offset, input.offset + (input.limit || 20) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data || [];
    }),

  // ============================================
  // Batch recompute P&L
  // ============================================
  batchRecompute: tenantProcedure
    .input(z.object({
      orderIds: z.array(z.string().uuid()).optional(),
      all: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let orderIds = input.orderIds || [];

      if (input.all) {
        const { data: orders } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("tenant_id", ctx.tenantId);

        orderIds = (orders || []).map((o: any) => o.id);
      }

      const config = await getTenantProfitConfig(ctx.tenantId);
      let computed = 0;

      for (const orderId of orderIds) {
        try {
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();

          if (!order) continue;

          const { data: shipment } = await supabaseAdmin
            .from("shipments")
            .select("*")
            .eq("order_id", orderId)
            .single();

          const costs = await calculateOrderCosts(ctx.tenantId, orderId, config);
          const pnl = calculateOrderPnL(order, costs, shipment);

          await supabaseAdmin
            .from("order_costs")
            .upsert({
              order_id: orderId,
              tenant_id: ctx.tenantId,
              cogs: costs.cogs,
              shipping_cost: costs.shippingCost,
              cod_fee: costs.codFee,
              gateway_fee: costs.gatewayFee,
              return_cost: costs.returnCost,
              failed_delivery_cost: costs.failedDeliveryCost,
              ad_spend_allocated: costs.adSpendAllocated,
              ai_cost_allocated: costs.aiCostAllocated,
              platform_fee: costs.platformFee,
              updated_at: new Date().toISOString(),
            }, { onConflict: "order_id" });

          await supabaseAdmin
            .from("order_pnl")
            .upsert({
              order_id: orderId,
              tenant_id: ctx.tenantId,
              revenue: pnl.revenue,
              total_cost: pnl.totalCost,
              net_profit: pnl.netProfit,
              margin: pnl.margin,
              status: pnl.status,
              loss_reasons: pnl.lossReasons,
              computed_at: pnl.computedAt,
            }, { onConflict: "order_id" });

          computed++;
        } catch (e) {
          // Skip failed orders
        }
      }

      return { computed, total: orderIds.length };
    }),

  // ============================================
  // Get product snapshot
  // ============================================
  getProductSnapshot: tenantProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const snapshot = await computeProductSnapshot(ctx.tenantId, input.productId);
      const config = await getTenantProfitConfig(ctx.tenantId);
      const priceInsight = calculateMinimumPrice(snapshot, config);

      return { snapshot, priceInsight };
    }),

  // ============================================
  // List all products snapshots
  // ============================================
  listProductSnapshots: tenantProcedure.query(async ({ ctx }) => {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name, price")
      .eq("tenant_id", ctx.tenantId);

    if (!products || products.length === 0) {
      return [];
    }

    const config = await getTenantProfitConfig(ctx.tenantId);
    const results = [];

    for (const product of products) {
      const snapshot = await computeProductSnapshot(ctx.tenantId, product.id);
      const priceInsight = calculateMinimumPrice(snapshot, config);

      results.push({
        product: { id: product.id, name: product.name, price: product.price },
        snapshot,
        priceInsight,
      });
    }

    return results.sort((a, b) => b.snapshot.netProfit - a.snapshot.netProfit);
  }),

  // ============================================
  // Get daily profit snapshot
  // ============================================
  getDailySnapshots: tenantProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { data: pnls } = await supabaseAdmin
        .from("order_pnl")
        .select("*, orders!inner(created_at)")
        .eq("tenant_id", ctx.tenantId)
        .gte("orders.created_at", input.startDate)
        .lte("orders.created_at", input.endDate);

      // Group by date
      const dailyMap = new Map<string, {
        date: string;
        revenue: number;
        totalCost: number;
        netProfit: number;
        ordersCount: number;
        profitCount: number;
        lossCount: number;
      }>();

      for (const pnl of pnls || []) {
        const date = new Date((pnl as any).orders.created_at).toISOString().split("T")[0];

        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            revenue: 0,
            totalCost: 0,
            netProfit: 0,
            ordersCount: 0,
            profitCount: 0,
            lossCount: 0,
          });
        }

        const day = dailyMap.get(date)!;
        day.revenue += Number(pnl.revenue) || 0;
        day.totalCost += Number(pnl.total_cost) || 0;
        day.netProfit += Number(pnl.net_profit) || 0;
        day.ordersCount++;
        if (pnl.status === "profit") day.profitCount++;
        if (pnl.status === "loss") day.lossCount++;
      }

      return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }),

  // ============================================
  // Get COD cashflow status
  // ============================================
  getCodCashflow: tenantProcedure.query(async ({ ctx }) => {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, status, created_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("payment_method", "cod");

    const { data: shipments } = await supabaseAdmin
      .from("shipments")
      .select("order_id, cod_collected, cod_collected_at")
      .eq("tenant_id", ctx.tenantId);

    const shipmentMap = new Map((shipments || []).map((s: any) => [s.order_id, s]));

    let pendingAmount = 0;
    let collectedAmount = 0;
    let pendingOrders: any[] = [];
    let avgSettlementDays = 0;
    let settlementDelays: number[] = [];

    for (const order of orders || []) {
      const shipment = shipmentMap.get(order.id);
      const amount = Number(order.total_amount) || 0;

      if (shipment?.cod_collected) {
        collectedAmount += amount;

        // Calculate settlement delay
        if (shipment.cod_collected_at) {
          const orderDate = new Date(order.created_at);
          const collectedDate = new Date(shipment.cod_collected_at);
          const days = Math.floor((collectedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
          settlementDelays.push(days);
        }
      } else if (order.status === "delivered") {
        pendingAmount += amount;
        pendingOrders.push({
          orderId: order.id,
          amount,
          daysPending: Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        });
      }
    }

    if (settlementDelays.length > 0) {
      avgSettlementDays = Math.round(settlementDelays.reduce((a, b) => a + b, 0) / settlementDelays.length);
    }

    return {
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      collectedAmount: Math.round(collectedAmount * 100) / 100,
      pendingOrdersCount: pendingOrders.length,
      avgSettlementDays,
      pendingOrders: pendingOrders.sort((a, b) => b.daysPending - a.daysPending).slice(0, 10),
    };
  }),

  // ============================================
  // Get profit insights
  // ============================================
  getInsights: tenantProcedure.query(async ({ ctx }) => {
    // Most profitable products
    const productSnapshots = await supabaseAdmin
      .from("product_profit_snapshots")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("net_profit", { ascending: false })
      .limit(5);

    // Products losing money
    const losingProducts = await supabaseAdmin
      .from("product_profit_snapshots")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .lt("net_profit", 0)
      .order("net_profit", { ascending: true })
      .limit(5);

    // High shipping cost products
    const highShippingProducts = await supabaseAdmin
      .from("product_profit_snapshots")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("avg_shipping_cost", { ascending: false })
      .limit(5);

    // High return rate products
    const highReturnProducts = await supabaseAdmin
      .from("product_profit_snapshots")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .gt("return_rate", 10)
      .order("return_rate", { ascending: false })
      .limit(5);

    return {
      mostProfitable: productSnapshots.data || [],
      losingMoney: losingProducts.data || [],
      highShippingCost: highShippingProducts.data || [],
      highReturnRate: highReturnProducts.data || [],
    };
  }),

  // ============================================
  // Super Admin: Override cost
  // ============================================
  overrideCost: protectedProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      field: z.enum(["cogs", "shipping_cost", "cod_fee", "gateway_fee", "return_cost", "ad_spend_allocated", "ai_cost_allocated", "platform_fee"]),
      value: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify Super Admin
      if (ctx.user?.openId !== process.env.OWNER_OPEN_ID) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await supabaseAdmin
        .from("order_costs")
        .update({ [input.field]: input.value, updated_at: new Date().toISOString() })
        .eq("order_id", input.orderId);

      return { success: true };
    }),

  // ============================================
  // Get profit config
  // ============================================
  getConfig: tenantProcedure.query(async ({ ctx }) => {
    return await getTenantProfitConfig(ctx.tenantId);
  }),

  // ============================================
  // Update profit config
  // ============================================
  updateConfig: tenantProcedure
    .input(z.object({
      aiCostPerUnit: z.number().min(0).optional(),
      platformFeePercent: z.number().min(0).max(100).optional(),
      codFeePercent: z.number().min(0).max(100).optional(),
      gatewayFeePercent: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing } = await supabaseAdmin
        .from("tenant_profit_config")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .single();

      const updateData = {
        ...input,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabaseAdmin
          .from("tenant_profit_config")
          .update(updateData)
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("tenant_profit_config")
          .insert({ tenant_id: ctx.tenantId, ...updateData });
      }

      return { success: true };
    }),
});
