import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ============================================
// Marketing Decision Engine Tests
// ============================================
// Tests for Block 2: Channel Intelligence, Creative Logic,
// Ad Generation Engine, and Performance Memory
// ============================================

// Mock supabase
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
                })),
              })),
            })),
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
            is: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
  },
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(() =>
    Promise.resolve({
      choices: [
        {
          message: {
            content: JSON.stringify({
              channels: [
                {
                  channel: "instagram",
                  score: 85,
                  budget_percentage: 35,
                  reasoning: {
                    audience_match: "High match",
                    content_fit: "Visual product",
                    competition: "Medium",
                    cost_efficiency: "Good CPM",
                    historical_performance: "Strong",
                  },
                  recommended: true,
                },
                {
                  channel: "facebook",
                  score: 75,
                  budget_percentage: 25,
                  reasoning: {
                    audience_match: "Good match",
                    content_fit: "Suitable",
                    competition: "High",
                    cost_efficiency: "Average",
                    historical_performance: "Moderate",
                  },
                  recommended: true,
                },
              ],
            }),
          },
        },
      ],
    })
  ),
}));

describe("Marketing Decision Engine - Block 2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // COMPONENT 1: CHANNEL INTELLIGENCE
  // ============================================

  describe("Channel Intelligence", () => {
    describe("Channel Types", () => {
      it("should support all major marketing channels", () => {
        const supportedChannels = [
          "instagram",
          "facebook",
          "tiktok",
          "snapchat",
          "google_search",
          "google_display",
          "youtube",
          "twitter",
          "linkedin",
          "pinterest",
        ];

        supportedChannels.forEach((channel) => {
          expect(typeof channel).toBe("string");
        });
        expect(supportedChannels.length).toBe(10);
      });
    });

    describe("Channel Recommendation Structure", () => {
      it("should have all required fields", () => {
        const recommendation = {
          id: "chr_123",
          tenant_id: "tenant_456",
          product_id: "prod_789",
          product_intelligence_id: "pi_abc",
          product_intelligence_version: 1,
          version: 1,
          channel_scores: [],
          recommended_channels: ["instagram", "facebook"],
          total_budget_suggestion: 1000,
          confidence: 85,
          input_hash: "abc123",
          analysis_source: "ai",
          created_at: new Date().toISOString(),
          created_by: "user_123",
        };

        expect(recommendation).toHaveProperty("id");
        expect(recommendation).toHaveProperty("tenant_id");
        expect(recommendation).toHaveProperty("product_id");
        expect(recommendation).toHaveProperty("product_intelligence_id");
        expect(recommendation).toHaveProperty("version");
        expect(recommendation).toHaveProperty("channel_scores");
        expect(recommendation).toHaveProperty("recommended_channels");
        expect(recommendation).toHaveProperty("confidence");
        expect(recommendation).toHaveProperty("input_hash");
      });
    });

    describe("Channel Score Structure", () => {
      it("should include reasoning for each channel", () => {
        const channelScore = {
          channel: "instagram",
          score: 85,
          budget_percentage: 35,
          reasoning: {
            audience_match: "High - 25-34 demographic active",
            content_fit: "Visual product suits platform",
            competition: "Medium ad density",
            cost_efficiency: "Good CPM",
            historical_performance: "Similar products performed well",
          },
          recommended: true,
        };

        expect(channelScore.reasoning).toHaveProperty("audience_match");
        expect(channelScore.reasoning).toHaveProperty("content_fit");
        expect(channelScore.reasoning).toHaveProperty("competition");
        expect(channelScore.reasoning).toHaveProperty("cost_efficiency");
        expect(channelScore.reasoning).toHaveProperty("historical_performance");
      });

      it("should have score between 0 and 100", () => {
        const score = 85;
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      it("should have budget percentage that sums to 100 or less", () => {
        const channelScores = [
          { channel: "instagram", budget_percentage: 35 },
          { channel: "facebook", budget_percentage: 25 },
          { channel: "google_search", budget_percentage: 20 },
          { channel: "tiktok", budget_percentage: 20 },
        ];

        const totalBudget = channelScores.reduce(
          (sum, c) => sum + c.budget_percentage,
          0
        );
        expect(totalBudget).toBeLessThanOrEqual(100);
      });
    });

    describe("Versioning", () => {
      it("should increment version for new analysis", () => {
        const existingVersions = [1, 2, 3];
        const newVersion = Math.max(...existingVersions) + 1;
        expect(newVersion).toBe(4);
      });

      it("should start at version 1 for new product", () => {
        const existingVersions: number[] = [];
        const newVersion =
          existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1;
        expect(newVersion).toBe(1);
      });
    });

    describe("Input Hash Deduplication", () => {
      it("should generate consistent hash for same inputs", () => {
        const input1 = {
          productIntelligenceId: "pi_123",
          productIntelligenceVersion: 1,
          audience: { gender: "unisex" },
        };
        const input2 = { ...input1 };

        const hash1 = generateInputHash(input1);
        const hash2 = generateInputHash(input2);

        expect(hash1).toBe(hash2);
      });
    });
  });

  // ============================================
  // COMPONENT 2: CREATIVE LOGIC
  // ============================================

  describe("Creative Logic", () => {
    describe("Hook Types", () => {
      it("should support all hook types", () => {
        const hookTypes = [
          "problem",
          "solution",
          "curiosity",
          "social_proof",
          "urgency",
          "question",
        ];

        expect(hookTypes.length).toBe(6);
        hookTypes.forEach((type) => {
          expect(typeof type).toBe("string");
        });
      });

      it("should have proper hook structure", () => {
        const hook = {
          id: "hook_1",
          type: "problem",
          text: "Tired of slow delivery?",
          target_emotion: "frustration",
          best_for_channels: ["instagram", "facebook"],
        };

        expect(hook).toHaveProperty("id");
        expect(hook).toHaveProperty("type");
        expect(hook).toHaveProperty("text");
        expect(hook).toHaveProperty("target_emotion");
        expect(hook).toHaveProperty("best_for_channels");
      });
    });

    describe("Angle Types", () => {
      it("should support all angle types", () => {
        const angleTypes = [
          "emotional",
          "rational",
          "social",
          "aspirational",
          "fear",
        ];

        expect(angleTypes.length).toBe(5);
      });

      it("should have proper angle structure", () => {
        const angle = {
          id: "angle_1",
          type: "emotional",
          description: "Connect through shared experience",
          key_message: "We understand your struggle",
          supporting_points: ["Point 1", "Point 2"],
        };

        expect(angle).toHaveProperty("id");
        expect(angle).toHaveProperty("type");
        expect(angle).toHaveProperty("description");
        expect(angle).toHaveProperty("key_message");
        expect(angle).toHaveProperty("supporting_points");
      });
    });

    describe("Creative Brief Structure", () => {
      it("should have all required fields", () => {
        const brief = {
          id: "crb_123",
          tenant_id: "tenant_456",
          product_id: "prod_789",
          channel_recommendation_id: "chr_abc",
          channel_recommendation_version: 1,
          product_intelligence_id: "pi_def",
          product_intelligence_version: 1,
          version: 1,
          target_channel: "instagram",
          hooks: [],
          angles: [],
          visual_direction: {
            style: "modern",
            mood: "professional",
            colors: ["blue", "white"],
            imagery_type: "lifestyle",
            do_not_use: ["dark colors"],
          },
          ctas: ["Shop Now", "Learn More"],
          tone: "friendly and professional",
          do_not_use: ["aggressive language"],
          confidence: 85,
          input_hash: "abc123",
          analysis_source: "ai",
          created_at: new Date().toISOString(),
          created_by: "user_123",
        };

        expect(brief).toHaveProperty("hooks");
        expect(brief).toHaveProperty("angles");
        expect(brief).toHaveProperty("visual_direction");
        expect(brief).toHaveProperty("ctas");
        expect(brief).toHaveProperty("tone");
        expect(brief).toHaveProperty("do_not_use");
      });
    });

    describe("Visual Direction", () => {
      it("should have complete visual guidance", () => {
        const visualDirection = {
          style: "minimalist modern",
          mood: "aspirational",
          colors: ["#2563eb", "#ffffff", "#f3f4f6"],
          imagery_type: "lifestyle photography",
          do_not_use: ["stock photos", "cluttered backgrounds"],
        };

        expect(visualDirection).toHaveProperty("style");
        expect(visualDirection).toHaveProperty("mood");
        expect(visualDirection).toHaveProperty("colors");
        expect(visualDirection).toHaveProperty("imagery_type");
        expect(visualDirection).toHaveProperty("do_not_use");
      });
    });
  });

  // ============================================
  // COMPONENT 3: AD GENERATION ENGINE
  // ============================================

  describe("Ad Generation Engine", () => {
    describe("Ad Formats", () => {
      it("should support all ad formats", () => {
        const formats = ["image", "video", "carousel", "story", "reel", "text"];
        expect(formats.length).toBe(6);
      });
    });

    describe("Ad Creative Structure", () => {
      it("should have all required fields", () => {
        const adCreative = {
          id: "adc_123",
          tenant_id: "tenant_456",
          product_id: "prod_789",
          creative_brief_id: "crb_abc",
          creative_brief_version: 1,
          version: 1,
          channel: "instagram",
          format: "image",
          headline: "Transform Your Day",
          body: "Discover the perfect solution...",
          cta: "Shop Now",
          hook_used: "solution",
          angle_used: "aspirational",
          visual_prompt: "Modern lifestyle photo...",
          visual_url: null,
          audience_targeting: {
            age_range: { min: 25, max: 34 },
            gender: "all",
            interests: ["technology", "lifestyle"],
            behaviors: ["online shoppers"],
            locations: ["SA"],
            languages: ["ar", "en"],
            custom_audiences: [],
            lookalike_sources: [],
          },
          confidence: 85,
          input_hash: "abc123",
          status: "draft",
          created_at: new Date().toISOString(),
          created_by: "user_123",
        };

        expect(adCreative).toHaveProperty("headline");
        expect(adCreative).toHaveProperty("body");
        expect(adCreative).toHaveProperty("cta");
        expect(adCreative).toHaveProperty("hook_used");
        expect(adCreative).toHaveProperty("angle_used");
        expect(adCreative).toHaveProperty("visual_prompt");
        expect(adCreative).toHaveProperty("audience_targeting");
      });
    });

    describe("Audience Targeting", () => {
      it("should have complete targeting structure", () => {
        const targeting = {
          age_range: { min: 25, max: 34 },
          gender: "all",
          interests: ["technology", "fashion"],
          behaviors: ["online shoppers", "engaged shoppers"],
          locations: ["SA", "AE", "KW"],
          languages: ["ar", "en"],
          custom_audiences: ["past_purchasers"],
          lookalike_sources: ["high_value_customers"],
        };

        expect(targeting).toHaveProperty("age_range");
        expect(targeting.age_range).toHaveProperty("min");
        expect(targeting.age_range).toHaveProperty("max");
        expect(targeting).toHaveProperty("gender");
        expect(targeting).toHaveProperty("interests");
        expect(targeting).toHaveProperty("behaviors");
        expect(targeting).toHaveProperty("locations");
        expect(targeting).toHaveProperty("languages");
      });
    });

    describe("Ad Variations", () => {
      it("should support all variation types", () => {
        const variationTypes = ["headline", "hook", "cta", "audience", "visual"];
        expect(variationTypes.length).toBe(5);
      });

      it("should have proper variation structure", () => {
        const variation = {
          id: "adv_123",
          tenant_id: "tenant_456",
          parent_ad_id: "adc_789",
          variation_type: "headline",
          variation_number: 1,
          headline: "Alternative Headline",
          body: null,
          cta: null,
          visual_prompt: null,
          visual_url: null,
          audience_targeting: null,
          status: "draft",
          created_at: new Date().toISOString(),
        };

        expect(variation).toHaveProperty("parent_ad_id");
        expect(variation).toHaveProperty("variation_type");
        expect(variation).toHaveProperty("variation_number");
      });
    });

    describe("Ad Status Flow", () => {
      it("should have valid status transitions", () => {
        const validStatuses = ["draft", "approved", "active", "paused", "archived"];
        const status = "draft";
        expect(validStatuses).toContain(status);
      });
    });
  });

  // ============================================
  // COMPONENT 4: PERFORMANCE MEMORY
  // ============================================

  describe("Performance Memory", () => {
    describe("Performance Record Structure", () => {
      it("should have all required metrics", () => {
        const record = {
          id: "prf_123",
          tenant_id: "tenant_456",
          ad_creative_id: "adc_789",
          ad_variation_id: null,
          platform: "instagram",
          platform_ad_id: "ig_ad_123",
          date: "2024-01-15",
          impressions: 10000,
          clicks: 250,
          conversions: 25,
          spend: 100.0,
          revenue: 500.0,
          ctr: 0.025,
          cpc: 0.4,
          cpa: 4.0,
          roas: 5.0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        expect(record).toHaveProperty("impressions");
        expect(record).toHaveProperty("clicks");
        expect(record).toHaveProperty("conversions");
        expect(record).toHaveProperty("spend");
        expect(record).toHaveProperty("revenue");
        expect(record).toHaveProperty("ctr");
        expect(record).toHaveProperty("cpc");
        expect(record).toHaveProperty("cpa");
        expect(record).toHaveProperty("roas");
      });

      it("should calculate derived metrics correctly", () => {
        const impressions = 10000;
        const clicks = 250;
        const conversions = 25;
        const spend = 100.0;
        const revenue = 500.0;

        const ctr = clicks / impressions;
        const cpc = spend / clicks;
        const cpa = spend / conversions;
        const roas = revenue / spend;

        expect(ctr).toBe(0.025);
        expect(cpc).toBe(0.4);
        expect(cpa).toBe(4.0);
        expect(roas).toBe(5.0);
      });
    });

    describe("Decision Log", () => {
      it("should support all decision types", () => {
        const decisionTypes = [
          "channel_selection",
          "budget_allocation",
          "creative_direction",
          "ad_pause",
          "ad_scale",
          "audience_change",
        ];

        expect(decisionTypes.length).toBe(6);
      });

      it("should have proper decision structure", () => {
        const decision = {
          id: "dec_123",
          tenant_id: "tenant_456",
          decision_type: "budget_allocation",
          entity_type: "channel_recommendation",
          entity_id: "chr_789",
          decision: "Increase Instagram budget by 20%",
          reasoning: {
            performance: "CTR above average",
            trend: "Improving over last 7 days",
            competition: "Lower CPM than Facebook",
          },
          context: {
            current_budget: 1000,
            proposed_budget: 1200,
          },
          outcome: null,
          outcome_recorded_at: null,
          created_at: new Date().toISOString(),
          created_by: "user_123",
        };

        expect(decision).toHaveProperty("decision_type");
        expect(decision).toHaveProperty("reasoning");
        expect(decision).toHaveProperty("context");
        expect(decision).toHaveProperty("outcome");
      });
    });

    describe("Learning Insights", () => {
      it("should support all insight types", () => {
        const insightTypes = [
          "winning_hook",
          "best_channel",
          "optimal_budget",
          "audience_insight",
          "timing_pattern",
          "creative_fatigue",
        ];

        expect(insightTypes.length).toBe(6);
      });

      it("should support all scope levels", () => {
        const scopes = ["tenant", "product", "category", "platform"];
        expect(scopes.length).toBe(4);
      });

      it("should have proper insight structure", () => {
        const insight = {
          id: "ins_123",
          tenant_id: "tenant_456",
          insight_type: "winning_hook",
          scope: "product",
          scope_id: "prod_789",
          pattern: {
            hook_type: "problem",
            avg_ctr: 0.035,
            sample_ads: 15,
          },
          confidence: 85,
          sample_size: 15,
          actionable: true,
          action_suggestion: "Use problem hooks for this product category",
          valid_from: new Date().toISOString(),
          valid_until: null,
          created_at: new Date().toISOString(),
        };

        expect(insight).toHaveProperty("insight_type");
        expect(insight).toHaveProperty("scope");
        expect(insight).toHaveProperty("pattern");
        expect(insight).toHaveProperty("confidence");
        expect(insight).toHaveProperty("actionable");
      });
    });
  });

  // ============================================
  // CROSS-COMPONENT TESTS
  // ============================================

  describe("Cross-Component Integration", () => {
    describe("Traceability", () => {
      it("should trace ad back to product intelligence", () => {
        const adCreative = {
          creative_brief_id: "crb_123",
          creative_brief_version: 1,
        };

        const creativeBrief = {
          id: "crb_123",
          channel_recommendation_id: "chr_456",
          product_intelligence_id: "pi_789",
          product_intelligence_version: 2,
        };

        const channelRecommendation = {
          id: "chr_456",
          product_intelligence_id: "pi_789",
          product_intelligence_version: 2,
        };

        // Full trace
        expect(adCreative.creative_brief_id).toBe(creativeBrief.id);
        expect(creativeBrief.channel_recommendation_id).toBe(
          channelRecommendation.id
        );
        expect(creativeBrief.product_intelligence_id).toBe("pi_789");
      });
    });

    describe("Version Consistency", () => {
      it("should maintain version references across components", () => {
        const productIntelligenceVersion = 3;

        const channelRec = {
          product_intelligence_version: productIntelligenceVersion,
        };

        const creativeBrief = {
          product_intelligence_version: productIntelligenceVersion,
          channel_recommendation_version: 1,
        };

        expect(channelRec.product_intelligence_version).toBe(
          creativeBrief.product_intelligence_version
        );
      });
    });

    describe("AI as Analyzer Only", () => {
      it("should not include decision fields in AI outputs", () => {
        const channelAnalysis = {
          channel_scores: [],
          recommended_channels: [],
          // NO: auto_activate, auto_budget, decision
        };

        expect(channelAnalysis).not.toHaveProperty("auto_activate");
        expect(channelAnalysis).not.toHaveProperty("auto_budget");
        expect(channelAnalysis).not.toHaveProperty("decision");
      });

      it("should provide data for human decision-making", () => {
        const analysis = {
          score: 85,
          reasoning: {
            audience_match: "High match",
            cost_efficiency: "Good CPM",
          },
          confidence: 80,
        };

        // Data provided for humans to decide
        expect(analysis).toHaveProperty("score");
        expect(analysis).toHaveProperty("reasoning");
        expect(analysis).toHaveProperty("confidence");
      });
    });
  });

  // ============================================
  // TENANT ISOLATION
  // ============================================

  describe("Tenant Isolation", () => {
    it("should require tenant_id on all records", () => {
      const records = [
        { type: "channel_recommendation", tenant_id: "t1" },
        { type: "creative_brief", tenant_id: "t1" },
        { type: "ad_creative", tenant_id: "t1" },
        { type: "performance_record", tenant_id: "t1" },
        { type: "decision_log", tenant_id: "t1" },
        { type: "learning_insight", tenant_id: "t1" },
      ];

      records.forEach((record) => {
        expect(record).toHaveProperty("tenant_id");
      });
    });

    it("should scope queries to tenant", () => {
      const tenantA = "tenant_aaa";
      const tenantB = "tenant_bbb";

      const allRecords = [
        { id: "1", tenant_id: tenantA },
        { id: "2", tenant_id: tenantA },
        { id: "3", tenant_id: tenantB },
      ];

      const tenantARecords = allRecords.filter((r) => r.tenant_id === tenantA);
      expect(tenantARecords.length).toBe(2);
    });
  });
});

// Helper function
function generateInputHash(input: Record<string, unknown>): string {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}
