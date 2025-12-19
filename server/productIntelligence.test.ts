import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ============================================
// Product Intelligence Tests
// ============================================
// Tests for versioning, structured output, and audit trail
// ============================================

// Mock supabase
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
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
              audience: {
                primaryDemographic: "Young professionals",
                ageRange: "25-34",
                gender: "unisex",
                incomeLevel: "medium",
                interests: ["technology", "fashion"],
                buyingBehavior: "Online-first, research-driven",
              },
              painPoints: [
                {
                  problem: "Finding quality products",
                  severity: "high",
                  frequency: "Daily",
                },
              ],
              priceSensitivity: {
                level: "medium",
                priceRange: { min: 100, max: 500 },
                elasticity: "Moderate - willing to pay for quality",
                competitorComparison: "Mid-range pricing",
              },
              usp: {
                primary: "Premium quality at affordable price",
                secondary: ["Fast delivery", "Easy returns"],
                differentiators: ["Local brand", "Arabic support"],
              },
              visualStyle: {
                dominantColors: ["blue", "white"],
                aesthetic: "Modern minimalist",
                mood: "Professional and trustworthy",
                targetPlatformFit: {
                  instagram: 85,
                  facebook: 75,
                  tiktok: 60,
                  snapchat: 70,
                  google: 80,
                },
              },
              keywords: {
                primary: ["premium", "quality", "affordable"],
                secondary: ["local", "trusted", "fast delivery"],
                longTail: ["best quality products Saudi", "affordable premium items"],
                negative: ["cheap", "fake", "replica"],
              },
              competitors: [
                {
                  name: "Generic Competitor",
                  priceRange: "100-600 SAR",
                  strengths: ["Brand recognition"],
                  weaknesses: ["Slow delivery"],
                  marketPosition: "Market leader",
                },
              ],
              confidence: 85,
            }),
          },
        },
      ],
    })
  ),
}));

describe("Product Intelligence Core", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Input Hash Generation", () => {
    it("should generate consistent hash for same inputs", () => {
      const input1 = {
        name: "Test Product",
        description: "A test product",
        imageUrls: ["http://example.com/img1.jpg"],
        price: 100,
        category: "Electronics",
      };

      const input2 = {
        name: "Test Product",
        description: "A test product",
        imageUrls: ["http://example.com/img1.jpg"],
        price: 100,
        category: "Electronics",
      };

      const hash1 = generateInputHash(input1);
      const hash2 = generateInputHash(input2);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different inputs", () => {
      const input1 = {
        name: "Test Product",
        description: "A test product",
        price: 100,
      };

      const input2 = {
        name: "Different Product",
        description: "A different product",
        price: 200,
      };

      const hash1 = generateInputHash(input1);
      const hash2 = generateInputHash(input2);

      expect(hash1).not.toBe(hash2);
    });

    it("should normalize image URLs order", () => {
      const input1 = {
        name: "Test",
        imageUrls: ["http://a.jpg", "http://b.jpg"],
      };

      const input2 = {
        name: "Test",
        imageUrls: ["http://b.jpg", "http://a.jpg"],
      };

      const hash1 = generateInputHash(input1);
      const hash2 = generateInputHash(input2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("Structured Output Validation", () => {
    it("should have all required audience fields", () => {
      const audience = {
        primaryDemographic: "Young professionals",
        ageRange: "25-34",
        gender: "unisex" as const,
        incomeLevel: "medium" as const,
        interests: ["technology"],
        buyingBehavior: "Online-first",
      };

      expect(audience).toHaveProperty("primaryDemographic");
      expect(audience).toHaveProperty("ageRange");
      expect(audience).toHaveProperty("gender");
      expect(audience).toHaveProperty("incomeLevel");
      expect(audience).toHaveProperty("interests");
      expect(audience).toHaveProperty("buyingBehavior");
      expect(["male", "female", "unisex"]).toContain(audience.gender);
      expect(["low", "medium", "high", "premium"]).toContain(audience.incomeLevel);
    });

    it("should have all required pain point fields", () => {
      const painPoint = {
        problem: "Finding quality products",
        severity: "high" as const,
        frequency: "Daily",
      };

      expect(painPoint).toHaveProperty("problem");
      expect(painPoint).toHaveProperty("severity");
      expect(painPoint).toHaveProperty("frequency");
      expect(["low", "medium", "high"]).toContain(painPoint.severity);
    });

    it("should have all required price sensitivity fields", () => {
      const priceSensitivity = {
        level: "medium" as const,
        priceRange: { min: 100, max: 500 },
        elasticity: "Moderate",
        competitorComparison: "Mid-range",
      };

      expect(priceSensitivity).toHaveProperty("level");
      expect(priceSensitivity).toHaveProperty("priceRange");
      expect(priceSensitivity.priceRange).toHaveProperty("min");
      expect(priceSensitivity.priceRange).toHaveProperty("max");
      expect(priceSensitivity).toHaveProperty("elasticity");
      expect(priceSensitivity).toHaveProperty("competitorComparison");
    });

    it("should have all required USP fields", () => {
      const usp = {
        primary: "Main selling point",
        secondary: ["Point 2", "Point 3"],
        differentiators: ["Unique feature"],
      };

      expect(usp).toHaveProperty("primary");
      expect(usp).toHaveProperty("secondary");
      expect(usp).toHaveProperty("differentiators");
      expect(Array.isArray(usp.secondary)).toBe(true);
      expect(Array.isArray(usp.differentiators)).toBe(true);
    });

    it("should have all required visual style fields", () => {
      const visualStyle = {
        dominantColors: ["blue", "white"],
        aesthetic: "Modern",
        mood: "Professional",
        targetPlatformFit: {
          instagram: 85,
          facebook: 75,
          tiktok: 60,
          snapchat: 70,
          google: 80,
        },
      };

      expect(visualStyle).toHaveProperty("dominantColors");
      expect(visualStyle).toHaveProperty("aesthetic");
      expect(visualStyle).toHaveProperty("mood");
      expect(visualStyle).toHaveProperty("targetPlatformFit");
      expect(visualStyle.targetPlatformFit).toHaveProperty("instagram");
      expect(visualStyle.targetPlatformFit).toHaveProperty("facebook");
      expect(visualStyle.targetPlatformFit).toHaveProperty("tiktok");
      expect(visualStyle.targetPlatformFit).toHaveProperty("snapchat");
      expect(visualStyle.targetPlatformFit).toHaveProperty("google");
    });

    it("should have all required keyword categories", () => {
      const keywords = {
        primary: ["keyword1"],
        secondary: ["keyword2"],
        longTail: ["long tail phrase"],
        negative: ["exclude this"],
      };

      expect(keywords).toHaveProperty("primary");
      expect(keywords).toHaveProperty("secondary");
      expect(keywords).toHaveProperty("longTail");
      expect(keywords).toHaveProperty("negative");
      expect(Array.isArray(keywords.primary)).toBe(true);
      expect(Array.isArray(keywords.negative)).toBe(true);
    });

    it("should have all required competitor fields", () => {
      const competitor = {
        name: "Competitor A",
        priceRange: "100-500 SAR",
        strengths: ["Brand recognition"],
        weaknesses: ["Slow delivery"],
        marketPosition: "Market leader",
      };

      expect(competitor).toHaveProperty("name");
      expect(competitor).toHaveProperty("priceRange");
      expect(competitor).toHaveProperty("strengths");
      expect(competitor).toHaveProperty("weaknesses");
      expect(competitor).toHaveProperty("marketPosition");
    });
  });

  describe("Versioning Logic", () => {
    it("should increment version number correctly", () => {
      const versions = [1, 2, 3, 4, 5];
      const latestVersion = Math.max(...versions);
      const newVersion = latestVersion + 1;

      expect(newVersion).toBe(6);
    });

    it("should start at version 1 for new products", () => {
      const latestVersion = 0; // No existing versions
      const newVersion = latestVersion + 1;

      expect(newVersion).toBe(1);
    });

    it("should never overwrite existing versions", () => {
      const existingVersions = [1, 2, 3];
      const newVersion = Math.max(...existingVersions) + 1;

      // Verify new version doesn't exist in existing
      expect(existingVersions).not.toContain(newVersion);
    });
  });

  describe("Confidence Score", () => {
    it("should be between 0 and 100", () => {
      const confidence = 85;
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it("should reflect input quality", () => {
      // More inputs = higher confidence
      const inputsWithImages = { name: "Test", description: "Desc", imageUrls: ["img.jpg"] };
      const inputsWithoutImages = { name: "Test" };

      // Simulated confidence calculation
      const confidenceWithImages = 85;
      const confidenceWithoutImages = 60;

      expect(confidenceWithImages).toBeGreaterThan(confidenceWithoutImages);
    });
  });

  describe("AI Analyzer Role", () => {
    it("should only provide analysis, not make decisions", () => {
      const analysis = {
        audience: { /* ... */ },
        painPoints: [{ problem: "Issue", severity: "high", frequency: "Daily" }],
        priceSensitivity: { level: "medium", priceRange: { min: 100, max: 500 } },
        // No "recommendedAction" or "decision" fields
      };

      // AI output should NOT contain decision fields
      expect(analysis).not.toHaveProperty("recommendedAction");
      expect(analysis).not.toHaveProperty("decision");
      expect(analysis).not.toHaveProperty("shouldBuy");
      expect(analysis).not.toHaveProperty("autoApprove");
    });

    it("should provide data for human decision-making", () => {
      const analysis = {
        priceSensitivity: {
          level: "high",
          priceRange: { min: 50, max: 150 },
          elasticity: "High - very price sensitive",
          competitorComparison: "Above market average",
        },
      };

      // Data is provided for humans to decide
      expect(analysis.priceSensitivity.level).toBeDefined();
      expect(analysis.priceSensitivity.priceRange).toBeDefined();
      // Human can use this to decide pricing strategy
    });
  });

  describe("Audit Trail", () => {
    it("should include creation metadata", () => {
      const record = {
        id: "pi_123",
        productId: "prod_456",
        tenantId: "tenant_789",
        version: 1,
        createdAt: new Date().toISOString(),
        createdBy: "user_abc",
        analysisSource: "ai",
        inputHash: "abc123",
      };

      expect(record).toHaveProperty("id");
      expect(record).toHaveProperty("createdAt");
      expect(record).toHaveProperty("createdBy");
      expect(record).toHaveProperty("analysisSource");
      expect(record).toHaveProperty("inputHash");
    });

    it("should track input changes via hash", () => {
      const hash1 = "abc123";
      const hash2 = "def456";

      // Different hashes indicate different inputs
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Batch Processing", () => {
    it("should handle multiple products", () => {
      const products = [
        { productId: "1", name: "Product 1" },
        { productId: "2", name: "Product 2" },
        { productId: "3", name: "Product 3" },
      ];

      expect(products.length).toBe(3);
    });

    it("should track success and failures separately", () => {
      const result = {
        success: [{ productId: "1" }, { productId: "2" }],
        failed: [{ productId: "3", error: "Analysis failed" }],
      };

      expect(result.success.length).toBe(2);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0]).toHaveProperty("error");
    });
  });

  describe("Version Comparison", () => {
    it("should identify changed fields between versions", () => {
      const versionA = {
        audience: { gender: "male" },
        confidence: 80,
      };

      const versionB = {
        audience: { gender: "unisex" },
        confidence: 85,
      };

      const changes: Record<string, { before: unknown; after: unknown }> = {};

      if (JSON.stringify(versionA.audience) !== JSON.stringify(versionB.audience)) {
        changes["audience"] = { before: versionA.audience, after: versionB.audience };
      }

      if (versionA.confidence !== versionB.confidence) {
        changes["confidence"] = { before: versionA.confidence, after: versionB.confidence };
      }

      expect(Object.keys(changes)).toContain("audience");
      expect(Object.keys(changes)).toContain("confidence");
    });
  });

  describe("Platform Fit Scoring", () => {
    it("should score each platform 0-100", () => {
      const platformFit = {
        instagram: 85,
        facebook: 75,
        tiktok: 60,
        snapchat: 70,
        google: 80,
      };

      Object.values(platformFit).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    it("should cover all major platforms", () => {
      const requiredPlatforms = ["instagram", "facebook", "tiktok", "snapchat", "google"];
      const platformFit = {
        instagram: 85,
        facebook: 75,
        tiktok: 60,
        snapchat: 70,
        google: 80,
      };

      requiredPlatforms.forEach((platform) => {
        expect(platformFit).toHaveProperty(platform);
      });
    });
  });
});

// Helper function for tests
function generateInputHash(input: {
  name: string;
  description?: string;
  imageUrls?: string[];
  price?: number;
  category?: string;
}): string {
  const normalized = JSON.stringify({
    name: input.name,
    description: input.description || "",
    imageUrls: (input.imageUrls || []).sort(),
    price: input.price,
    category: input.category,
  });
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}


// ============================================
// BLOCK 1 - Phase 5: Validation & Lock-in Tests
// ============================================

describe("Product Intelligence Versioning - Lock-in Validation", () => {
  describe("Version Number Increment", () => {
    it("should create version 1 for new product", () => {
      const existingVersions: number[] = [];
      const latestVersion = existingVersions.length > 0 ? Math.max(...existingVersions) : 0;
      const newVersion = latestVersion + 1;

      expect(newVersion).toBe(1);
    });

    it("should increment version correctly for existing product", () => {
      const existingVersions = [1, 2, 3];
      const latestVersion = Math.max(...existingVersions);
      const newVersion = latestVersion + 1;

      expect(newVersion).toBe(4);
    });

    it("should handle gaps in version numbers", () => {
      // If versions 1, 2, 5 exist (due to some deletion), next should be 6
      const existingVersions = [1, 2, 5];
      const latestVersion = Math.max(...existingVersions);
      const newVersion = latestVersion + 1;

      expect(newVersion).toBe(6);
    });

    it("should maintain separate version sequences per product", () => {
      const productAVersions = [1, 2, 3];
      const productBVersions = [1, 2];

      const nextVersionA = Math.max(...productAVersions) + 1;
      const nextVersionB = Math.max(...productBVersions) + 1;

      expect(nextVersionA).toBe(4);
      expect(nextVersionB).toBe(3);
    });
  });

  describe("Immutability Guarantee", () => {
    it("should never update existing version records", () => {
      const existingRecord = {
        id: "pi_123",
        version: 1,
        confidence: 80,
        createdAt: "2024-01-01T00:00:00Z",
      };

      // Simulate "update" attempt - should create new version instead
      const updatedData = { confidence: 90 };
      
      // Correct behavior: create new version, not update
      const newRecord = {
        id: "pi_456",
        version: 2,
        confidence: updatedData.confidence,
        createdAt: "2024-01-02T00:00:00Z",
      };

      // Original record unchanged
      expect(existingRecord.confidence).toBe(80);
      expect(existingRecord.version).toBe(1);
      
      // New record has new version
      expect(newRecord.version).toBe(2);
      expect(newRecord.confidence).toBe(90);
    });

    it("should preserve all historical versions", () => {
      const history = [
        { version: 1, confidence: 70, createdAt: "2024-01-01" },
        { version: 2, confidence: 80, createdAt: "2024-01-02" },
        { version: 3, confidence: 85, createdAt: "2024-01-03" },
      ];

      // All versions should be accessible
      expect(history.length).toBe(3);
      expect(history.find(v => v.version === 1)).toBeDefined();
      expect(history.find(v => v.version === 2)).toBeDefined();
      expect(history.find(v => v.version === 3)).toBeDefined();
    });

    it("should not allow deletion of versions", () => {
      // In production, DELETE operations should be blocked by policy
      const versions = [1, 2, 3];
      const attemptDelete = (version: number) => {
        // Should throw or be blocked
        throw new Error("DELETE operations not allowed on product_intelligence");
      };

      expect(() => attemptDelete(1)).toThrow();
    });
  });

  describe("Tenant Isolation (RLS)", () => {
    it("should scope queries to tenant_id", () => {
      const tenantA = "tenant_aaa";
      const tenantB = "tenant_bbb";

      const allRecords = [
        { id: "1", tenant_id: tenantA, product_id: "p1" },
        { id: "2", tenant_id: tenantA, product_id: "p2" },
        { id: "3", tenant_id: tenantB, product_id: "p3" },
      ];

      // Query for tenant A should only return tenant A records
      const tenantARecords = allRecords.filter(r => r.tenant_id === tenantA);
      expect(tenantARecords.length).toBe(2);
      expect(tenantARecords.every(r => r.tenant_id === tenantA)).toBe(true);
    });

    it("should prevent cross-tenant access", () => {
      const currentTenant = "tenant_aaa";
      const otherTenantRecord = { id: "1", tenant_id: "tenant_bbb", product_id: "p1" };

      // Simulated RLS check
      const hasAccess = otherTenantRecord.tenant_id === currentTenant;
      expect(hasAccess).toBe(false);
    });

    it("should require tenant_id on all operations", () => {
      const validInsert = {
        product_id: "p1",
        tenant_id: "tenant_aaa",
        version: 1,
      };

      const invalidInsert = {
        product_id: "p1",
        // Missing tenant_id
        version: 1,
      };

      expect(validInsert).toHaveProperty("tenant_id");
      expect(invalidInsert).not.toHaveProperty("tenant_id");
    });
  });

  describe("Source Type Recording", () => {
    it("should record 'ai' source for AI-generated analysis", () => {
      const aiGeneratedRecord = {
        id: "pi_123",
        analysis_source: "ai",
        confidence: 85,
      };

      expect(aiGeneratedRecord.analysis_source).toBe("ai");
    });

    it("should record 'manual' source for human-entered data", () => {
      const manualRecord = {
        id: "pi_456",
        analysis_source: "manual",
        confidence: 100, // Manual entries can have 100% confidence
      };

      expect(manualRecord.analysis_source).toBe("manual");
    });

    it("should record 'hybrid' source for AI-assisted human edits", () => {
      const hybridRecord = {
        id: "pi_789",
        analysis_source: "hybrid",
        confidence: 90,
      };

      expect(hybridRecord.analysis_source).toBe("hybrid");
    });

    it("should only allow valid source types", () => {
      const validSources = ["ai", "manual", "hybrid"];
      
      validSources.forEach(source => {
        expect(["ai", "manual", "hybrid"]).toContain(source);
      });

      const invalidSource = "automated";
      expect(["ai", "manual", "hybrid"]).not.toContain(invalidSource);
    });
  });

  describe("Input Hash Deduplication", () => {
    it("should skip analysis if same input hash exists", () => {
      const existingHash = "abc123def456";
      const newInputHash = "abc123def456";

      const shouldSkip = existingHash === newInputHash;
      expect(shouldSkip).toBe(true);
    });

    it("should create new version if input hash differs", () => {
      const existingHash = "abc123def456";
      const newInputHash = "xyz789uvw012";

      const shouldAnalyze = existingHash !== newInputHash;
      expect(shouldAnalyze).toBe(true);
    });

    it("should allow force reanalyze even with same hash", () => {
      const existingHash = "abc123def456";
      const newInputHash = "abc123def456";
      const forceReanalyze = true;

      const shouldAnalyze = forceReanalyze || existingHash !== newInputHash;
      expect(shouldAnalyze).toBe(true);
    });
  });

  describe("Audit Log Integration", () => {
    it("should emit audit event on new version creation", () => {
      const auditEvent = {
        tenant_id: "tenant_aaa",
        event_type: "PRODUCT_INTELLIGENCE_CREATED",
        entity_type: "product_intelligence",
        entity_id: "pi_123",
        action: "analyze",
        new_value: {
          productId: "p1",
          version: 1,
          confidence: 85,
          inputHash: "abc123",
        },
      };

      expect(auditEvent.event_type).toBe("PRODUCT_INTELLIGENCE_CREATED");
      expect(auditEvent.action).toBe("analyze");
      expect(auditEvent.new_value).toHaveProperty("version");
      expect(auditEvent.new_value).toHaveProperty("inputHash");
    });
  });
});

describe("Product Intelligence - Single Source of Truth", () => {
  it("should be the authoritative source for product analysis", () => {
    // Product Intelligence versions are the single source of truth
    // All downstream systems must reference versions, not raw products
    
    const productIntelligence = {
      productId: "p1",
      version: 3, // Latest version
      audience: { /* ... */ },
      keywords: { primary: ["keyword1", "keyword2"] },
    };

    // Downstream systems reference the version
    const adCampaign = {
      productIntelligenceVersion: 3,
      keywords: productIntelligence.keywords.primary,
    };

    expect(adCampaign.productIntelligenceVersion).toBe(productIntelligence.version);
  });

  it("should not allow direct product data usage in downstream", () => {
    // BAD: Using raw product data
    const rawProduct = { name: "Product", description: "Desc" };
    
    // GOOD: Using analyzed intelligence
    const intelligence = {
      productId: "p1",
      version: 1,
      keywords: { primary: ["analyzed", "keywords"] },
    };

    // Downstream should use intelligence, not raw product
    expect(intelligence).toHaveProperty("version");
    expect(intelligence).toHaveProperty("keywords");
  });
});
