/**
 * AI Usage Protection System
 * Rate limiting, cost tracking, and kill-switch for AI API calls
 * 
 * Updated for Gemini provider with cost-efficient pricing
 */

import { createClient } from '@supabase/supabase-js';
import { checkFlag, FLAGS } from './feature-flags';

// Token pricing (per 1M tokens) - Gemini pricing (much cheaper than OpenAI)
const TOKEN_PRICING = {
  // Gemini models
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  
  // OpenAI models (legacy, for reference)
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  
  // Default (use Gemini Flash pricing)
  'default': { input: 0.10, output: 0.40 },
};

// Rate limits (more generous due to lower Gemini costs)
const RATE_LIMITS = {
  // Per-user limits (per hour)
  user: {
    maxRequests: 200,
    maxTokens: 1000000,
    maxCostUsd: 5, // Lower cost limit due to cheaper pricing
  },
  // Per-tenant limits (per hour)
  tenant: {
    maxRequests: 1000,
    maxTokens: 5000000,
    maxCostUsd: 25,
  },
  // Global limits (per hour)
  global: {
    maxRequests: 10000,
    maxTokens: 50000000,
    maxCostUsd: 250,
  },
  // Per-run limits
  perRun: {
    maxTokens: 100000,
    maxCostUsd: 2, // Lower per-run limit
  },
};

// In-memory rate tracking (should use Redis in production)
const rateLimitCache = new Map<string, { count: number; tokens: number; cost: number; timestamp: number }>();

export interface AIUsageLog {
  id?: string;
  tenant_id?: string;
  user_id?: string;
  feature_key: string;
  model: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms?: number;
  run_status: 'pending' | 'completed' | 'failed' | 'rate_limited' | 'killed';
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface AIProtectionContext {
  userId?: string;
  tenantId?: string;
  featureKey: string;
  model?: string;
  provider?: string;
  estimatedTokens?: number;
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Calculate estimated cost for tokens
 * Pricing is per 1M tokens
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = TOKEN_PRICING[model as keyof typeof TOKEN_PRICING] || TOKEN_PRICING.default;
  const inputCost = (promptTokens / 1000000) * pricing.input;
  const outputCost = (completionTokens / 1000000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Check if AI calls are enabled (kill-switch)
 */
export async function isAIEnabled(context: { userId?: string; tenantId?: string }): Promise<boolean> {
  return checkFlag(FLAGS.ENABLE_AI_CALLS, context);
}

/**
 * Check rate limits before making AI call
 */
export async function checkRateLimits(context: AIProtectionContext): Promise<{
  allowed: boolean;
  reason?: string;
  remainingRequests?: number;
  remainingTokens?: number;
}> {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  
  // Check kill-switch first
  const aiEnabled = await isAIEnabled({ userId: context.userId, tenantId: context.tenantId });
  if (!aiEnabled) {
    return { allowed: false, reason: 'AI calls are currently disabled (kill-switch active)' };
  }
  
  // Check per-run limits
  if (context.estimatedTokens && context.estimatedTokens > RATE_LIMITS.perRun.maxTokens) {
    return { 
      allowed: false, 
      reason: `Estimated tokens (${context.estimatedTokens}) exceeds per-run limit (${RATE_LIMITS.perRun.maxTokens})` 
    };
  }
  
  // Check user rate limits
  if (context.userId) {
    const userKey = `user:${context.userId}`;
    const userUsage = rateLimitCache.get(userKey);
    
    if (userUsage && userUsage.timestamp > hourAgo) {
      if (userUsage.count >= RATE_LIMITS.user.maxRequests) {
        return { 
          allowed: false, 
          reason: 'User hourly request limit exceeded',
          remainingRequests: 0
        };
      }
      if (userUsage.tokens >= RATE_LIMITS.user.maxTokens) {
        return { 
          allowed: false, 
          reason: 'User hourly token limit exceeded',
          remainingTokens: 0
        };
      }
    }
  }
  
  // Check tenant rate limits
  if (context.tenantId) {
    const tenantKey = `tenant:${context.tenantId}`;
    const tenantUsage = rateLimitCache.get(tenantKey);
    
    if (tenantUsage && tenantUsage.timestamp > hourAgo) {
      if (tenantUsage.count >= RATE_LIMITS.tenant.maxRequests) {
        return { 
          allowed: false, 
          reason: 'Tenant hourly request limit exceeded',
          remainingRequests: 0
        };
      }
    }
  }
  
  return { 
    allowed: true,
    remainingRequests: RATE_LIMITS.user.maxRequests,
    remainingTokens: RATE_LIMITS.user.maxTokens
  };
}

/**
 * Update rate limit counters after AI call
 */
export function updateRateLimits(
  context: AIProtectionContext,
  tokens: number,
  cost: number
): void {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  
  // Update user limits
  if (context.userId) {
    const userKey = `user:${context.userId}`;
    const existing = rateLimitCache.get(userKey);
    
    if (existing && existing.timestamp > hourAgo) {
      rateLimitCache.set(userKey, {
        count: existing.count + 1,
        tokens: existing.tokens + tokens,
        cost: existing.cost + cost,
        timestamp: existing.timestamp,
      });
    } else {
      rateLimitCache.set(userKey, {
        count: 1,
        tokens: tokens,
        cost: cost,
        timestamp: now,
      });
    }
  }
  
  // Update tenant limits
  if (context.tenantId) {
    const tenantKey = `tenant:${context.tenantId}`;
    const existing = rateLimitCache.get(tenantKey);
    
    if (existing && existing.timestamp > hourAgo) {
      rateLimitCache.set(tenantKey, {
        count: existing.count + 1,
        tokens: existing.tokens + tokens,
        cost: existing.cost + cost,
        timestamp: existing.timestamp,
      });
    } else {
      rateLimitCache.set(tenantKey, {
        count: 1,
        tokens: tokens,
        cost: cost,
        timestamp: now,
      });
    }
  }
}

/**
 * Log AI usage to database
 */
export async function logAIUsage(log: AIUsageLog): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, AI usage not logged');
    return null;
  }
  
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .insert({
      tenant_id: log.tenant_id,
      user_id: log.user_id,
      feature_key: log.feature_key,
      model: log.model,
      provider: log.provider || 'gemini',
      prompt_tokens: log.prompt_tokens,
      completion_tokens: log.completion_tokens,
      total_tokens: log.total_tokens,
      estimated_cost_usd: log.estimated_cost_usd,
      latency_ms: log.latency_ms,
      run_status: log.run_status,
      error_message: log.error_message,
      metadata: log.metadata || {},
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to log AI usage:', error);
    return null;
  }
  
  return data?.id || null;
}

/**
 * Get AI usage statistics for a user/tenant
 */
export async function getAIUsageStats(
  context: { userId?: string; tenantId?: string },
  period: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<{
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
  byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { totalRequests: 0, totalTokens: 0, totalCost: 0, byFeature: {}, byProvider: {} };
  }
  
  const periodMap = {
    hour: '1 hour',
    day: '1 day',
    week: '7 days',
    month: '30 days',
  };
  
  let query = supabase
    .from('ai_usage_logs')
    .select('feature_key, provider, total_tokens, estimated_cost_usd')
    .gte('created_at', `now() - interval '${periodMap[period]}'`);
  
  if (context.userId) {
    query = query.eq('user_id', context.userId);
  }
  if (context.tenantId) {
    query = query.eq('tenant_id', context.tenantId);
  }
  
  const { data, error } = await query;
  
  if (error || !data) {
    return { totalRequests: 0, totalTokens: 0, totalCost: 0, byFeature: {}, byProvider: {} };
  }
  
  const byFeature: Record<string, { requests: number; tokens: number; cost: number }> = {};
  const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {};
  let totalRequests = 0;
  let totalTokens = 0;
  let totalCost = 0;
  
  for (const log of data) {
    totalRequests++;
    totalTokens += log.total_tokens || 0;
    totalCost += log.estimated_cost_usd || 0;
    
    // By feature
    if (!byFeature[log.feature_key]) {
      byFeature[log.feature_key] = { requests: 0, tokens: 0, cost: 0 };
    }
    byFeature[log.feature_key].requests++;
    byFeature[log.feature_key].tokens += log.total_tokens || 0;
    byFeature[log.feature_key].cost += log.estimated_cost_usd || 0;
    
    // By provider
    const provider = log.provider || 'unknown';
    if (!byProvider[provider]) {
      byProvider[provider] = { requests: 0, tokens: 0, cost: 0 };
    }
    byProvider[provider].requests++;
    byProvider[provider].tokens += log.total_tokens || 0;
    byProvider[provider].cost += log.estimated_cost_usd || 0;
  }
  
  return { 
    totalRequests, 
    totalTokens, 
    totalCost: Number(totalCost.toFixed(4)), 
    byFeature,
    byProvider
  };
}

/**
 * Wrapper for protected AI calls
 */
export async function protectedAICall<T>(
  context: AIProtectionContext,
  aiFunction: () => Promise<{ result: T; promptTokens: number; completionTokens: number }>
): Promise<{ success: boolean; result?: T; error?: string; logId?: string }> {
  const startTime = Date.now();
  
  // Check rate limits
  const rateLimitCheck = await checkRateLimits(context);
  if (!rateLimitCheck.allowed) {
    await logAIUsage({
      tenant_id: context.tenantId,
      user_id: context.userId,
      feature_key: context.featureKey,
      model: context.model || 'unknown',
      provider: context.provider || 'gemini',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      latency_ms: Date.now() - startTime,
      run_status: 'rate_limited',
      error_message: rateLimitCheck.reason,
    });
    
    return { success: false, error: rateLimitCheck.reason };
  }
  
  try {
    const { result, promptTokens, completionTokens } = await aiFunction();
    const totalTokens = promptTokens + completionTokens;
    const cost = calculateCost(context.model || 'default', promptTokens, completionTokens);
    const latencyMs = Date.now() - startTime;
    
    // Update rate limits
    updateRateLimits(context, totalTokens, cost);
    
    // Log usage
    const logId = await logAIUsage({
      tenant_id: context.tenantId,
      user_id: context.userId,
      feature_key: context.featureKey,
      model: context.model || 'gemini-2.0-flash',
      provider: context.provider || 'gemini',
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: cost,
      latency_ms: latencyMs,
      run_status: 'completed',
    });
    
    return { success: true, result, logId: logId || undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const latencyMs = Date.now() - startTime;
    
    await logAIUsage({
      tenant_id: context.tenantId,
      user_id: context.userId,
      feature_key: context.featureKey,
      model: context.model || 'unknown',
      provider: context.provider || 'gemini',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      latency_ms: latencyMs,
      run_status: 'failed',
      error_message: errorMessage,
    });
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Get current AI provider info
 */
export function getAIProviderInfo(): {
  provider: string;
  model: string;
  pricing: { input: number; output: number };
} {
  const model = process.env.AI_MODEL_TEXT || 'gemini-2.0-flash';
  const provider = process.env.AI_PROVIDER || 'gemini';
  const pricing = TOKEN_PRICING[model as keyof typeof TOKEN_PRICING] || TOKEN_PRICING.default;
  
  return { provider, model, pricing };
}
