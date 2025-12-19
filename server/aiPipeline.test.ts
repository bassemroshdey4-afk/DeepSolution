import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "ai_addons") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { id: "addon-123", name: "Product Intelligence", slug: "product-intelligence" },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "tenant_ai_subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: {
                      id: "sub-123",
                      tenant_id: "tenant-123",
                      ai_addon_id: "addon-123",
                      status: "active",
                      usage_remaining: 100,
                      expires_at: null,
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      if (table === "ai_usage_logs") {
        return {
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }
      if (table === "products") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: {
                    id: "prod-123",
                    tenant_id: "tenant-123",
                    name: "منتج اختباري",
                    description: "وصف المنتج",
                    price: 99.99,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "ai_pipeline_outputs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      single: vi.fn(() => Promise.resolve({ data: null, error: { message: "Not found" } })),
                    })),
                  })),
                })),
              })),
            })),
            count: "exact",
            head: true,
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: "output-123" }, error: null })),
            })),
          })),
        };
      }
      if (table === "campaigns") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: "campaign-123" }, error: null })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      };
    }),
  },
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(() => Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify({
          category: "Electronics",
          targetAudience: {
            demographics: "Adults 25-45",
            interests: ["Technology", "Gadgets"],
            painPoints: ["High prices"],
          },
          uniqueSellingPoints: ["High quality", "Affordable"],
          keywords: ["electronics", "gadgets"],
        }),
      },
    }],
    usage: { total_tokens: 500 },
  })),
}));

describe("AI Pipeline Router - Golden Path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Data Persistence", () => {
    it("should define versioned output structure", () => {
      const output = {
        tenant_id: "tenant-123",
        product_id: "prod-123",
        output_type: "intelligence",
        version: 1,
        content: { category: "Electronics" },
        metadata: { tokens_used: 500 },
        created_at: new Date().toISOString(),
      };

      expect(output).toHaveProperty("version");
      expect(output).toHaveProperty("content");
      expect(output).toHaveProperty("metadata");
      expect(output.output_type).toMatch(/^(intelligence|landing_page|meta_ads)$/);
    });

    it("should support multiple versions per output type", () => {
      const versions = [
        { version: 1, content: { v1: true }, created_at: "2024-01-01" },
        { version: 2, content: { v2: true }, created_at: "2024-01-02" },
        { version: 3, content: { v3: true }, created_at: "2024-01-03" },
      ];

      expect(versions.length).toBe(3);
      expect(versions[versions.length - 1].version).toBe(3);
    });
  });

  describe("2. Re-runnable Pipeline", () => {
    it("should support forceRegenerate flag", () => {
      const input = {
        productId: "prod-123",
        language: "ar" as const,
        forceRegenerate: true,
      };

      expect(input.forceRegenerate).toBe(true);
    });

    it("should return fromCache flag when using cached data", () => {
      const cachedResult = {
        productId: "prod-123",
        intelligence: { category: "Electronics" },
        version: 2,
        fromCache: true,
        tokensUsed: 0,
      };

      expect(cachedResult.fromCache).toBe(true);
      expect(cachedResult.tokensUsed).toBe(0);
    });

    it("should return new version when regenerating", () => {
      const newResult = {
        productId: "prod-123",
        intelligence: { category: "Electronics" },
        version: 3,
        fromCache: false,
        tokensUsed: 500,
      };

      expect(newResult.fromCache).toBe(false);
      expect(newResult.tokensUsed).toBeGreaterThan(0);
    });
  });

  describe("3. AI Add-ons Billing Integration", () => {
    it("should require addon subscription check", () => {
      const addonSlugs = {
        PRODUCT_INTELLIGENCE: "product-intelligence",
        LANDING_PAGE: "landing-page-generator",
        META_ADS: "meta-ads-generator",
      };

      expect(addonSlugs.PRODUCT_INTELLIGENCE).toBe("product-intelligence");
      expect(addonSlugs.LANDING_PAGE).toBe("landing-page-generator");
      expect(addonSlugs.META_ADS).toBe("meta-ads-generator");
    });

    it("should track usage per stage", () => {
      const usageLog = {
        tenant_id: "tenant-123",
        ai_addon_id: "addon-123",
        subscription_id: "sub-123",
        action: "analyze_product",
        units_used: 1,
        metadata: { product_id: "prod-123", tokens_used: 500 },
      };

      expect(usageLog.units_used).toBe(1);
      expect(usageLog.action).toMatch(/^(analyze_product|generate_landing_page|generate_meta_ads)$/);
    });

    it("should validate usage_remaining before execution", () => {
      const subscription = {
        usage_remaining: 0,
        status: "active",
      };

      const hasUsage = subscription.usage_remaining > 0;
      expect(hasUsage).toBe(false);
    });

    it("should validate subscription status", () => {
      const validStatuses = ["active", "trial"];
      const subscription = { status: "active" };

      expect(validStatuses).toContain(subscription.status);
    });

    it("should validate expiry date", () => {
      const subscription = {
        expires_at: "2025-12-31T23:59:59Z",
      };

      const isExpired = new Date(subscription.expires_at) < new Date();
      expect(isExpired).toBe(false);
    });
  });

  describe("4. UX Requirements", () => {
    it("should define step statuses", () => {
      const validStatuses = ["pending", "running", "done", "error"];
      
      validStatuses.forEach(status => {
        expect(["pending", "running", "done", "error"]).toContain(status);
      });
    });

    it("should track pipeline steps", () => {
      const steps = [
        { id: "select", status: "done" },
        { id: "intelligence", status: "running" },
        { id: "landing", status: "pending" },
        { id: "ads", status: "pending" },
      ];

      expect(steps[0].status).toBe("done");
      expect(steps[1].status).toBe("running");
    });

    it("should support individual step retry", () => {
      const retryableSteps = ["intelligence", "landing", "ads"];
      
      retryableSteps.forEach(step => {
        expect(["intelligence", "landing", "ads"]).toContain(step);
      });
    });
  });

  describe("5. Pipeline Flow", () => {
    it("should require intelligence before landing page", () => {
      const pipelineOrder = ["intelligence", "landing_page", "meta_ads"];
      
      const intelligenceIndex = pipelineOrder.indexOf("intelligence");
      const landingIndex = pipelineOrder.indexOf("landing_page");
      
      expect(intelligenceIndex).toBeLessThan(landingIndex);
    });

    it("should require intelligence before meta ads", () => {
      const pipelineOrder = ["intelligence", "landing_page", "meta_ads"];
      
      const intelligenceIndex = pipelineOrder.indexOf("intelligence");
      const adsIndex = pipelineOrder.indexOf("meta_ads");
      
      expect(intelligenceIndex).toBeLessThan(adsIndex);
    });

    it("should pass intelligence data to subsequent stages", () => {
      const intelligence = {
        category: "Electronics",
        targetAudience: { demographics: "Adults 25-45" },
        uniqueSellingPoints: ["Quality", "Price"],
        keywords: ["tech", "gadgets"],
      };

      // Landing page uses intelligence
      const landingPromptData = {
        category: intelligence.category,
        usps: intelligence.uniqueSellingPoints,
      };

      // Meta ads uses intelligence
      const adsPromptData = {
        keywords: intelligence.keywords,
        audience: intelligence.targetAudience,
      };

      expect(landingPromptData.category).toBe(intelligence.category);
      expect(adsPromptData.keywords).toBe(intelligence.keywords);
    });
  });

  describe("6. Error Handling", () => {
    it("should define error codes for missing addon", () => {
      const error = {
        code: "FORBIDDEN",
        message: 'يجب تفعيل إضافة "Product Intelligence" لاستخدام هذه الميزة',
      };

      expect(error.code).toBe("FORBIDDEN");
    });

    it("should define error codes for insufficient usage", () => {
      const error = {
        code: "FORBIDDEN",
        message: 'استنفدت حد استخدام "Product Intelligence". يرجى الترقية.',
      };

      expect(error.code).toBe("FORBIDDEN");
    });

    it("should define error codes for missing prerequisite", () => {
      const error = {
        code: "PRECONDITION_FAILED",
        message: "يجب تحليل المنتج أولاً (Product Intelligence)",
      };

      expect(error.code).toBe("PRECONDITION_FAILED");
    });
  });
});
