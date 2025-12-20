/**
 * AI Usage Protection System
 * Rate limiting, cost tracking, and kill-switch for AI API calls
 */

import { createClient } from '@supabase/supabase-js';
import { checkFlag, FLAGS } from './feature-flags';

// Token pricing (per 1K tokens) - GPT-4 Turbo pricing
const TOKEN_PRICING = {
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'default': { input: 0.01, output: 0.03 },
};

// Rate limits
const RATE_LIMITS = {
  // Per-user limits (per hour)
  user: {
    maxRequests: 100,
    maxTokens: 500000,
    maxCostUsd: 10,
  },
  // Per-tenant limits (per hour)
  tenant: {
    maxRequests: 500,
    maxTokens: 2000000,
    maxCostUsd: 50,
  },
  // Global limits (per hour)
  global: {
    maxRequests: 5000,
    maxTokens: 10000000,
    maxCostUsd: 500,
  },
  // Per-run limits
  perRun: {
    maxTokens: 100000,
    maxCostUsd: 5,
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
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  run_status: 'pending' | 'completed' | 'failed' | 'rate_limited' | 'killed';
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface AIProtectionContext {
  userId?: string;
  tenantId?: string;
  featureKey: string;
  model?: string;
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
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = TOKEN_PRICING[model as keyof typeof TOKEN_PRICING] || TOKEN_PRICING.default;
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
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
      prompt_tokens: log.prompt_tokens,
      completion_tokens: log.completion_tokens,
      total_tokens: log.total_tokens,
      estimated_cost_usd: log.estimated_cost_usd,
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
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { totalRequests: 0, totalTokens: 0, totalCost: 0, byFeature: {} };
  }
  
  const periodMap = {
    hour: '1 hour',
    day: '1 day',
    week: '7 days',
    month: '30 days',
  };
  
  let query = supabase
    .from('ai_usage_logs')
    .select('feature_key, total_tokens, estimated_cost_usd')
    .gte('created_at', `now() - interval '${periodMap[period]}'`);
  
  if (context.userId) {
    query = query.eq('user_id', context.userId);
  }
  if (context.tenantId) {
    query = query.eq('tenant_id', context.tenantId);
  }
  
  const { data, error } = await query;
  
  if (error || !data) {
    return { totalRequests: 0, totalTokens: 0, totalCost: 0, byFeature: {} };
  }
  
  const byFeature: Record<string, { requests: number; tokens: number; cost: number }> = {};
  let totalRequests = 0;
  let totalTokens = 0;
  let totalCost = 0;
  
  for (const log of data) {
    totalRequests++;
    totalTokens += log.total_tokens || 0;
    totalCost += log.estimated_cost_usd || 0;
    
    if (!byFeature[log.feature_key]) {
      byFeature[log.feature_key] = { requests: 0, tokens: 0, cost: 0 };
    }
    byFeature[log.feature_key].requests++;
    byFeature[log.feature_key].tokens += log.total_tokens || 0;
    byFeature[log.feature_key].cost += log.estimated_cost_usd || 0;
  }
  
  return { totalRequests, totalTokens, totalCost: Number(totalCost.toFixed(4)), byFeature };
}

/**
 * Wrapper for protected AI calls
 */
export async function protectedAICall<T>(
  context: AIProtectionContext,
  aiFunction: () => Promise<{ result: T; promptTokens: number; completionTokens: number }>
): Promise<{ success: boolean; result?: T; error?: string; logId?: string }> {
  // Check rate limits
  const rateLimitCheck = await checkRateLimits(context);
  if (!rateLimitCheck.allowed) {
    await logAIUsage({
      tenant_id: context.tenantId,
      user_id: context.userId,
      feature_key: context.featureKey,
      model: context.model || 'unknown',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      run_status: 'rate_limited',
      error_message: rateLimitCheck.reason,
    });
    
    return { success: false, error: rateLimitCheck.reason };
  }
  
  try {
    const { result, promptTokens, completionTokens } = await aiFunction();
    const totalTokens = promptTokens + completionTokens;
    const cost = calculateCost(context.model || 'default', promptTokens, completionTokens);
    
    // Update rate limits
    updateRateLimits(context, totalTokens, cost);
    
    // Log usage
    const logId = await logAIUsage({
      tenant_id: context.tenantId,
      user_id: context.userId,
      feature_key: context.featureKey,
      model: context.model || 'gpt-4-turbo',
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: cost,
      run_status: 'completed',
    });
    
    return { success: true, result, logId: logId || undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAIUsage({
      tenant_id: context.tenantId,
      user_id: context.userId,
      feature_key: context.featureKey,
      model: context.model || 'unknown',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      run_status: 'failed',
      error_message: errorMessage,
    });
    
    return { success: false, error: errorMessage };
  }
}
