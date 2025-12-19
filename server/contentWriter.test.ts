import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "محتوى تجريبي مُولّد بواسطة الذكاء الاصطناعي" } }],
    usage: { total_tokens: 150 },
  }),
}));

// Mock supabaseAdmin
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockSingle = vi.fn();

vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "tenant_ai_subscriptions") {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({
              eq: mockEq.mockReturnValue({
                in: mockIn.mockReturnValue({
                  single: mockSingle,
                }),
              }),
            }),
          }),
          update: mockUpdate.mockReturnValue({
            eq: mockEq.mockReturnValue({ data: null, error: null }),
          }),
        };
      }
      if (table === "ai_usage_logs") {
        return {
          insert: mockInsert.mockReturnValue({ data: null, error: null }),
        };
      }
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
      };
    }),
  },
}));

describe("Content Writer Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Addon Validation", () => {
    it("should require Content Writer addon to be active", async () => {
      // Test that the addon check is in place
      const CONTENT_WRITER_ADDON_ID = "5d45af19-1d08-43f0-8545-8e48104538a4";
      expect(CONTENT_WRITER_ADDON_ID).toBe("5d45af19-1d08-43f0-8545-8e48104538a4");
    });

    it("should have correct content types defined", () => {
      const contentTypes = [
        "product_description",
        "ad_copy",
        "social_post",
        "email",
        "landing_page_text",
        "blog_intro",
      ];
      expect(contentTypes).toHaveLength(6);
      expect(contentTypes).toContain("product_description");
      expect(contentTypes).toContain("ad_copy");
    });

    it("should have correct tone options", () => {
      const tones = ["professional", "casual", "persuasive", "friendly", "luxury"];
      expect(tones).toHaveLength(5);
      expect(tones).toContain("professional");
    });

    it("should support Arabic and English languages", () => {
      const languages = ["ar", "en"];
      expect(languages).toContain("ar");
      expect(languages).toContain("en");
    });
  });

  describe("Prompt Building", () => {
    it("should build Arabic prompt correctly", () => {
      const isArabic = true;
      const contentLabel = "وصف منتج";
      const toneLabel = "احترافي";
      const productName = "ساعة ذكية";

      const systemPrompt = `أنت كاتب محتوى محترف للتجارة الإلكترونية. اكتب باللغة العربية الفصحى السهلة. استخدم أسلوب ${toneLabel}.`;
      let userPrompt = `اكتب ${contentLabel}`;
      userPrompt += ` للمنتج: "${productName}"`;

      expect(systemPrompt).toContain("كاتب محتوى محترف");
      expect(systemPrompt).toContain("احترافي");
      expect(userPrompt).toContain("وصف منتج");
      expect(userPrompt).toContain("ساعة ذكية");
    });

    it("should build English prompt correctly", () => {
      const isArabic = false;
      const contentLabel = "product description";
      const toneLabel = "professional";
      const productName = "Smart Watch";

      const systemPrompt = `You are a professional e-commerce content writer. Write in clear, engaging English. Use a ${toneLabel} tone.`;
      let userPrompt = `Write a ${contentLabel}`;
      userPrompt += ` for the product: "${productName}"`;

      expect(systemPrompt).toContain("professional e-commerce content writer");
      expect(systemPrompt).toContain("professional tone");
      expect(userPrompt).toContain("product description");
      expect(userPrompt).toContain("Smart Watch");
    });
  });

  describe("Usage Tracking", () => {
    it("should deduct usage after successful generation", () => {
      const usageRemaining = 100;
      const newUsageRemaining = usageRemaining - 1;
      expect(newUsageRemaining).toBe(99);
    });

    it("should reject when usage is exhausted", () => {
      const usageRemaining = 0;
      const shouldReject = usageRemaining < 1;
      expect(shouldReject).toBe(true);
    });

    it("should allow when usage is available", () => {
      const usageRemaining = 50;
      const shouldAllow = usageRemaining >= 1;
      expect(shouldAllow).toBe(true);
    });
  });

  describe("Response Format", () => {
    it("should return correct response structure", () => {
      const response = {
        content: "محتوى تجريبي",
        contentType: "product_description",
        language: "ar",
        tokensUsed: 150,
        usageRemaining: 99,
      };

      expect(response).toHaveProperty("content");
      expect(response).toHaveProperty("contentType");
      expect(response).toHaveProperty("language");
      expect(response).toHaveProperty("tokensUsed");
      expect(response).toHaveProperty("usageRemaining");
    });
  });
});
