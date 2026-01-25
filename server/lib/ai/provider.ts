/**
 * AI Provider Adapter
 * 
 * This is the ONLY entry point for AI calls in the application.
 * All business modules must use this adapter instead of calling providers directly.
 * 
 * Features:
 * - Provider abstraction (Gemini, OpenAI, Forge)
 * - Kill switch support
 * - Rate limiting
 * - Usage logging
 * - Cost tracking
 * - Retry with backoff
 */

import type {
  AIProvider,
  AIProviderType,
  GenerateTextParams,
  GenerateTextResult,
  GenerateJSONParams,
  GenerateJSONResult,
  AIUsageLog,
  RateLimitStatus,
  Message,
  JsonSchema,
} from "./types";
import { AI_ENV, getProviderConfig, calculateCost, RATE_LIMITS, isProviderConfigured } from "./config";
import { getGeminiProvider } from "./gemini-provider";

// ==================== Rate Limit Cache ====================

const rateLimitCache = new Map<string, {
  count: number;
  tokens: number;
  cost: number;
  timestamp: number;
}>();

// ==================== Usage Logging ====================

const usageLogs: AIUsageLog[] = [];

function logUsage(log: AIUsageLog): void {
  if (!AI_ENV.enableAILogging) return;
  
  usageLogs.push(log);
  
  // Keep only last 1000 logs in memory
  if (usageLogs.length > 1000) {
    usageLogs.shift();
  }
  
  // Log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.log(`[AI] ${log.provider}/${log.model} | ${log.featureKey} | ${log.totalTokens} tokens | $${log.estimatedCostUsd.toFixed(4)} | ${log.latencyMs}ms | ${log.status}`);
  }
}

export function getUsageLogs(limit: number = 100): AIUsageLog[] {
  return usageLogs.slice(-limit);
}

// ==================== Rate Limiting ====================

function checkRateLimits(context: {
  userId?: string;
  tenantId?: string;
  estimatedTokens?: number;
}): RateLimitStatus {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  
  // Check kill switch
  if (!AI_ENV.enableAICalls) {
    return { allowed: false, reason: "AI calls are disabled (kill switch active)" };
  }
  
  // Check per-run token limit
  if (context.estimatedTokens && context.estimatedTokens > AI_ENV.maxTokensPerRun) {
    return {
      allowed: false,
      reason: `Estimated tokens (${context.estimatedTokens}) exceeds per-run limit (${AI_ENV.maxTokensPerRun})`,
    };
  }
  
  // Check user rate limits
  if (context.userId) {
    const userKey = `user:${context.userId}`;
    const userUsage = rateLimitCache.get(userKey);
    const limits = RATE_LIMITS.user;
    
    if (userUsage && userUsage.timestamp > hourAgo) {
      if (userUsage.count >= limits.maxRequestsPerHour) {
        return { allowed: false, reason: "User hourly request limit exceeded", remainingRequests: 0 };
      }
      if (userUsage.tokens >= limits.maxTokensPerHour) {
        return { allowed: false, reason: "User hourly token limit exceeded", remainingTokens: 0 };
      }
    }
  }
  
  // Check tenant rate limits
  if (context.tenantId) {
    const tenantKey = `tenant:${context.tenantId}`;
    const tenantUsage = rateLimitCache.get(tenantKey);
    const limits = RATE_LIMITS.tenant;
    
    if (tenantUsage && tenantUsage.timestamp > hourAgo) {
      if (tenantUsage.count >= limits.maxRequestsPerHour) {
        return { allowed: false, reason: "Tenant hourly request limit exceeded", remainingRequests: 0 };
      }
    }
  }
  
  return { allowed: true };
}

function updateRateLimits(context: {
  userId?: string;
  tenantId?: string;
}, tokens: number, cost: number): void {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  
  const updateKey = (key: string) => {
    const existing = rateLimitCache.get(key);
    if (existing && existing.timestamp > hourAgo) {
      rateLimitCache.set(key, {
        count: existing.count + 1,
        tokens: existing.tokens + tokens,
        cost: existing.cost + cost,
        timestamp: existing.timestamp,
      });
    } else {
      rateLimitCache.set(key, { count: 1, tokens, cost, timestamp: now });
    }
  };
  
  if (context.userId) updateKey(`user:${context.userId}`);
  if (context.tenantId) updateKey(`tenant:${context.tenantId}`);
}

// ==================== Provider Factory ====================

function getProvider(providerType?: AIProviderType): AIProvider {
  const type = providerType || AI_ENV.provider;
  
  switch (type) {
    case "gemini":
    case "forge":
    default:
      return getGeminiProvider();
  }
}

// ==================== Main API Functions ====================

export interface AICallContext {
  userId?: string;
  tenantId?: string;
  featureKey: string;
  estimatedTokens?: number;
}

/**
 * Generate text using AI
 * This is the main function for text generation
 */
export async function generateText(
  params: GenerateTextParams,
  context: AICallContext
): Promise<GenerateTextResult> {
  const startTime = Date.now();
  const provider = getProvider();
  
  // Check rate limits
  const rateLimitStatus = checkRateLimits({
    userId: context.userId,
    tenantId: context.tenantId,
    estimatedTokens: context.estimatedTokens,
  });
  
  if (!rateLimitStatus.allowed) {
    logUsage({
      provider: provider.name,
      model: "unknown",
      tenantId: context.tenantId,
      userId: context.userId,
      featureKey: context.featureKey,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - startTime,
      status: "rate_limited",
      errorMessage: rateLimitStatus.reason,
      createdAt: new Date(),
    });
    throw new Error(rateLimitStatus.reason);
  }
  
  try {
    const result = await provider.generateText(params);
    const cost = calculateCost(result.model, result.usage.promptTokens, result.usage.completionTokens);
    const latencyMs = Date.now() - startTime;
    
    // Update rate limits
    updateRateLimits(
      { userId: context.userId, tenantId: context.tenantId },
      result.usage.totalTokens,
      cost
    );
    
    // Log usage
    logUsage({
      provider: provider.name,
      model: result.model,
      tenantId: context.tenantId,
      userId: context.userId,
      featureKey: context.featureKey,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      estimatedCostUsd: cost,
      latencyMs,
      status: "completed",
      createdAt: new Date(),
    });
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logUsage({
      provider: provider.name,
      model: "unknown",
      tenantId: context.tenantId,
      userId: context.userId,
      featureKey: context.featureKey,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - startTime,
      status: "failed",
      errorMessage,
      createdAt: new Date(),
    });
    
    throw error;
  }
}

/**
 * Generate JSON using AI with schema validation
 */
export async function generateJSON<T = unknown>(
  params: GenerateJSONParams<T>,
  context: AICallContext
): Promise<GenerateJSONResult<T>> {
  const startTime = Date.now();
  const provider = getProvider();
  
  // Check rate limits
  const rateLimitStatus = checkRateLimits({
    userId: context.userId,
    tenantId: context.tenantId,
    estimatedTokens: context.estimatedTokens,
  });
  
  if (!rateLimitStatus.allowed) {
    logUsage({
      provider: provider.name,
      model: "unknown",
      tenantId: context.tenantId,
      userId: context.userId,
      featureKey: context.featureKey,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - startTime,
      status: "rate_limited",
      errorMessage: rateLimitStatus.reason,
      createdAt: new Date(),
    });
    throw new Error(rateLimitStatus.reason);
  }
  
  try {
    const result = await provider.generateJSON<T>(params);
    const cost = calculateCost(result.model, result.usage.promptTokens, result.usage.completionTokens);
    const latencyMs = Date.now() - startTime;
    
    // Update rate limits
    updateRateLimits(
      { userId: context.userId, tenantId: context.tenantId },
      result.usage.totalTokens,
      cost
    );
    
    // Log usage
    logUsage({
      provider: provider.name,
      model: result.model,
      tenantId: context.tenantId,
      userId: context.userId,
      featureKey: context.featureKey,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      estimatedCostUsd: cost,
      latencyMs,
      status: "completed",
      createdAt: new Date(),
    });
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logUsage({
      provider: provider.name,
      model: "unknown",
      tenantId: context.tenantId,
      userId: context.userId,
      featureKey: context.featureKey,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - startTime,
      status: "failed",
      errorMessage,
      createdAt: new Date(),
    });
    
    throw error;
  }
}

// ==================== Utility Functions ====================

/**
 * Check if AI is enabled and configured
 */
export function isAIAvailable(): boolean {
  return AI_ENV.enableAICalls && isProviderConfigured();
}

/**
 * Get current AI configuration status
 */
export function getAIStatus(): {
  enabled: boolean;
  provider: AIProviderType;
  configured: boolean;
  model: string;
} {
  const config = getProviderConfig();
  return {
    enabled: AI_ENV.enableAICalls,
    provider: config.provider,
    configured: isProviderConfigured(),
    model: config.defaultModel || "unknown",
  };
}

/**
 * Kill switch - disable all AI calls
 */
export function disableAI(): void {
  (AI_ENV as { enableAICalls: boolean }).enableAICalls = false;
  console.log("[AI] Kill switch activated - all AI calls disabled");
}

/**
 * Enable AI calls
 */
export function enableAI(): void {
  (AI_ENV as { enableAICalls: boolean }).enableAICalls = true;
  console.log("[AI] AI calls enabled");
}

// ==================== Legacy Compatibility ====================

/**
 * Legacy invokeLLM function for backward compatibility
 * Maps to the new generateText API
 */
export async function invokeLLM(params: {
  messages: Message[];
  tools?: any[];
  toolChoice?: any;
  tool_choice?: any;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: JsonSchema;
  output_schema?: JsonSchema;
  responseFormat?: any;
  response_format?: any;
}): Promise<{
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | any[];
      tool_calls?: any[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}> {
  const result = await generateText(
    {
      messages: params.messages,
      tools: params.tools,
      toolChoice: params.toolChoice || params.tool_choice,
      maxTokens: params.maxTokens || params.max_tokens,
      outputSchema: params.outputSchema || params.output_schema,
      responseFormat: params.responseFormat || params.response_format,
    },
    {
      featureKey: "legacy_invokeLLM",
    }
  );
  
  // Convert to legacy format
  return {
    id: result.id,
    created: result.created,
    model: result.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as const,
          content: result.content,
          tool_calls: result.toolCalls,
        },
        finish_reason: result.finishReason,
      },
    ],
    usage: {
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      total_tokens: result.usage.totalTokens,
    },
  };
}

// Re-export types for convenience
export type {
  Message,
  GenerateTextParams,
  GenerateTextResult,
  GenerateJSONParams,
  GenerateJSONResult,
  AIUsageLog,
  JsonSchema,
} from "./types";
