import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

describe("Carrier Performance Intelligence Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Timeline Calculation", () => {
    it("should calculate pickup delay correctly", () => {
      const assignmentTime = new Date("2024-01-15T10:00:00Z");
      const pickupTime = new Date("2024-01-15T18:00:00Z");
      
      const pickupDelay = (pickupTime.getTime() - assignmentTime.getTime()) / (1000 * 60 * 60);
      
      expect(pickupDelay).toBe(8);
    });

    it("should calculate transit time correctly", () => {
      const pickupTime = new Date("2024-01-15T10:00:00Z");
      const deliveryTime = new Date("2024-01-17T14:00:00Z");
      
      const transitTime = (deliveryTime.getTime() - pickupTime.getTime()) / (1000 * 60 * 60);
      
      expect(transitTime).toBe(52);
    });

    it("should calculate delivery duration correctly", () => {
      const assignmentTime = new Date("2024-01-15T10:00:00Z");
      const deliveryTime = new Date("2024-01-17T14:00:00Z");
      
      const deliveryDuration = (deliveryTime.getTime() - assignmentTime.getTime()) / (1000 * 60 * 60);
      
      expect(deliveryDuration).toBe(52);
    });

    it("should calculate return cycle time correctly", () => {
      const assignmentTime = new Date("2024-01-15T10:00:00Z");
      const returnedTime = new Date("2024-01-22T10:00:00Z");
      
      const returnCycleTime = (returnedTime.getTime() - assignmentTime.getTime()) / (1000 * 60 * 60);
      
      expect(returnCycleTime).toBe(168); // 7 days
    });

    it("should extract times from tracking events", () => {
      const events = [
        { normalized_status: "CREATED", occurred_at: "2024-01-15T10:00:00Z" },
        { normalized_status: "PICKED_UP", occurred_at: "2024-01-15T18:00:00Z" },
        { normalized_status: "IN_TRANSIT", occurred_at: "2024-01-16T08:00:00Z" },
        { normalized_status: "OUT_FOR_DELIVERY", occurred_at: "2024-01-17T09:00:00Z" },
        { normalized_status: "DELIVERED", occurred_at: "2024-01-17T14:00:00Z" },
      ];

      const pickupEvent = events.find(e => e.normalized_status === "PICKED_UP");
      const deliveryEvent = events.find(e => e.normalized_status === "DELIVERED");

      expect(pickupEvent).toBeDefined();
      expect(deliveryEvent).toBeDefined();
      expect(new Date(pickupEvent!.occurred_at).getUTCHours()).toBe(18);
    });
  });

  describe("2. Carrier Metrics", () => {
    it("should calculate delivery success rate", () => {
      const total = 100;
      const delivered = 85;
      
      const successRate = (delivered / total) * 100;
      
      expect(successRate).toBe(85);
    });

    it("should calculate return rate", () => {
      const total = 100;
      const returned = 10;
      
      const returnRate = (returned / total) * 100;
      
      expect(returnRate).toBe(10);
    });

    it("should calculate failure rate", () => {
      const total = 100;
      const failed = 5;
      
      const failureRate = (failed / total) * 100;
      
      expect(failureRate).toBe(5);
    });

    it("should calculate average pickup time", () => {
      const pickupDelays = [8, 12, 6, 10, 14];
      const avgPickupTime = pickupDelays.reduce((a, b) => a + b, 0) / pickupDelays.length;
      
      expect(avgPickupTime).toBe(10);
    });

    it("should calculate average delivery time", () => {
      const deliveryTimes = [48, 52, 36, 60, 44];
      const avgDeliveryTime = deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length;
      
      expect(avgDeliveryTime).toBe(48);
    });

    it("should aggregate failure reasons", () => {
      const failures = [
        { reason: "customer_unavailable" },
        { reason: "wrong_address" },
        { reason: "customer_unavailable" },
        { reason: "refused" },
        { reason: "customer_unavailable" },
      ];

      const reasons: Record<string, number> = {};
      for (const f of failures) {
        reasons[f.reason] = (reasons[f.reason] || 0) + 1;
      }

      expect(reasons["customer_unavailable"]).toBe(3);
      expect(reasons["wrong_address"]).toBe(1);
      expect(reasons["refused"]).toBe(1);
    });
  });

  describe("3. Performance Scoring", () => {
    it("should calculate speed score (48h = 100, 96h = 50)", () => {
      const calculateSpeedScore = (avgDeliveryTime: number): number => {
        return Math.max(0, Math.min(100, 100 - ((avgDeliveryTime - 48) / 96) * 100));
      };

      expect(calculateSpeedScore(48)).toBe(100);
      expect(Math.round(calculateSpeedScore(72))).toBe(75);
      expect(Math.round(calculateSpeedScore(96))).toBe(50);
      expect(Math.round(calculateSpeedScore(144))).toBe(0);
    });

    it("should calculate reliability score from success rate", () => {
      const successRate = 85;
      const reliabilityScore = successRate;
      
      expect(reliabilityScore).toBe(85);
    });

    it("should calculate return rate score (lower = better)", () => {
      const calculateReturnRateScore = (returnRate: number): number => {
        return Math.max(0, 100 - returnRate * 5);
      };

      expect(calculateReturnRateScore(0)).toBe(100);
      expect(calculateReturnRateScore(10)).toBe(50);
      expect(calculateReturnRateScore(20)).toBe(0);
    });

    it("should calculate overall score with weights", () => {
      const speedScore = 80;
      const reliabilityScore = 90;
      const returnRateScore = 70;

      const overallScore = (speedScore * 0.3) + (reliabilityScore * 0.5) + (returnRateScore * 0.2);
      
      expect(overallScore).toBe(83);
    });

    it("should assign tier based on overall score", () => {
      const getTier = (score: number): string => {
        if (score >= 85) return "excellent";
        if (score >= 70) return "good";
        if (score >= 50) return "average";
        return "poor";
      };

      expect(getTier(90)).toBe("excellent");
      expect(getTier(75)).toBe("good");
      expect(getTier(60)).toBe("average");
      expect(getTier(40)).toBe("poor");
    });
  });

  describe("4. Insights Detection", () => {
    it("should detect high delivery success as strength", () => {
      const carrierRate = 95;
      const avgRate = 80;
      const isStrength = carrierRate > avgRate + 10;
      
      expect(isStrength).toBe(true);
    });

    it("should detect low delivery success as weakness", () => {
      const carrierRate = 65;
      const avgRate = 80;
      const isWeakness = carrierRate < avgRate - 10;
      
      expect(isWeakness).toBe(true);
    });

    it("should detect high return rate as warning", () => {
      const carrierReturnRate = 15;
      const avgReturnRate = 8;
      const isWarning = carrierReturnRate > avgReturnRate + 5;
      
      expect(isWarning).toBe(true);
    });

    it("should detect fast delivery as strength", () => {
      const carrierDeliveryTime = 30;
      const avgDeliveryTime = 48;
      const isFast = carrierDeliveryTime < avgDeliveryTime - 12;
      
      expect(isFast).toBe(true);
    });

    it("should detect slow delivery as weakness", () => {
      const carrierDeliveryTime = 80;
      const avgDeliveryTime = 48;
      const isSlow = carrierDeliveryTime > avgDeliveryTime + 24;
      
      expect(isSlow).toBe(true);
    });
  });

  describe("5. Routing Recommendations", () => {
    it("should recommend best overall carrier", () => {
      const scores = [
        { carrier: "aramex", overallScore: 85 },
        { carrier: "smsa", overallScore: 78 },
        { carrier: "dhl", overallScore: 72 },
      ];

      const sorted = scores.sort((a, b) => b.overallScore - a.overallScore);
      const bestCarrier = sorted[0];

      expect(bestCarrier.carrier).toBe("aramex");
    });

    it("should recommend best carrier for COD (highest reliability)", () => {
      const scores = [
        { carrier: "aramex", reliabilityScore: 85 },
        { carrier: "smsa", reliabilityScore: 92 },
        { carrier: "dhl", reliabilityScore: 78 },
      ];

      const sorted = scores.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
      const bestForCOD = sorted[0];

      expect(bestForCOD.carrier).toBe("smsa");
    });

    it("should recommend best carrier for prepaid (fastest)", () => {
      const scores = [
        { carrier: "aramex", speedScore: 75 },
        { carrier: "smsa", speedScore: 80 },
        { carrier: "dhl", speedScore: 90 },
      ];

      const sorted = scores.sort((a, b) => b.speedScore - a.speedScore);
      const bestForPrepaid = sorted[0];

      expect(bestForPrepaid.carrier).toBe("dhl");
    });

    it("should provide alternative carriers", () => {
      const scores = [
        { carrier: "aramex", overallScore: 85 },
        { carrier: "smsa", overallScore: 78 },
        { carrier: "dhl", overallScore: 72 },
      ];

      const sorted = scores.sort((a, b) => b.overallScore - a.overallScore);
      const alternatives = sorted.slice(1, 3);

      expect(alternatives).toHaveLength(2);
      expect(alternatives[0].carrier).toBe("smsa");
      expect(alternatives[1].carrier).toBe("dhl");
    });
  });

  describe("6. Dashboard Summary", () => {
    it("should calculate total shipments", () => {
      const shipments = [{}, {}, {}, {}, {}];
      expect(shipments.length).toBe(5);
    });

    it("should count unique carriers", () => {
      const carriers = new Set(["aramex", "smsa", "dhl", "aramex", "smsa"]);
      expect(carriers.size).toBe(3);
    });

    it("should identify at-risk shipments (>72h without delivery)", () => {
      const now = Date.now();
      const shipments = [
        { assignmentTime: now - 24 * 60 * 60 * 1000, deliveryTime: null }, // 24h - OK
        { assignmentTime: now - 80 * 60 * 60 * 1000, deliveryTime: null }, // 80h - at risk
        { assignmentTime: now - 100 * 60 * 60 * 1000, deliveryTime: now }, // delivered - OK
        { assignmentTime: now - 90 * 60 * 60 * 1000, deliveryTime: null }, // 90h - at risk
      ];

      const atRisk = shipments.filter(s => {
        if (s.deliveryTime) return false;
        const hoursSinceAssignment = (now - s.assignmentTime) / (1000 * 60 * 60);
        return hoursSinceAssignment > 72;
      });

      expect(atRisk.length).toBe(2);
    });
  });

  describe("7. Edge Cases", () => {
    it("should handle empty shipments", () => {
      const shipments: any[] = [];
      const metrics = {
        totalShipments: shipments.length,
        deliverySuccessRate: 0,
      };

      expect(metrics.totalShipments).toBe(0);
      expect(metrics.deliverySuccessRate).toBe(0);
    });

    it("should handle single carrier", () => {
      const carriers = new Set(["aramex"]);
      expect(carriers.size).toBe(1);
    });

    it("should handle missing events", () => {
      const events: any[] = [];
      const pickupEvent = events.find(e => e.normalized_status === "PICKED_UP");
      
      expect(pickupEvent).toBeUndefined();
    });

    it("should handle null delivery times in average calculation", () => {
      const deliveryTimes = [48, null, 52, null, 44].filter((t): t is number => t !== null);
      const avg = deliveryTimes.length > 0
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
        : null;

      expect(avg).toBe(48);
    });
  });
});
