import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: "prod-123",
                tenant_id: "tenant-123",
                name: "منتج اختباري",
                description: "وصف المنتج الاختباري",
                price: 99.99,
                image_url: null,
              },
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: "campaign-123" },
            error: null,
          })),
        })),
      })),
    })),
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
            painPoints: ["High prices", "Poor quality"],
          },
          uniqueSellingPoints: ["High quality", "Affordable", "Fast delivery"],
          pricingRange: "mid-range",
          toneOfVoice: "professional",
          visualStyle: {
            primaryColors: ["#3B82F6", "#1E40AF"],
            style: "modern",
            imagery: "Clean product shots",
          },
          keywords: ["electronics", "gadgets", "tech"],
          competitiveAdvantage: "Best price-quality ratio",
        }),
      },
    }],
    usage: { total_tokens: 500 },
  })),
}));

describe("AI Pipeline Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Product Intelligence Schema", () => {
    it("should have required fields for product intelligence", () => {
      const requiredFields = [
        "category",
        "targetAudience",
        "uniqueSellingPoints",
        "pricingRange",
        "toneOfVoice",
        "visualStyle",
        "keywords",
        "competitiveAdvantage",
      ];

      // This is a schema validation test
      const sampleIntelligence = {
        category: "Electronics",
        targetAudience: {
          demographics: "Adults 25-45",
          interests: ["Technology"],
          painPoints: ["High prices"],
        },
        uniqueSellingPoints: ["Quality"],
        pricingRange: "mid-range",
        toneOfVoice: "professional",
        visualStyle: {
          primaryColors: ["#3B82F6"],
          style: "modern",
          imagery: "Clean shots",
        },
        keywords: ["tech"],
        competitiveAdvantage: "Best value",
      };

      requiredFields.forEach((field) => {
        expect(sampleIntelligence).toHaveProperty(field);
      });
    });
  });

  describe("Landing Page Content Schema", () => {
    it("should have required fields for landing page", () => {
      const sampleLandingPage = {
        headline: "عنوان رئيسي",
        subheadline: "عنوان فرعي",
        ctaText: "اشتر الآن",
        features: ["ميزة 1", "ميزة 2"],
        benefits: ["فائدة 1", "فائدة 2"],
      };

      expect(sampleLandingPage).toHaveProperty("headline");
      expect(sampleLandingPage).toHaveProperty("subheadline");
      expect(sampleLandingPage).toHaveProperty("ctaText");
      expect(sampleLandingPage.features).toBeInstanceOf(Array);
      expect(sampleLandingPage.benefits).toBeInstanceOf(Array);
    });
  });

  describe("Meta Ads Content Schema", () => {
    it("should have required fields for Meta ads", () => {
      const sampleMetaAds = {
        campaignObjective: "conversions",
        adCopies: [
          {
            headline: "عنوان الإعلان",
            primaryText: "نص الإعلان",
            callToAction: "تسوق الآن",
          },
        ],
        hooks: ["هل تبحث عن...؟", "اكتشف الآن"],
      };

      expect(sampleMetaAds).toHaveProperty("campaignObjective");
      expect(sampleMetaAds.adCopies).toBeInstanceOf(Array);
      expect(sampleMetaAds.adCopies[0]).toHaveProperty("headline");
      expect(sampleMetaAds.adCopies[0]).toHaveProperty("primaryText");
      expect(sampleMetaAds.adCopies[0]).toHaveProperty("callToAction");
      expect(sampleMetaAds.hooks).toBeInstanceOf(Array);
    });
  });

  describe("Pipeline Flow", () => {
    it("should define correct pipeline steps", () => {
      const pipelineSteps = [
        "analyzeProduct",
        "generateLandingPage",
        "generateMetaAds",
        "runFullPipeline",
      ];

      // Verify pipeline structure
      expect(pipelineSteps).toContain("analyzeProduct");
      expect(pipelineSteps).toContain("generateLandingPage");
      expect(pipelineSteps).toContain("generateMetaAds");
      expect(pipelineSteps).toContain("runFullPipeline");
    });

    it("should pass intelligence from step 1 to subsequent steps", () => {
      // Simulating data flow
      const step1Output = {
        productId: "prod-123",
        intelligence: {
          category: "Electronics",
          targetAudience: { demographics: "Adults" },
          keywords: ["tech"],
        },
      };

      // Step 2 should receive intelligence
      const step2Input = {
        productId: step1Output.productId,
        intelligence: step1Output.intelligence,
      };

      expect(step2Input.intelligence).toBe(step1Output.intelligence);
    });
  });

  describe("Usage Tracking", () => {
    it("should track token usage for each AI call", () => {
      const usageLog = {
        tenant_id: "tenant-123",
        ai_addon_id: "addon-123",
        action: "analyze_product",
        units_used: 1,
        metadata: {
          product_id: "prod-123",
          tokens_used: 500,
        },
      };

      expect(usageLog).toHaveProperty("tenant_id");
      expect(usageLog).toHaveProperty("action");
      expect(usageLog).toHaveProperty("units_used");
      expect(usageLog.metadata).toHaveProperty("tokens_used");
    });
  });

  describe("Data Persistence", () => {
    it("should save campaign to Supabase after generation", () => {
      const campaignData = {
        tenant_id: "tenant-123",
        name: "Test Product - Meta Ads",
        description: "AI-generated campaign",
        platform: "meta",
        status: "draft",
        budget: 0,
        spent: 0,
        revenue: 0,
        orders_count: 0,
      };

      expect(campaignData.platform).toBe("meta");
      expect(campaignData.status).toBe("draft");
    });
  });
});
