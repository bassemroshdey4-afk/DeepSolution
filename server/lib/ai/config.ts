/**
 * AI Provider Configuration
 * Centralized configuration for AI providers
 */

import type { AIProviderType, AIProviderConfig, RateLimitConfig } from "./types";

// ==================== Environment Variables ====================

export const AI_ENV = {
  // Provider selection
  provider: (process.env.AI_PROVIDER || "gemini") as AIProviderType,
  
  // Gemini configuration
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "",
  geminiApiUrl: process.env.GEMINI_API_URL || process.env.BUILT_IN_FORGE_API_URL || "",
  geminiModel: process.env.AI_MODEL_TEXT || "gemini-2.0-flash",
  
  // OpenAI configuration (legacy/fallback)
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiApiUrl: process.env.OPENAI_API_URL || "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4-turbo",
  
  // Forge configuration (Manus built-in)
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.im",
  
  // Feature flags
  enableAICalls: process.env.ENABLE_AI_CALLS !== "false",
  enableAILogging: process.env.ENABLE_AI_LOGGING !== "false",
  
  // Budget controls
  maxTokensPerRun: parseInt(process.env.AI_MAX_TOKENS_PER_RUN || "100000", 10),
  maxCostPerRun: parseFloat(process.env.AI_MAX_COST_PER_RUN || "5"),
};

// ==================== Model Pricing ====================

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Gemini models (per 1M tokens)
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.30 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
  "gemini-1.5-pro": { input: 1.25, output: 5.00 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  
  // OpenAI models (per 1M tokens)
  "gpt-4-turbo": { input: 10.00, output: 30.00 },
  "gpt-4": { input: 30.00, output: 60.00 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-3.5-turbo": { input: 0.50, output: 1.50 },
  
  // Default fallback
  "default": { input: 0.15, output: 0.60 },
};

// ==================== Rate Limits ====================

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  user: {
    maxRequestsPerHour: 100,
    maxTokensPerHour: 500000,
    maxCostPerHour: 10,
    maxTokensPerRun: AI_ENV.maxTokensPerRun,
    maxCostPerRun: AI_ENV.maxCostPerRun,
  },
  tenant: {
    maxRequestsPerHour: 500,
    maxTokensPerHour: 2000000,
    maxCostPerHour: 50,
    maxTokensPerRun: AI_ENV.maxTokensPerRun,
    maxCostPerRun: AI_ENV.maxCostPerRun,
  },
  global: {
    maxRequestsPerHour: 5000,
    maxTokensPerHour: 10000000,
    maxCostPerHour: 500,
    maxTokensPerRun: AI_ENV.maxTokensPerRun,
    maxCostPerRun: AI_ENV.maxCostPerRun,
  },
};

// ==================== Provider Configuration ====================

export function getProviderConfig(provider?: AIProviderType): AIProviderConfig {
  const selectedProvider = provider || AI_ENV.provider;
  
  switch (selectedProvider) {
    case "gemini":
      return {
        provider: "gemini",
        apiKey: AI_ENV.geminiApiKey,
        apiUrl: AI_ENV.geminiApiUrl,
        defaultModel: AI_ENV.geminiModel,
        maxRetries: 3,
        retryDelayMs: 1000,
        timeoutMs: 60000,
      };
    
    case "openai":
      return {
        provider: "openai",
        apiKey: AI_ENV.openaiApiKey,
        apiUrl: AI_ENV.openaiApiUrl,
        defaultModel: AI_ENV.openaiModel,
        maxRetries: 3,
        retryDelayMs: 1000,
        timeoutMs: 60000,
      };
    
    case "forge":
    default:
      return {
        provider: "forge",
        apiKey: AI_ENV.forgeApiKey,
        apiUrl: AI_ENV.forgeApiUrl,
        defaultModel: AI_ENV.geminiModel,
        maxRetries: 3,
        retryDelayMs: 1000,
        timeoutMs: 60000,
      };
  }
}

// ==================== Cost Calculation ====================

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING.default;
  // Pricing is per 1M tokens, convert to actual cost
  const inputCost = (promptTokens / 1000000) * pricing.input;
  const outputCost = (completionTokens / 1000000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}

// ==================== Validation ====================

export function isProviderConfigured(provider?: AIProviderType): boolean {
  const config = getProviderConfig(provider);
  return Boolean(config.apiKey && config.apiKey.length > 0);
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getProviderConfig();
  
  if (!config.apiKey) {
    errors.push(`API key not configured for provider: ${config.provider}`);
  }
  
  if (!AI_ENV.enableAICalls) {
    errors.push("AI calls are disabled (ENABLE_AI_CALLS=false)");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
