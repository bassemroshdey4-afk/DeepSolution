import { z } from "zod";
import { router, tenantProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";

// ============================================
// Smart Routing Engine
// ============================================
// Data-driven carrier recommendation system
// Based on real performance metrics
// ============================================

// ============================================
// Types
// ============================================
interface ScoringWeights {
  pickup_speed: number;
  delivery_speed: number;
  success_rate: number;
  return_rate: number;
  cod_performance: number;
  region_performance: number;
}

interface CarrierScore {
  carrier: string;
  scores: {
    pickup_speed: number;
    delivery_speed: number;
    success_rate: number;
    return_rate: number;
    cod_performance: number;
    region_performance: number;
  };
  weightedScore: number;
  tier: "excellent" | "good" | "average" | "poor";
  sampleSize: number;
}

interface Recommendation {
  bestCarrier: string;
  bestScore: number;
  backupCarrier: string | null;
  backupScore: number | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  reasoningAr: string;
  allScores: CarrierScore[];
}

interface RoutingDecision {
  orderId: string;
  recommendedCarrier: string;
  chosenCarrier: string;
  score: number;
  confidence: string;
  reasoning: string;
  overriddenBy: string | null;
  createdAt: string;
}

// ============================================
// Default Weights (configurable)
// ============================================
const DEFAULT_WEIGHTS: ScoringWeights = {
  pickup_speed: 0.15,
  delivery_speed: 0.25,
  success_rate: 0.30,
  return_rate: 0.15,
  cod_performance: 0.10,
  region_performance: 0.05,
};

// ============================================
// Helper: Get tenant weights or default
// ============================================
async function getTenantWeights(tenantId: string): Promise<ScoringWeights> {
  const { data: config } = await supabaseAdmin
    .from("tenant_routing_config")
    .select("weights")
    .eq("tenant_id", tenantId)
    .single();

  if (config?.weights) {
    return config.weights as ScoringWeights;
  }
  return DEFAULT_WEIGHTS;
}

// ============================================
// Helper: Calculate carrier metrics from shipments
// ============================================
async function calculateCarrierMetrics(
  tenantId: string,
  region?: string
): Promise<Map<string, any>> {
  let query = supabaseAdmin
    .from("shipments")
    .select("*")
    .eq("tenant_id", tenantId);

  const { data: shipments } = await query;

  if (!shipments || shipments.length === 0) {
    return new Map();
  }

  const carrierMetrics = new Map<string, any>();

  for (const shipment of shipments) {
    const events = (shipment.tracking_events as any[]) || [];
    if (events.length === 0) continue;

    const carrier = events[0]?.carrier || "unknown";
    
    if (!carrierMetrics.has(carrier)) {
      carrierMetrics.set(carrier, {
        total: 0,
        delivered: 0,
        returned: 0,
        failed: 0,
        pickupDelays: [] as number[],
        deliveryTimes: [] as number[],
        codCollected: 0,
        codTotal: 0,
      });
    }

    const metrics = carrierMetrics.get(carrier)!;
    metrics.total++;

    // Extract status from events
    const createdAt = new Date(shipment.created_at);
    let pickupTime: Date | null = null;
    let deliveryTime: Date | null = null;
    let isDelivered = false;
    let isReturned = false;
    let isFailed = false;

    for (const event of events) {
      const eventTime = new Date(event.occurred_at);
      switch (event.normalized_status) {
        case "PICKED_UP":
          if (!pickupTime) pickupTime = eventTime;
          break;
        case "DELIVERED":
          deliveryTime = eventTime;
          isDelivered = true;
          break;
        case "RETURNED":
          isReturned = true;
          break;
        case "FAILED":
          isFailed = true;
          break;
      }
    }

    if (isDelivered) metrics.delivered++;
    if (isReturned) metrics.returned++;
    if (isFailed && !isDelivered) metrics.failed++;

    // Calculate times
    if (pickupTime) {
      const pickupDelay = (pickupTime.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      metrics.pickupDelays.push(pickupDelay);
    }

    if (deliveryTime) {
      const deliveryDuration = (deliveryTime.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      metrics.deliveryTimes.push(deliveryDuration);
    }

    // COD tracking
    if (shipment.cod_amount) {
      metrics.codTotal++;
      if (shipment.cod_collected) {
        metrics.codCollected++;
      }
    }
  }

  return carrierMetrics;
}

// ============================================
// Helper: Calculate score for a carrier
// ============================================
function calculateCarrierScore(
  carrier: string,
  metrics: any,
  weights: ScoringWeights,
  regionBonus: number = 0
): CarrierScore {
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  // Pickup speed score (lower is better, benchmark: 24h = 100, 48h = 50)
  const avgPickup = avg(metrics.pickupDelays);
  const pickupSpeedScore = avgPickup !== null
    ? Math.max(0, Math.min(100, 100 - ((avgPickup - 24) / 24) * 50))
    : 50;

  // Delivery speed score (lower is better, benchmark: 48h = 100, 96h = 50)
  const avgDelivery = avg(metrics.deliveryTimes);
  const deliverySpeedScore = avgDelivery !== null
    ? Math.max(0, Math.min(100, 100 - ((avgDelivery - 48) / 48) * 50))
    : 50;

  // Success rate score (higher is better)
  const successRate = metrics.total > 0 ? (metrics.delivered / metrics.total) * 100 : 50;

  // Return rate score (lower is better)
  const returnRate = metrics.total > 0 ? (metrics.returned / metrics.total) * 100 : 0;
  const returnRateScore = Math.max(0, 100 - returnRate * 5);

  // COD performance score
  const codPerformance = metrics.codTotal > 0
    ? (metrics.codCollected / metrics.codTotal) * 100
    : 50;

  // Region performance (bonus from parameter)
  const regionScore = 50 + regionBonus;

  const scores = {
    pickup_speed: Math.round(pickupSpeedScore),
    delivery_speed: Math.round(deliverySpeedScore),
    success_rate: Math.round(successRate),
    return_rate: Math.round(returnRateScore),
    cod_performance: Math.round(codPerformance),
    region_performance: Math.round(regionScore),
  };

  // Calculate weighted score
  const weightedScore =
    scores.pickup_speed * weights.pickup_speed +
    scores.delivery_speed * weights.delivery_speed +
    scores.success_rate * weights.success_rate +
    scores.return_rate * weights.return_rate +
    scores.cod_performance * weights.cod_performance +
    scores.region_performance * weights.region_performance;

  // Determine tier
  let tier: "excellent" | "good" | "average" | "poor";
  if (weightedScore >= 85) tier = "excellent";
  else if (weightedScore >= 70) tier = "good";
  else if (weightedScore >= 50) tier = "average";
  else tier = "poor";

  return {
    carrier,
    scores,
    weightedScore: Math.round(weightedScore),
    tier,
    sampleSize: metrics.total,
  };
}

// ============================================
// Helper: Generate recommendation
// ============================================
function generateRecommendation(
  scores: CarrierScore[],
  paymentMethod: "cod" | "prepaid",
  orderValue: number
): Recommendation {
  // Sort by weighted score
  const sorted = [...scores].sort((a, b) => b.weightedScore - a.weightedScore);

  // Filter based on payment method
  let filtered = sorted;
  if (paymentMethod === "cod") {
    // Prefer carriers with good COD performance
    filtered = sorted.filter(s => s.scores.cod_performance >= 60);
    if (filtered.length === 0) filtered = sorted;
  }

  const best = filtered[0];
  const backup = filtered[1] || null;

  // Calculate confidence
  let confidence: "high" | "medium" | "low";
  if (best.sampleSize >= 50 && best.weightedScore >= 75) {
    confidence = "high";
  } else if (best.sampleSize >= 20 && best.weightedScore >= 60) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  // Generate reasoning
  const reasons: string[] = [];
  const reasonsAr: string[] = [];

  if (best.scores.success_rate >= 90) {
    reasons.push(`High delivery success rate (${best.scores.success_rate}%)`);
    reasonsAr.push(`معدل توصيل مرتفع (${best.scores.success_rate}%)`);
  }
  if (best.scores.delivery_speed >= 80) {
    reasons.push(`Fast delivery times`);
    reasonsAr.push(`سرعة توصيل عالية`);
  }
  if (paymentMethod === "cod" && best.scores.cod_performance >= 80) {
    reasons.push(`Excellent COD collection (${best.scores.cod_performance}%)`);
    reasonsAr.push(`أداء تحصيل COD ممتاز (${best.scores.cod_performance}%)`);
  }
  if (best.scores.return_rate >= 90) {
    reasons.push(`Low return rate`);
    reasonsAr.push(`معدل مرتجعات منخفض`);
  }

  if (reasons.length === 0) {
    reasons.push(`Best overall performance score (${best.weightedScore})`);
    reasonsAr.push(`أفضل أداء عام (${best.weightedScore})`);
  }

  return {
    bestCarrier: best.carrier,
    bestScore: best.weightedScore,
    backupCarrier: backup?.carrier || null,
    backupScore: backup?.weightedScore || null,
    confidence,
    reasoning: reasons.join(". "),
    reasoningAr: reasonsAr.join(". "),
    allScores: sorted,
  };
}

// ============================================
// Router
// ============================================
export const smartRoutingRouter = router({
  // ============================================
  // Get scoring weights
  // ============================================
  getWeights: tenantProcedure.query(async ({ ctx }) => {
    return await getTenantWeights(ctx.tenantId);
  }),

  // ============================================
  // Update scoring weights (Super Admin only via hidden route)
  // ============================================
  updateWeights: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      weights: z.object({
        pickup_speed: z.number().min(0).max(1),
        delivery_speed: z.number().min(0).max(1),
        success_rate: z.number().min(0).max(1),
        return_rate: z.number().min(0).max(1),
        cod_performance: z.number().min(0).max(1),
        region_performance: z.number().min(0).max(1),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify Super Admin (platform owner)
      if (ctx.user?.openId !== process.env.OWNER_OPEN_ID) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Validate weights sum to 1
      const sum = Object.values(input.weights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 0.01) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Weights must sum to 1" });
      }

      // Upsert config
      const { data: existing } = await supabaseAdmin
        .from("tenant_routing_config")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .single();

      if (existing) {
        await supabaseAdmin
          .from("tenant_routing_config")
          .update({ weights: input.weights, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("tenant_routing_config")
          .insert({ tenant_id: input.tenantId, weights: input.weights });
      }

      return { success: true };
    }),

  // ============================================
  // Get carrier scores
  // ============================================
  getCarrierScores: tenantProcedure
    .input(z.object({
      region: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const weights = await getTenantWeights(ctx.tenantId);
      const metrics = await calculateCarrierMetrics(ctx.tenantId, input.region);

      const scores: CarrierScore[] = [];
      for (const [carrier, carrierMetrics] of Array.from(metrics.entries())) {
        scores.push(calculateCarrierScore(carrier, carrierMetrics, weights));
      }

      return scores.sort((a, b) => b.weightedScore - a.weightedScore);
    }),

  // ============================================
  // Get recommendation for order
  // ============================================
  getRecommendation: tenantProcedure
    .input(z.object({
      city: z.string().optional(),
      region: z.string().optional(),
      paymentMethod: z.enum(["cod", "prepaid"]),
      orderValue: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const weights = await getTenantWeights(ctx.tenantId);
      const metrics = await calculateCarrierMetrics(ctx.tenantId, input.region);

      if (metrics.size === 0) {
        return {
          bestCarrier: null,
          bestScore: 0,
          backupCarrier: null,
          backupScore: null,
          confidence: "low" as const,
          reasoning: "No shipping data available",
          reasoningAr: "لا توجد بيانات شحن متاحة",
          allScores: [],
        };
      }

      // Check for disabled carriers
      const { data: disabledCarriers } = await supabaseAdmin
        .from("carrier_overrides")
        .select("carrier")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_disabled", true);

      const disabledSet = new Set((disabledCarriers || []).map((c: any) => c.carrier));

      // Calculate scores
      const scores: CarrierScore[] = [];
      for (const [carrier, carrierMetrics] of Array.from(metrics.entries())) {
        if (disabledSet.has(carrier)) continue;
        scores.push(calculateCarrierScore(carrier, carrierMetrics, weights));
      }

      if (scores.length === 0) {
        return {
          bestCarrier: null,
          bestScore: 0,
          backupCarrier: null,
          backupScore: null,
          confidence: "low" as const,
          reasoning: "All carriers disabled",
          reasoningAr: "جميع الناقلين معطلون",
          allScores: [],
        };
      }

      // Check for forced carrier
      const { data: forcedCarrier } = await supabaseAdmin
        .from("carrier_overrides")
        .select("carrier")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_forced", true)
        .single();

      if (forcedCarrier) {
        const forced = scores.find(s => s.carrier === forcedCarrier.carrier);
        if (forced) {
          return {
            bestCarrier: forced.carrier,
            bestScore: forced.weightedScore,
            backupCarrier: null,
            backupScore: null,
            confidence: "high" as const,
            reasoning: "Forced by administrator",
            reasoningAr: "محدد من قبل المسؤول",
            allScores: scores,
          };
        }
      }

      return generateRecommendation(scores, input.paymentMethod, input.orderValue);
    }),

  // ============================================
  // Save routing decision
  // ============================================
  saveDecision: tenantProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      recommendedCarrier: z.string(),
      chosenCarrier: z.string(),
      score: z.number(),
      confidence: z.string(),
      reasoning: z.string(),
      overriddenBy: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await supabaseAdmin
        .from("routing_decisions")
        .insert({
          tenant_id: ctx.tenantId,
          order_id: input.orderId,
          recommended_carrier: input.recommendedCarrier,
          chosen_carrier: input.chosenCarrier,
          score: input.score,
          confidence: input.confidence,
          reasoning: input.reasoning,
          overridden_by: input.overriddenBy || null,
        });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save decision" });
      }

      return { success: true };
    }),

  // ============================================
  // Get routing decisions for order
  // ============================================
  getDecision: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await supabaseAdmin
        .from("routing_decisions")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("order_id", input.orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return data;
    }),

  // ============================================
  // Carrier overrides (Super Admin)
  // ============================================
  setCarrierOverride: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      carrier: z.string(),
      isDisabled: z.boolean().optional(),
      isForced: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify Super Admin
      if (ctx.user?.openId !== process.env.OWNER_OPEN_ID) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // If forcing, remove other forced carriers
      if (input.isForced) {
        await supabaseAdmin
          .from("carrier_overrides")
          .update({ is_forced: false })
          .eq("tenant_id", input.tenantId);
      }

      // Upsert override
      const { data: existing } = await supabaseAdmin
        .from("carrier_overrides")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("carrier", input.carrier)
        .single();

      if (existing) {
        await supabaseAdmin
          .from("carrier_overrides")
          .update({
            is_disabled: input.isDisabled ?? false,
            is_forced: input.isForced ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("carrier_overrides")
          .insert({
            tenant_id: input.tenantId,
            carrier: input.carrier,
            is_disabled: input.isDisabled ?? false,
            is_forced: input.isForced ?? false,
          });
      }

      return { success: true };
    }),

  // ============================================
  // Get routing analytics
  // ============================================
  getAnalytics: tenantProcedure.query(async ({ ctx }) => {
    const { data: decisions } = await supabaseAdmin
      .from("routing_decisions")
      .select("*")
      .eq("tenant_id", ctx.tenantId);

    if (!decisions || decisions.length === 0) {
      return {
        totalDecisions: 0,
        followedRecommendation: 0,
        overrideRate: 0,
        avgScore: 0,
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
      };
    }

    const followed = decisions.filter((d: any) => d.recommended_carrier === d.chosen_carrier);
    const avgScore = decisions.reduce((sum: number, d: any) => sum + d.score, 0) / decisions.length;

    const confidenceDistribution = {
      high: decisions.filter((d: any) => d.confidence === "high").length,
      medium: decisions.filter((d: any) => d.confidence === "medium").length,
      low: decisions.filter((d: any) => d.confidence === "low").length,
    };

    return {
      totalDecisions: decisions.length,
      followedRecommendation: followed.length,
      overrideRate: Math.round(((decisions.length - followed.length) / decisions.length) * 100),
      avgScore: Math.round(avgScore),
      confidenceDistribution,
    };
  }),
});
