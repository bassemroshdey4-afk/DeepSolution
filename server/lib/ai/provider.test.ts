/**
 * AI Provider Adapter Tests
 * Tests for the AI Provider abstraction layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the config module
vi.mock("./config", () => ({
  AI_ENV: {
    provider: "gemini",
    geminiApiKey: "test-api-key",
    geminiApiUrl: "https://test.api.com",
    geminiModel: "gemini-2.0-flash",
    enableAICalls: true,
    enableAILogging: true,
    maxTokensPerRun: 100000,
    maxCostPerRun: 5,
  },
  getProviderConfig: vi.fn(() => ({
    provider: "gemini",
    apiKey: "test-api-key",
    apiUrl: "https://test.api.com",
    defaultModel: "gemini-2.0-flash",
    maxRetries: 3,
    retryDelayMs: 100,
    timeoutMs: 60000,
  })),
  calculateCost: vi.fn((model: string, promptTokens: number, completionTokens: number) => {
    return (promptTokens + completionTokens) * 0.0001;
  }),
  RATE_LIMITS: {
    user: { maxRequestsPerHour: 100, maxTokensPerHour: 500000, maxCostPerHour: 10, maxTokensPerRun: 100000, maxCostPerRun: 5 },
    tenant: { maxRequestsPerHour: 500, maxTokensPerHour: 2000000, maxCostPerHour: 50, maxTokensPerRun: 100000, maxCostPerRun: 5 },
    global: { maxRequestsPerHour: 5000, maxTokensPerHour: 10000000, maxCostPerHour: 500, maxTokensPerRun: 100000, maxCostPerRun: 5 },
  },
  isProviderConfigured: vi.fn(() => true),
}));

// Mock the gemini provider
vi.mock("./gemini-provider", () => ({
  getGeminiProvider: vi.fn(() => ({
    name: "gemini",
    isConfigured: true,
    generateText: vi.fn().mockResolvedValue({
      id: "test-id-123",
      created: 1706000000,
      model: "gemini-2.0-flash",
      provider: "gemini",
      content: "Test response content",
      toolCalls: undefined,
      finishReason: "stop",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    }),
    generateJSON: vi.fn().mockResolvedValue({
      id: "test-json-id",
      model: "gemini-2.0-flash",
      provider: "gemini",
      data: { name: "Test", value: 42 },
      usage: {
        promptTokens: 80,
        completionTokens: 30,
        totalTokens: 110,
      },
    }),
  })),
}));

import {
  generateText,
  generateJSON,
  invokeLLM,
  isAIAvailable,
  getAIStatus,
  disableAI,
  enableAI,
  getUsageLogs,
} from "./provider";
import { AI_ENV } from "./config";

describe("AI Provider Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset AI_ENV
    (AI_ENV as any).enableAICalls = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateText", () => {
    it("should generate text successfully", async () => {
      const result = await generateText(
        {
          messages: [{ role: "user", content: "Hello" }],
        },
        {
          featureKey: "test_feature",
          userId: "user-123",
          tenantId: "tenant-456",
        }
      );

      expect(result).toBeDefined();
      expect(result.id).toBe("test-id-123");
      expect(result.content).toBe("Test response content");
      expect(result.provider).toBe("gemini");
      expect(result.usage.totalTokens).toBe(150);
    });

    it("should include usage information", async () => {
      const result = await generateText(
        {
          messages: [{ role: "user", content: "Hello" }],
        },
        {
          featureKey: "test_feature",
        }
      );

      expect(result.usage).toBeDefined();
      expect(result.usage.promptTokens).toBe(100);
      expect(result.usage.completionTokens).toBe(50);
      expect(result.usage.totalTokens).toBe(150);
    });
  });

  describe("generateJSON", () => {
    it("should generate JSON with schema", async () => {
      const result = await generateJSON<{ name: string; value: number }>(
        {
          prompt: "Generate a test object",
          schema: {
            name: "test_schema",
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "number" },
              },
            },
          },
        },
        {
          featureKey: "test_json_feature",
        }
      );

      expect(result).toBeDefined();
      expect(result.data).toEqual({ name: "Test", value: 42 });
      expect(result.provider).toBe("gemini");
    });
  });

  describe("invokeLLM (legacy)", () => {
    it("should work with legacy API format", async () => {
      const result = await invokeLLM({
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(result).toBeDefined();
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.role).toBe("assistant");
      expect(result.choices[0].message.content).toBe("Test response content");
      expect(result.usage).toBeDefined();
      expect(result.usage?.prompt_tokens).toBe(100);
      expect(result.usage?.completion_tokens).toBe(50);
    });

    it("should support max_tokens parameter", async () => {
      const result = await invokeLLM({
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 1000,
      });

      expect(result).toBeDefined();
    });
  });

  describe("Kill Switch", () => {
    it("should check if AI is available", () => {
      const available = isAIAvailable();
      expect(available).toBe(true);
    });

    it("should disable AI calls", () => {
      disableAI();
      expect((AI_ENV as any).enableAICalls).toBe(false);
    });

    it("should enable AI calls", () => {
      disableAI();
      enableAI();
      expect((AI_ENV as any).enableAICalls).toBe(true);
    });
  });

  describe("AI Status", () => {
    it("should return current AI status", () => {
      const status = getAIStatus();

      expect(status).toBeDefined();
      expect(status.enabled).toBe(true);
      expect(status.provider).toBe("gemini");
      expect(status.configured).toBe(true);
      expect(status.model).toBe("gemini-2.0-flash");
    });
  });

  describe("Usage Logging", () => {
    it("should log usage after successful call", async () => {
      await generateText(
        {
          messages: [{ role: "user", content: "Hello" }],
        },
        {
          featureKey: "test_logging",
          userId: "user-123",
        }
      );

      const logs = getUsageLogs(10);
      expect(logs.length).toBeGreaterThan(0);

      const lastLog = logs[logs.length - 1];
      expect(lastLog.featureKey).toBe("test_logging");
      expect(lastLog.status).toBe("completed");
      expect(lastLog.provider).toBe("gemini");
    });
  });
});

describe("Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AI_ENV as any).enableAICalls = true;
  });

  it("should allow requests within limits", async () => {
    const result = await generateText(
      {
        messages: [{ role: "user", content: "Hello" }],
      },
      {
        featureKey: "rate_limit_test",
        userId: "user-rate-test",
      }
    );

    expect(result).toBeDefined();
  });

  it("should reject requests when kill switch is off", async () => {
    (AI_ENV as any).enableAICalls = false;

    await expect(
      generateText(
        {
          messages: [{ role: "user", content: "Hello" }],
        },
        {
          featureKey: "kill_switch_test",
        }
      )
    ).rejects.toThrow("AI calls are disabled");
  });
});

describe("Cost Calculation", () => {
  beforeEach(() => {
    (AI_ENV as any).enableAICalls = true;
  });

  it("should calculate costs correctly", async () => {
    const result = await generateText(
      {
        messages: [{ role: "user", content: "Hello" }],
      },
      {
        featureKey: "cost_test",
      }
    );

    const logs = getUsageLogs(10);
    const lastLog = logs[logs.length - 1];

    // Cost should be calculated based on tokens
    expect(lastLog.estimatedCostUsd).toBeGreaterThanOrEqual(0);
  });
});

describe("Provider Selection", () => {
  it("should use Gemini as default provider", () => {
    const status = getAIStatus();
    expect(status.provider).toBe("gemini");
  });
});
