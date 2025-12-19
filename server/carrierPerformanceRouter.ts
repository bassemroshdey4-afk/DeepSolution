import { z } from "zod";
import { router, tenantProcedure } from "./_core/trpc";
import { supabaseAdmin } from "./supabase";

// ============================================
// Carrier Performance Intelligence Engine
// ============================================
// Evaluates shipping carriers based on operational performance
// Uses existing shipments table with tracking_events
// ============================================

// ============================================
// Types
// ============================================
interface TrackingEvent {
  id: string;
  raw_status: string;
  normalized_status: string;
  carrier: string;
  location?: string;
  occurred_at: string;
  created_at: string;
}

interface ShipmentTimeline {
  orderId: string;
  shipmentId: string;
  carrier: string;
  assignmentTime: Date | null;
  pickupTime: Date | null;
  inTransitTime: Date | null;
  outForDeliveryTime: Date | null;
  deliveryTime: Date | null;
  failedTime: Date | null;
  returnedTime: Date | null;
  // Derived durations (in hours)
  pickupDelay: number | null;
  transitTime: number | null;
  deliveryDuration: number | null;
  returnCycleTime: number | null;
}

interface CarrierMetrics {
  carrier: string;
  totalShipments: number;
  deliveredCount: number;
  failedCount: number;
  returnedCount: number;
  inTransitCount: number;
  // Rates (0-100)
  deliverySuccessRate: number;
  returnRate: number;
  failureRate: number;
  // Average times (in hours)
  avgPickupTime: number | null;
  avgTransitTime: number | null;
  avgDeliveryTime: number | null;
  avgReturnCycleTime: number | null;
  // Failure reasons
  failureReasons: Record<string, number>;
}

interface CarrierScore {
  carrier: string;
  speedScore: number;
  reliabilityScore: number;
  returnRateScore: number;
  overallScore: number;
  tier: "excellent" | "good" | "average" | "poor";
}

interface CarrierInsight {
  type: "strength" | "weakness" | "warning";
  carrier: string;
  metric: string;
  value: number;
  benchmark: number;
  message: string;
}

interface RoutingRecommendation {
  region?: string;
  paymentMethod?: string;
  recommendedCarrier: string;
  score: number;
  reason: string;
  alternativeCarriers: Array<{ carrier: string; score: number }>;
}

// ============================================
// Helper: Calculate timeline from events
// ============================================
function calculateTimeline(
  shipment: any,
  events: TrackingEvent[]
): ShipmentTimeline {
  const timeline: ShipmentTimeline = {
    orderId: shipment.order_id,
    shipmentId: shipment.id,
    carrier: events[0]?.carrier || "unknown",
    assignmentTime: new Date(shipment.created_at),
    pickupTime: null,
    inTransitTime: null,
    outForDeliveryTime: null,
    deliveryTime: null,
    failedTime: null,
    returnedTime: null,
    pickupDelay: null,
    transitTime: null,
    deliveryDuration: null,
    returnCycleTime: null,
  };

  // Extract times from events
  for (const event of events) {
    const eventTime = new Date(event.occurred_at);
    switch (event.normalized_status) {
      case "PICKED_UP":
        if (!timeline.pickupTime) timeline.pickupTime = eventTime;
        break;
      case "IN_TRANSIT":
        if (!timeline.inTransitTime) timeline.inTransitTime = eventTime;
        break;
      case "OUT_FOR_DELIVERY":
        if (!timeline.outForDeliveryTime) timeline.outForDeliveryTime = eventTime;
        break;
      case "DELIVERED":
        if (!timeline.deliveryTime) timeline.deliveryTime = eventTime;
        break;
      case "FAILED":
        if (!timeline.failedTime) timeline.failedTime = eventTime;
        break;
      case "RETURNED":
        if (!timeline.returnedTime) timeline.returnedTime = eventTime;
        break;
    }
  }

  // Calculate durations
  if (timeline.assignmentTime && timeline.pickupTime) {
    timeline.pickupDelay = (timeline.pickupTime.getTime() - timeline.assignmentTime.getTime()) / (1000 * 60 * 60);
  }

  if (timeline.pickupTime && timeline.deliveryTime) {
    timeline.transitTime = (timeline.deliveryTime.getTime() - timeline.pickupTime.getTime()) / (1000 * 60 * 60);
  }

  if (timeline.assignmentTime && timeline.deliveryTime) {
    timeline.deliveryDuration = (timeline.deliveryTime.getTime() - timeline.assignmentTime.getTime()) / (1000 * 60 * 60);
  }

  if (timeline.assignmentTime && timeline.returnedTime) {
    timeline.returnCycleTime = (timeline.returnedTime.getTime() - timeline.assignmentTime.getTime()) / (1000 * 60 * 60);
  }

  return timeline;
}

// ============================================
// Helper: Calculate carrier metrics
// ============================================
function calculateCarrierMetrics(
  carrier: string,
  timelines: ShipmentTimeline[]
): CarrierMetrics {
  const carrierTimelines = timelines.filter(t => t.carrier === carrier);
  const total = carrierTimelines.length;

  if (total === 0) {
    return {
      carrier,
      totalShipments: 0,
      deliveredCount: 0,
      failedCount: 0,
      returnedCount: 0,
      inTransitCount: 0,
      deliverySuccessRate: 0,
      returnRate: 0,
      failureRate: 0,
      avgPickupTime: null,
      avgTransitTime: null,
      avgDeliveryTime: null,
      avgReturnCycleTime: null,
      failureReasons: {},
    };
  }

  const delivered = carrierTimelines.filter(t => t.deliveryTime !== null);
  const failed = carrierTimelines.filter(t => t.failedTime !== null && !t.deliveryTime);
  const returned = carrierTimelines.filter(t => t.returnedTime !== null);
  const inTransit = carrierTimelines.filter(t => !t.deliveryTime && !t.failedTime && !t.returnedTime);

  // Calculate averages
  const pickupDelays = carrierTimelines.map(t => t.pickupDelay).filter((d): d is number => d !== null);
  const transitTimes = carrierTimelines.map(t => t.transitTime).filter((d): d is number => d !== null);
  const deliveryDurations = carrierTimelines.map(t => t.deliveryDuration).filter((d): d is number => d !== null);
  const returnCycles = carrierTimelines.map(t => t.returnCycleTime).filter((d): d is number => d !== null);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    carrier,
    totalShipments: total,
    deliveredCount: delivered.length,
    failedCount: failed.length,
    returnedCount: returned.length,
    inTransitCount: inTransit.length,
    deliverySuccessRate: (delivered.length / total) * 100,
    returnRate: (returned.length / total) * 100,
    failureRate: (failed.length / total) * 100,
    avgPickupTime: avg(pickupDelays),
    avgTransitTime: avg(transitTimes),
    avgDeliveryTime: avg(deliveryDurations),
    avgReturnCycleTime: avg(returnCycles),
    failureReasons: {},
  };
}

// ============================================
// Helper: Calculate carrier score
// ============================================
function calculateCarrierScore(metrics: CarrierMetrics): CarrierScore {
  // Speed score (based on delivery time, lower is better)
  // Benchmark: 48 hours = 100, 96 hours = 50, 144+ hours = 0
  let speedScore = 100;
  if (metrics.avgDeliveryTime !== null) {
    speedScore = Math.max(0, Math.min(100, 100 - ((metrics.avgDeliveryTime - 48) / 96) * 100));
  }

  // Reliability score (based on success rate)
  const reliabilityScore = metrics.deliverySuccessRate;

  // Return rate score (lower return rate = higher score)
  const returnRateScore = Math.max(0, 100 - metrics.returnRate * 5);

  // Overall score (weighted average)
  const overallScore = (speedScore * 0.3) + (reliabilityScore * 0.5) + (returnRateScore * 0.2);

  // Determine tier
  let tier: "excellent" | "good" | "average" | "poor";
  if (overallScore >= 85) tier = "excellent";
  else if (overallScore >= 70) tier = "good";
  else if (overallScore >= 50) tier = "average";
  else tier = "poor";

  return {
    carrier: metrics.carrier,
    speedScore: Math.round(speedScore),
    reliabilityScore: Math.round(reliabilityScore),
    returnRateScore: Math.round(returnRateScore),
    overallScore: Math.round(overallScore),
    tier,
  };
}

// ============================================
// Helper: Generate insights
// ============================================
function generateInsights(
  metrics: CarrierMetrics[],
  scores: CarrierScore[]
): CarrierInsight[] {
  const insights: CarrierInsight[] = [];

  // Benchmarks
  const avgDeliveryRate = metrics.reduce((sum, m) => sum + m.deliverySuccessRate, 0) / metrics.length;
  const avgReturnRate = metrics.reduce((sum, m) => sum + m.returnRate, 0) / metrics.length;
  const avgDeliveryTime = metrics
    .filter(m => m.avgDeliveryTime !== null)
    .reduce((sum, m) => sum + (m.avgDeliveryTime || 0), 0) / metrics.filter(m => m.avgDeliveryTime !== null).length;

  for (const m of metrics) {
    // High delivery success
    if (m.deliverySuccessRate > avgDeliveryRate + 10) {
      insights.push({
        type: "strength",
        carrier: m.carrier,
        metric: "delivery_success_rate",
        value: m.deliverySuccessRate,
        benchmark: avgDeliveryRate,
        message: `${m.carrier} يتفوق في معدل التوصيل الناجح (${m.deliverySuccessRate.toFixed(1)}% مقابل المتوسط ${avgDeliveryRate.toFixed(1)}%)`,
      });
    }

    // Low delivery success
    if (m.deliverySuccessRate < avgDeliveryRate - 10) {
      insights.push({
        type: "weakness",
        carrier: m.carrier,
        metric: "delivery_success_rate",
        value: m.deliverySuccessRate,
        benchmark: avgDeliveryRate,
        message: `${m.carrier} لديه معدل توصيل منخفض (${m.deliverySuccessRate.toFixed(1)}% مقابل المتوسط ${avgDeliveryRate.toFixed(1)}%)`,
      });
    }

    // High return rate
    if (m.returnRate > avgReturnRate + 5) {
      insights.push({
        type: "warning",
        carrier: m.carrier,
        metric: "return_rate",
        value: m.returnRate,
        benchmark: avgReturnRate,
        message: `${m.carrier} لديه معدل مرتجعات مرتفع (${m.returnRate.toFixed(1)}% مقابل المتوسط ${avgReturnRate.toFixed(1)}%)`,
      });
    }

    // Fast delivery
    if (m.avgDeliveryTime !== null && m.avgDeliveryTime < avgDeliveryTime - 12) {
      insights.push({
        type: "strength",
        carrier: m.carrier,
        metric: "delivery_time",
        value: m.avgDeliveryTime,
        benchmark: avgDeliveryTime,
        message: `${m.carrier} أسرع في التوصيل (${m.avgDeliveryTime.toFixed(1)} ساعة مقابل المتوسط ${avgDeliveryTime.toFixed(1)} ساعة)`,
      });
    }

    // Slow delivery
    if (m.avgDeliveryTime !== null && m.avgDeliveryTime > avgDeliveryTime + 24) {
      insights.push({
        type: "weakness",
        carrier: m.carrier,
        metric: "delivery_time",
        value: m.avgDeliveryTime,
        benchmark: avgDeliveryTime,
        message: `${m.carrier} بطيء في التوصيل (${m.avgDeliveryTime.toFixed(1)} ساعة مقابل المتوسط ${avgDeliveryTime.toFixed(1)} ساعة)`,
      });
    }
  }

  return insights;
}

// ============================================
// Helper: Generate routing recommendations
// ============================================
function generateRoutingRecommendations(
  scores: CarrierScore[],
  metrics: CarrierMetrics[]
): RoutingRecommendation[] {
  const recommendations: RoutingRecommendation[] = [];

  // Sort by overall score
  const sortedScores = [...scores].sort((a, b) => b.overallScore - a.overallScore);

  if (sortedScores.length === 0) return recommendations;

  // Best overall carrier
  const bestCarrier = sortedScores[0];
  recommendations.push({
    recommendedCarrier: bestCarrier.carrier,
    score: bestCarrier.overallScore,
    reason: `أفضل أداء عام (${bestCarrier.tier})`,
    alternativeCarriers: sortedScores.slice(1, 3).map(s => ({ carrier: s.carrier, score: s.overallScore })),
  });

  // Best for COD (highest reliability)
  const sortedByReliability = [...scores].sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  if (sortedByReliability[0]) {
    recommendations.push({
      paymentMethod: "cod",
      recommendedCarrier: sortedByReliability[0].carrier,
      score: sortedByReliability[0].reliabilityScore,
      reason: `أعلى معدل توصيل ناجح (${sortedByReliability[0].reliabilityScore}%)`,
      alternativeCarriers: sortedByReliability.slice(1, 3).map(s => ({ carrier: s.carrier, score: s.reliabilityScore })),
    });
  }

  // Best for prepaid (fastest)
  const sortedBySpeed = [...scores].sort((a, b) => b.speedScore - a.speedScore);
  if (sortedBySpeed[0]) {
    recommendations.push({
      paymentMethod: "prepaid",
      recommendedCarrier: sortedBySpeed[0].carrier,
      score: sortedBySpeed[0].speedScore,
      reason: `أسرع توصيل`,
      alternativeCarriers: sortedBySpeed.slice(1, 3).map(s => ({ carrier: s.carrier, score: s.speedScore })),
    });
  }

  return recommendations;
}

// ============================================
// Router
// ============================================
export const carrierPerformanceRouter = router({
  // ============================================
  // Get shipment timeline
  // ============================================
  getShipmentTimeline: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: shipment } = await supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("order_id", input.orderId)
        .eq("tenant_id", ctx.tenantId)
        .single();

      if (!shipment) return null;

      const events = (shipment.tracking_events as TrackingEvent[]) || [];
      return calculateTimeline(shipment, events);
    }),

  // ============================================
  // Get carrier metrics
  // ============================================
  getCarrierMetrics: tenantProcedure
    .input(z.object({
      carrier: z.string().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("tenant_id", ctx.tenantId);

      if (input.dateFrom) {
        query = query.gte("created_at", input.dateFrom);
      }
      if (input.dateTo) {
        query = query.lte("created_at", input.dateTo);
      }

      const { data: shipments } = await query;

      if (!shipments || shipments.length === 0) {
        return [];
      }

      // Calculate timelines
      const timelines: ShipmentTimeline[] = [];
      const carriers = new Set<string>();

      for (const shipment of shipments) {
        const events = (shipment.tracking_events as TrackingEvent[]) || [];
        if (events.length > 0) {
          const timeline = calculateTimeline(shipment, events);
          timelines.push(timeline);
          carriers.add(timeline.carrier);
        }
      }

      // Calculate metrics per carrier
      const metrics: CarrierMetrics[] = [];
      for (const carrier of Array.from(carriers)) {
        if (input.carrier && carrier !== input.carrier) continue;
        metrics.push(calculateCarrierMetrics(carrier, timelines));
      }

      return metrics;
    }),

  // ============================================
  // Get carrier scores
  // ============================================
  getCarrierScores: tenantProcedure
    .input(z.object({
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("tenant_id", ctx.tenantId);

      if (input.dateFrom) {
        query = query.gte("created_at", input.dateFrom);
      }
      if (input.dateTo) {
        query = query.lte("created_at", input.dateTo);
      }

      const { data: shipments } = await query;

      if (!shipments || shipments.length === 0) {
        return [];
      }

      // Calculate timelines
      const timelines: ShipmentTimeline[] = [];
      const carriers = new Set<string>();

      for (const shipment of shipments) {
        const events = (shipment.tracking_events as TrackingEvent[]) || [];
        if (events.length > 0) {
          const timeline = calculateTimeline(shipment, events);
          timelines.push(timeline);
          carriers.add(timeline.carrier);
        }
      }

      // Calculate metrics and scores
      const scores: CarrierScore[] = [];
      for (const carrier of Array.from(carriers)) {
        const metrics = calculateCarrierMetrics(carrier, timelines);
        scores.push(calculateCarrierScore(metrics));
      }

      return scores.sort((a, b) => b.overallScore - a.overallScore);
    }),

  // ============================================
  // Get carrier insights
  // ============================================
  getCarrierInsights: tenantProcedure
    .input(z.object({
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("tenant_id", ctx.tenantId);

      if (input.dateFrom) {
        query = query.gte("created_at", input.dateFrom);
      }
      if (input.dateTo) {
        query = query.lte("created_at", input.dateTo);
      }

      const { data: shipments } = await query;

      if (!shipments || shipments.length === 0) {
        return { insights: [], recommendations: [] };
      }

      // Calculate timelines
      const timelines: ShipmentTimeline[] = [];
      const carriers = new Set<string>();

      for (const shipment of shipments) {
        const events = (shipment.tracking_events as TrackingEvent[]) || [];
        if (events.length > 0) {
          const timeline = calculateTimeline(shipment, events);
          timelines.push(timeline);
          carriers.add(timeline.carrier);
        }
      }

      // Calculate metrics and scores
      const metrics: CarrierMetrics[] = [];
      const scores: CarrierScore[] = [];
      for (const carrier of Array.from(carriers)) {
        const m = calculateCarrierMetrics(carrier, timelines);
        metrics.push(m);
        scores.push(calculateCarrierScore(m));
      }

      // Generate insights and recommendations
      const insights = generateInsights(metrics, scores);
      const recommendations = generateRoutingRecommendations(scores, metrics);

      return { insights, recommendations };
    }),

  // ============================================
  // Get routing recommendations
  // ============================================
  getRoutingRecommendations: tenantProcedure
    .input(z.object({
      region: z.string().optional(),
      paymentMethod: z.enum(["cod", "prepaid"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { data: shipments } = await supabaseAdmin
        .from("shipments")
        .select("*")
        .eq("tenant_id", ctx.tenantId);

      if (!shipments || shipments.length === 0) {
        return [];
      }

      // Calculate timelines
      const timelines: ShipmentTimeline[] = [];
      const carriers = new Set<string>();

      for (const shipment of shipments) {
        const events = (shipment.tracking_events as TrackingEvent[]) || [];
        if (events.length > 0) {
          const timeline = calculateTimeline(shipment, events);
          timelines.push(timeline);
          carriers.add(timeline.carrier);
        }
      }

      // Calculate metrics and scores
      const metrics: CarrierMetrics[] = [];
      const scores: CarrierScore[] = [];
      for (const carrier of Array.from(carriers)) {
        const m = calculateCarrierMetrics(carrier, timelines);
        metrics.push(m);
        scores.push(calculateCarrierScore(m));
      }

      let recommendations = generateRoutingRecommendations(scores, metrics);

      // Filter by payment method if specified
      if (input.paymentMethod) {
        recommendations = recommendations.filter(
          r => !r.paymentMethod || r.paymentMethod === input.paymentMethod
        );
      }

      return recommendations;
    }),

  // ============================================
  // Get performance dashboard summary
  // ============================================
  getDashboardSummary: tenantProcedure.query(async ({ ctx }) => {
    const { data: shipments } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("tenant_id", ctx.tenantId);

    if (!shipments || shipments.length === 0) {
      return {
        totalShipments: 0,
        totalCarriers: 0,
        avgDeliveryRate: 0,
        avgDeliveryTime: null,
        topCarrier: null,
        worstCarrier: null,
        atRiskCount: 0,
      };
    }

    // Calculate timelines
    const timelines: ShipmentTimeline[] = [];
    const carriers = new Set<string>();

    for (const shipment of shipments) {
      const events = (shipment.tracking_events as TrackingEvent[]) || [];
      if (events.length > 0) {
        const timeline = calculateTimeline(shipment, events);
        timelines.push(timeline);
        carriers.add(timeline.carrier);
      }
    }

    // Calculate metrics and scores
    const metrics: CarrierMetrics[] = [];
    const scores: CarrierScore[] = [];
    for (const carrier of Array.from(carriers)) {
      const m = calculateCarrierMetrics(carrier, timelines);
      metrics.push(m);
      scores.push(calculateCarrierScore(m));
    }

    // Sort scores
    const sortedScores = scores.sort((a, b) => b.overallScore - a.overallScore);

    // Calculate averages
    const avgDeliveryRate = metrics.reduce((sum, m) => sum + m.deliverySuccessRate, 0) / metrics.length;
    const deliveryTimes = metrics.filter(m => m.avgDeliveryTime !== null).map(m => m.avgDeliveryTime!);
    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : null;

    // Count at-risk (in transit for too long)
    const atRiskCount = timelines.filter(t => {
      if (t.deliveryTime || t.returnedTime) return false;
      if (!t.assignmentTime) return false;
      const hoursSinceAssignment = (Date.now() - t.assignmentTime.getTime()) / (1000 * 60 * 60);
      return hoursSinceAssignment > 72;
    }).length;

    return {
      totalShipments: shipments.length,
      totalCarriers: carriers.size,
      avgDeliveryRate: Math.round(avgDeliveryRate),
      avgDeliveryTime: avgDeliveryTime ? Math.round(avgDeliveryTime) : null,
      topCarrier: sortedScores[0] || null,
      worstCarrier: sortedScores[sortedScores.length - 1] || null,
      atRiskCount,
    };
  }),
});
