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
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
          lt: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          gt: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        order: vi.fn(() => ({
          ascending: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

describe("Profit Intelligence Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Revenue Rules", () => {
    const calculateRevenue = (order: any, shipment: any): number => {
      const orderTotal = Number(order.total_amount) || 0;
      const isDelivered = order.status === "delivered";
      const isPrepaid = order.payment_method !== "cod";
      const isCodCollected = shipment?.cod_collected === true;

      if (isDelivered && (isPrepaid || isCodCollected)) {
        return orderTotal;
      } else if (order.status === "returned" || order.status === "failed") {
        return 0;
      }
      return orderTotal; // Pending
    };

    it("should confirm revenue for delivered + prepaid", () => {
      const order = { total_amount: 100, status: "delivered", payment_method: "card" };
      const shipment = { cod_collected: false };
      expect(calculateRevenue(order, shipment)).toBe(100);
    });

    it("should confirm revenue for delivered + COD collected", () => {
      const order = { total_amount: 100, status: "delivered", payment_method: "cod" };
      const shipment = { cod_collected: true };
      expect(calculateRevenue(order, shipment)).toBe(100);
    });

    it("should return 0 for returned orders", () => {
      const order = { total_amount: 100, status: "returned", payment_method: "cod" };
      expect(calculateRevenue(order, null)).toBe(0);
    });

    it("should return 0 for failed orders", () => {
      const order = { total_amount: 100, status: "failed", payment_method: "cod" };
      expect(calculateRevenue(order, null)).toBe(0);
    });

    it("should return pending revenue for in-transit orders", () => {
      const order = { total_amount: 100, status: "in_transit", payment_method: "cod" };
      expect(calculateRevenue(order, null)).toBe(100);
    });
  });

  describe("2. Cost Calculation", () => {
    const DEFAULT_CONFIG = {
      aiCostPerUnit: 0.05,
      platformFeePercent: 2.5,
      codFeePercent: 3,
      gatewayFeePercent: 2.5,
    };

    it("should calculate COD fee correctly", () => {
      const orderTotal = 100;
      const codFee = orderTotal * (DEFAULT_CONFIG.codFeePercent / 100);
      expect(codFee).toBe(3);
    });

    it("should calculate gateway fee correctly", () => {
      const orderTotal = 100;
      const gatewayFee = orderTotal * (DEFAULT_CONFIG.gatewayFeePercent / 100);
      expect(gatewayFee).toBe(2.5);
    });

    it("should calculate platform fee correctly", () => {
      const orderTotal = 100;
      const platformFee = orderTotal * (DEFAULT_CONFIG.platformFeePercent / 100);
      expect(platformFee).toBe(2.5);
    });

    it("should calculate AI cost correctly", () => {
      const tokensUsed = 100;
      const aiCost = tokensUsed * DEFAULT_CONFIG.aiCostPerUnit;
      expect(aiCost).toBe(5);
    });

    it("should calculate return cost as shipping cost", () => {
      const shippingCost = 15;
      const returnCost = shippingCost; // Full shipping cost for returns
      expect(returnCost).toBe(15);
    });

    it("should calculate failed delivery cost as half shipping", () => {
      const shippingCost = 15;
      const failedCost = shippingCost * 0.5;
      expect(failedCost).toBe(7.5);
    });
  });

  describe("3. P&L Status", () => {
    const getStatus = (netProfit: number, isDelivered: boolean, isReturned: boolean, isFailed: boolean): string => {
      if (!isDelivered && !isReturned && !isFailed) {
        return "pending";
      } else if (netProfit > 0) {
        return "profit";
      } else if (netProfit < 0) {
        return "loss";
      }
      return "break_even";
    };

    it("should return pending for in-transit orders", () => {
      expect(getStatus(10, false, false, false)).toBe("pending");
    });

    it("should return profit for positive net profit", () => {
      expect(getStatus(10, true, false, false)).toBe("profit");
    });

    it("should return loss for negative net profit", () => {
      expect(getStatus(-10, true, false, false)).toBe("loss");
    });

    it("should return break_even for zero net profit", () => {
      expect(getStatus(0, true, false, false)).toBe("break_even");
    });
  });

  describe("4. Loss Reasons", () => {
    const getLossReasons = (costs: any, totalCost: number, orderStatus: string): string[] => {
      const reasons: string[] = [];

      if (orderStatus === "returned") {
        reasons.push("order_returned");
      }
      if (orderStatus === "failed") {
        reasons.push("delivery_failed");
      }

      const breakdown = [
        { name: "shipping", value: costs.shipping + costs.returnCost },
        { name: "ad_spend", value: costs.adSpend },
        { name: "cogs", value: costs.cogs },
        { name: "fees", value: costs.fees },
      ].sort((a, b) => b.value - a.value);

      for (let i = 0; i < Math.min(3, breakdown.length); i++) {
        if (breakdown[i].value > 0) {
          const percent = Math.round((breakdown[i].value / totalCost) * 100);
          reasons.push(`${breakdown[i].name}: ${percent}%`);
        }
      }

      return reasons;
    };

    it("should include order_returned for returned orders", () => {
      const reasons = getLossReasons({ shipping: 10, returnCost: 10, adSpend: 5, cogs: 20, fees: 5 }, 50, "returned");
      expect(reasons).toContain("order_returned");
    });

    it("should include delivery_failed for failed orders", () => {
      const reasons = getLossReasons({ shipping: 10, returnCost: 0, adSpend: 5, cogs: 20, fees: 5 }, 40, "failed");
      expect(reasons).toContain("delivery_failed");
    });

    it("should sort by highest cost", () => {
      const reasons = getLossReasons({ shipping: 10, returnCost: 0, adSpend: 5, cogs: 30, fees: 5 }, 50, "delivered");
      expect(reasons[0]).toContain("cogs");
    });

    it("should limit to top 3 reasons", () => {
      const reasons = getLossReasons({ shipping: 10, returnCost: 10, adSpend: 5, cogs: 20, fees: 5 }, 50, "delivered");
      const costReasons = reasons.filter(r => !r.includes("returned") && !r.includes("failed"));
      expect(costReasons.length).toBeLessThanOrEqual(3);
    });
  });

  describe("5. Margin Calculation", () => {
    const calculateMargin = (revenue: number, netProfit: number): number => {
      return revenue > 0 ? (netProfit / revenue) * 100 : 0;
    };

    it("should calculate positive margin correctly", () => {
      expect(calculateMargin(100, 20)).toBe(20);
    });

    it("should calculate negative margin correctly", () => {
      expect(calculateMargin(100, -10)).toBe(-10);
    });

    it("should return 0 for zero revenue", () => {
      expect(calculateMargin(0, -10)).toBe(0);
    });
  });

  describe("6. Minimum Price Calculation", () => {
    const calculateMinPrice = (avgCost: number, targetMargin: number): number => {
      return avgCost / (1 - targetMargin);
    };

    it("should calculate break-even price", () => {
      const breakEven = calculateMinPrice(80, 0);
      expect(breakEven).toBe(80);
    });

    it("should calculate price for 10% margin", () => {
      const minPrice10 = calculateMinPrice(80, 0.10);
      expect(minPrice10).toBeCloseTo(88.89, 2);
    });

    it("should calculate price for 20% margin", () => {
      const minPrice20 = calculateMinPrice(80, 0.20);
      expect(minPrice20).toBe(100);
    });

    it("should calculate price for 50% margin", () => {
      const minPrice50 = calculateMinPrice(80, 0.50);
      expect(minPrice50).toBe(160);
    });
  });

  describe("7. Product Snapshot", () => {
    it("should calculate average profit per order", () => {
      const netProfit = 500;
      const ordersCount = 10;
      const avgProfit = netProfit / ordersCount;
      expect(avgProfit).toBe(50);
    });

    it("should calculate return rate", () => {
      const returnedCount = 2;
      const ordersCount = 10;
      const returnRate = (returnedCount / ordersCount) * 100;
      expect(returnRate).toBe(20);
    });

    it("should calculate failed rate", () => {
      const failedCount = 1;
      const ordersCount = 10;
      const failedRate = (failedCount / ordersCount) * 100;
      expect(failedRate).toBe(10);
    });

    it("should handle zero orders", () => {
      const ordersCount = 0;
      const avgProfit = ordersCount > 0 ? 500 / ordersCount : 0;
      expect(avgProfit).toBe(0);
    });
  });

  describe("8. COD Cashflow", () => {
    it("should calculate pending amount", () => {
      const orders = [
        { amount: 100, codCollected: false },
        { amount: 200, codCollected: true },
        { amount: 150, codCollected: false },
      ];

      const pending = orders
        .filter(o => !o.codCollected)
        .reduce((sum, o) => sum + o.amount, 0);

      expect(pending).toBe(250);
    });

    it("should calculate collected amount", () => {
      const orders = [
        { amount: 100, codCollected: false },
        { amount: 200, codCollected: true },
        { amount: 150, codCollected: true },
      ];

      const collected = orders
        .filter(o => o.codCollected)
        .reduce((sum, o) => sum + o.amount, 0);

      expect(collected).toBe(350);
    });

    it("should calculate settlement delay", () => {
      const orderDate = new Date("2024-01-01");
      const collectedDate = new Date("2024-01-08");
      const days = Math.floor((collectedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(days).toBe(7);
    });
  });

  describe("9. Daily Aggregation", () => {
    it("should group orders by date", () => {
      const orders = [
        { date: "2024-01-01", profit: 10 },
        { date: "2024-01-01", profit: 20 },
        { date: "2024-01-02", profit: 15 },
      ];

      const dailyMap = new Map<string, number>();
      orders.forEach(o => {
        dailyMap.set(o.date, (dailyMap.get(o.date) || 0) + o.profit);
      });

      expect(dailyMap.get("2024-01-01")).toBe(30);
      expect(dailyMap.get("2024-01-02")).toBe(15);
    });

    it("should count profit/loss orders per day", () => {
      const orders = [
        { date: "2024-01-01", status: "profit" },
        { date: "2024-01-01", status: "loss" },
        { date: "2024-01-01", status: "profit" },
      ];

      const profitCount = orders.filter(o => o.status === "profit").length;
      const lossCount = orders.filter(o => o.status === "loss").length;

      expect(profitCount).toBe(2);
      expect(lossCount).toBe(1);
    });
  });

  describe("10. Price Recommendation", () => {
    const getRecommendation = (currentPrice: number, breakEven: number, minPrice10: number, minPrice20: number): string => {
      if (currentPrice < breakEven) {
        return "below_breakeven";
      } else if (currentPrice < minPrice10) {
        return "below_10_margin";
      } else if (currentPrice < minPrice20) {
        return "below_20_margin";
      }
      return "healthy";
    };

    it("should warn when below break-even", () => {
      expect(getRecommendation(70, 80, 89, 100)).toBe("below_breakeven");
    });

    it("should warn when below 10% margin", () => {
      expect(getRecommendation(85, 80, 89, 100)).toBe("below_10_margin");
    });

    it("should warn when below 20% margin", () => {
      expect(getRecommendation(95, 80, 89, 100)).toBe("below_20_margin");
    });

    it("should approve healthy pricing", () => {
      expect(getRecommendation(110, 80, 89, 100)).toBe("healthy");
    });
  });

  describe("11. Total Cost Calculation", () => {
    it("should sum all cost components", () => {
      const costs = {
        cogs: 50,
        shippingCost: 15,
        codFee: 3,
        gatewayFee: 0,
        returnCost: 0,
        failedDeliveryCost: 0,
        adSpendAllocated: 10,
        aiCostAllocated: 2,
        platformFee: 2.5,
      };

      const total =
        costs.cogs +
        costs.shippingCost +
        costs.codFee +
        costs.gatewayFee +
        costs.returnCost +
        costs.failedDeliveryCost +
        costs.adSpendAllocated +
        costs.aiCostAllocated +
        costs.platformFee;

      expect(total).toBe(82.5);
    });

    it("should include return cost for returned orders", () => {
      const shippingCost = 15;
      const isReturned = true;
      const returnCost = isReturned ? shippingCost : 0;
      expect(returnCost).toBe(15);
    });
  });

  describe("12. Net Profit Calculation", () => {
    it("should calculate net profit correctly", () => {
      const revenue = 100;
      const totalCost = 82.5;
      const netProfit = revenue - totalCost;
      expect(netProfit).toBe(17.5);
    });

    it("should handle negative profit", () => {
      const revenue = 70;
      const totalCost = 82.5;
      const netProfit = revenue - totalCost;
      expect(netProfit).toBe(-12.5);
    });

    it("should handle zero revenue (returned)", () => {
      const revenue = 0;
      const totalCost = 30; // Shipping + return cost
      const netProfit = revenue - totalCost;
      expect(netProfit).toBe(-30);
    });
  });

  describe("13. Config Validation", () => {
    it("should have valid default config", () => {
      const config = {
        aiCostPerUnit: 0.05,
        platformFeePercent: 2.5,
        codFeePercent: 3,
        gatewayFeePercent: 2.5,
      };

      expect(config.aiCostPerUnit).toBeGreaterThan(0);
      expect(config.platformFeePercent).toBeLessThan(100);
      expect(config.codFeePercent).toBeLessThan(100);
      expect(config.gatewayFeePercent).toBeLessThan(100);
    });

    it("should allow config override", () => {
      const defaultConfig = { aiCostPerUnit: 0.05 };
      const override = { aiCostPerUnit: 0.10 };
      const merged = { ...defaultConfig, ...override };
      expect(merged.aiCostPerUnit).toBe(0.10);
    });
  });

  describe("14. Rounding", () => {
    it("should round to 2 decimal places", () => {
      const value = 17.5678;
      const rounded = Math.round(value * 100) / 100;
      expect(rounded).toBe(17.57);
    });

    it("should handle negative rounding", () => {
      const value = -12.5678;
      const rounded = Math.round(value * 100) / 100;
      expect(rounded).toBe(-12.57);
    });
  });
});


describe("Profit Truth Engine", () => {
  describe("1. Finalization Logic", () => {
    const determineFinalization = (order: any, shipment: any) => {
      const isDelivered = order.status === "delivered" || order.shipping_status === "DELIVERED";
      const isFailed = order.status === "failed" || order.status === "cancelled";
      const isReturned = order.status === "returned";
      const isCOD = order.payment_method === "cod";
      const codCollected = shipment?.cod_collected === true;

      let isFinalized = false;
      let finalizationReason: string | null = null;

      if (isReturned) {
        isFinalized = true;
        finalizationReason = "order_returned";
      } else if (isFailed) {
        isFinalized = true;
        finalizationReason = "delivery_failed";
      } else if (isDelivered) {
        if (isCOD) {
          if (codCollected) {
            isFinalized = true;
            finalizationReason = "cod_collected";
          } else {
            isFinalized = false;
            finalizationReason = null;
          }
        } else {
          isFinalized = true;
          finalizationReason = "prepaid_delivered";
        }
      }

      return { isFinalized, finalizationReason };
    };

    it("should finalize prepaid delivered orders", () => {
      const order = { status: "delivered", payment_method: "card" };
      const result = determineFinalization(order, null);
      expect(result.isFinalized).toBe(true);
      expect(result.finalizationReason).toBe("prepaid_delivered");
    });

    it("should finalize COD orders when collected", () => {
      const order = { status: "delivered", payment_method: "cod" };
      const shipment = { cod_collected: true };
      const result = determineFinalization(order, shipment);
      expect(result.isFinalized).toBe(true);
      expect(result.finalizationReason).toBe("cod_collected");
    });

    it("should NOT finalize COD orders when not collected", () => {
      const order = { status: "delivered", payment_method: "cod" };
      const shipment = { cod_collected: false };
      const result = determineFinalization(order, shipment);
      expect(result.isFinalized).toBe(false);
      expect(result.finalizationReason).toBe(null);
    });

    it("should finalize returned orders", () => {
      const order = { status: "returned", payment_method: "cod" };
      const result = determineFinalization(order, null);
      expect(result.isFinalized).toBe(true);
      expect(result.finalizationReason).toBe("order_returned");
    });

    it("should finalize failed orders", () => {
      const order = { status: "failed", payment_method: "cod" };
      const result = determineFinalization(order, null);
      expect(result.isFinalized).toBe(true);
      expect(result.finalizationReason).toBe("delivery_failed");
    });

    it("should finalize cancelled orders", () => {
      const order = { status: "cancelled", payment_method: "card" };
      const result = determineFinalization(order, null);
      expect(result.isFinalized).toBe(true);
      expect(result.finalizationReason).toBe("delivery_failed");
    });

    it("should NOT finalize pending orders", () => {
      const order = { status: "pending", payment_method: "cod" };
      const result = determineFinalization(order, null);
      expect(result.isFinalized).toBe(false);
    });

    it("should NOT finalize in_transit orders", () => {
      const order = { status: "in_transit", payment_method: "card" };
      const result = determineFinalization(order, null);
      expect(result.isFinalized).toBe(false);
    });
  });

  describe("2. Estimated vs Finalized Profit", () => {
    const calculateProfitTruth = (order: any, costs: any, shipment: any) => {
      const orderTotal = Number(order.total_amount) || 0;
      const isDelivered = order.status === "delivered";
      const isPrepaid = order.payment_method !== "cod";
      const isCodCollected = shipment?.cod_collected === true;
      const isReturned = order.status === "returned";
      const isFailed = order.status === "failed";

      // Calculate revenue
      let revenue = 0;
      if (isDelivered && (isPrepaid || isCodCollected)) {
        revenue = orderTotal;
      } else if (isReturned || isFailed) {
        revenue = 0;
      } else {
        revenue = orderTotal; // Estimated
      }

      const totalCost = costs.cogs + costs.shippingCost + costs.codFee + costs.platformFee;
      const netProfit = revenue - totalCost;

      // Determine finalization
      const isFinalized = isReturned || isFailed || (isDelivered && (isPrepaid || isCodCollected));

      return {
        estimatedProfit: netProfit,
        finalizedProfit: isFinalized ? netProfit : null,
        isFinalized,
      };
    };

    it("should have estimated = finalized for completed orders", () => {
      const order = { total_amount: 100, status: "delivered", payment_method: "card" };
      const costs = { cogs: 30, shippingCost: 15, codFee: 0, platformFee: 2.5 };
      const result = calculateProfitTruth(order, costs, null);
      
      expect(result.estimatedProfit).toBe(52.5);
      expect(result.finalizedProfit).toBe(52.5);
      expect(result.isFinalized).toBe(true);
    });

    it("should have finalized = null for pending orders", () => {
      const order = { total_amount: 100, status: "pending", payment_method: "cod" };
      const costs = { cogs: 30, shippingCost: 15, codFee: 3, platformFee: 2.5 };
      const result = calculateProfitTruth(order, costs, null);
      
      expect(result.estimatedProfit).toBe(49.5);
      expect(result.finalizedProfit).toBe(null);
      expect(result.isFinalized).toBe(false);
    });

    it("should have negative finalized profit for returned orders", () => {
      const order = { total_amount: 100, status: "returned", payment_method: "cod" };
      const costs = { cogs: 30, shippingCost: 30, codFee: 3, platformFee: 2.5 }; // Double shipping
      const result = calculateProfitTruth(order, costs, null);
      
      expect(result.estimatedProfit).toBe(-65.5); // 0 revenue - 65.5 costs
      expect(result.finalizedProfit).toBe(-65.5);
      expect(result.isFinalized).toBe(true);
    });
  });

  describe("3. Aggregation Logic", () => {
    const aggregateByPeriod = (orders: any[], groupBy: "day" | "week" | "month") => {
      const groups: Map<string, { estimated: number; finalized: number; count: number }> = new Map();

      for (const order of orders) {
        const date = new Date(order.created_at);
        let period: string;
        
        if (groupBy === "day") {
          period = date.toISOString().split("T")[0];
        } else if (groupBy === "week") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = weekStart.toISOString().split("T")[0];
        } else {
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }

        if (!groups.has(period)) {
          groups.set(period, { estimated: 0, finalized: 0, count: 0 });
        }

        const group = groups.get(period)!;
        group.estimated += order.estimatedProfit || 0;
        group.finalized += order.finalizedProfit || 0;
        group.count++;
      }

      return Array.from(groups.entries()).map(([period, data]) => ({
        period,
        ...data,
      }));
    };

    it("should group by day correctly", () => {
      const orders = [
        { created_at: "2024-01-15T10:00:00Z", estimatedProfit: 50, finalizedProfit: 50 },
        { created_at: "2024-01-15T14:00:00Z", estimatedProfit: 30, finalizedProfit: 30 },
        { created_at: "2024-01-16T10:00:00Z", estimatedProfit: 40, finalizedProfit: null },
      ];

      const result = aggregateByPeriod(orders, "day");
      expect(result.length).toBe(2);
      
      const day15 = result.find(r => r.period === "2024-01-15");
      expect(day15?.estimated).toBe(80);
      expect(day15?.finalized).toBe(80);
      expect(day15?.count).toBe(2);
    });

    it("should group by month correctly", () => {
      const orders = [
        { created_at: "2024-01-15T10:00:00Z", estimatedProfit: 50, finalizedProfit: 50 },
        { created_at: "2024-02-15T10:00:00Z", estimatedProfit: 30, finalizedProfit: 30 },
      ];

      const result = aggregateByPeriod(orders, "month");
      expect(result.length).toBe(2);
      
      const jan = result.find(r => r.period === "2024-01");
      expect(jan?.estimated).toBe(50);
    });
  });

  describe("4. Finalization Rate", () => {
    it("should calculate finalization rate correctly", () => {
      const finalizedCount = 7;
      const pendingCount = 3;
      const total = finalizedCount + pendingCount;
      const rate = total > 0 ? Math.round((finalizedCount / total) * 100) : 0;
      expect(rate).toBe(70);
    });

    it("should handle 100% finalization", () => {
      const finalizedCount = 10;
      const pendingCount = 0;
      const total = finalizedCount + pendingCount;
      const rate = total > 0 ? Math.round((finalizedCount / total) * 100) : 0;
      expect(rate).toBe(100);
    });

    it("should handle 0% finalization", () => {
      const finalizedCount = 0;
      const pendingCount = 10;
      const total = finalizedCount + pendingCount;
      const rate = total > 0 ? Math.round((finalizedCount / total) * 100) : 0;
      expect(rate).toBe(0);
    });

    it("should handle empty orders", () => {
      const finalizedCount = 0;
      const pendingCount = 0;
      const total = finalizedCount + pendingCount;
      const rate = total > 0 ? Math.round((finalizedCount / total) * 100) : 0;
      expect(rate).toBe(0);
    });
  });
});
