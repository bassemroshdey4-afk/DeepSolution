/**
 * Feature Flags System
 * Server-side feature flag evaluation with Super Admin support
 */

import { createClient } from '@supabase/supabase-js';

// Feature flag keys
export const FLAGS = {
  ENABLE_PUBLIC_SIGNUP: 'enable_public_signup',
  ENABLE_DEEP_INTELLIGENCE: 'enable_deep_intelligence',
  ENABLE_MARKETING_DECISION_ENGINE: 'enable_marketing_decision_engine',
  ENABLE_AD_CREATOR: 'enable_ad_creator',
  ENABLE_LANDING_BUILDER: 'enable_landing_builder',
  ENABLE_SHIPPING_OPS: 'enable_shipping_ops',
  ENABLE_FINANCE_PROFIT_ENGINE: 'enable_finance_profit_engine',
  ENABLE_INTEGRATIONS: 'enable_integrations',
  ENABLE_AI_CALLS: 'enable_ai_calls',
  ENABLE_BATCH_AI_JOBS: 'enable_batch_ai_jobs',
} as const;

export type FlagKey = typeof FLAGS[keyof typeof FLAGS];

export type FlagStatus = 'enabled' | 'disabled' | 'super_admin_only';

export interface FeatureFlag {
  id: string;
  flag_key: string;
  name: string;
  description: string | null;
  default_status: FlagStatus;
  category: string | null;
  is_system: boolean;
}

export interface FlagEvaluationContext {
  userId?: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

// In-memory cache for flags (refresh every 5 minutes)
let flagsCache: Map<string, FeatureFlag> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get Supabase client for server-side operations
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Check if a user is a Super Admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  
  const { data, error } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  
  if (error || !data) return false;
  return true;
}

/**
 * Refresh flags cache from database
 */
async function refreshFlagsCache(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*');
  
  if (error) {
    console.error('Failed to refresh flags cache:', error);
    return;
  }
  
  flagsCache.clear();
  for (const flag of data || []) {
    flagsCache.set(flag.flag_key, flag);
  }
  cacheTimestamp = Date.now();
}

/**
 * Get all feature flags (with caching)
 */
export async function getAllFlags(): Promise<FeatureFlag[]> {
  if (Date.now() - cacheTimestamp > CACHE_TTL || flagsCache.size === 0) {
    await refreshFlagsCache();
  }
  return Array.from(flagsCache.values());
}

/**
 * Check if a feature flag is enabled
 * Evaluation order: User override > Tenant override > Default
 */
export async function checkFlag(
  flagKey: FlagKey,
  context: FlagEvaluationContext = {}
): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  // Ensure cache is fresh
  if (Date.now() - cacheTimestamp > CACHE_TTL || flagsCache.size === 0) {
    await refreshFlagsCache();
  }
  
  const flag = flagsCache.get(flagKey);
  if (!flag) {
    console.warn(`Unknown feature flag: ${flagKey}`);
    return false;
  }
  
  // Determine if user is super admin
  let isSuperAdminUser = context.isSuperAdmin;
  if (isSuperAdminUser === undefined && context.userId) {
    isSuperAdminUser = await isSuperAdmin(context.userId);
  }
  
  // Check user-level override (highest priority)
  if (supabase && context.userId) {
    const { data: userFlag } = await supabase
      .from('user_feature_flags')
      .select('status')
      .eq('user_id', context.userId)
      .eq('flag_id', flag.id)
      .single();
    
    if (userFlag) {
      return evaluateStatus(userFlag.status, isSuperAdminUser || false);
    }
  }
  
  // Check tenant-level override
  if (supabase && context.tenantId) {
    const { data: tenantFlag } = await supabase
      .from('tenant_feature_flags')
      .select('status')
      .eq('tenant_id', context.tenantId)
      .eq('flag_id', flag.id)
      .single();
    
    if (tenantFlag) {
      return evaluateStatus(tenantFlag.status, isSuperAdminUser || false);
    }
  }
  
  // Fall back to default status
  return evaluateStatus(flag.default_status, isSuperAdminUser || false);
}

/**
 * Evaluate flag status
 */
function evaluateStatus(status: FlagStatus, isSuperAdmin: boolean): boolean {
  switch (status) {
    case 'enabled':
      return true;
    case 'disabled':
      return false;
    case 'super_admin_only':
      return isSuperAdmin;
    default:
      return false;
  }
}

/**
 * Check multiple flags at once
 */
export async function checkFlags(
  flagKeys: FlagKey[],
  context: FlagEvaluationContext = {}
): Promise<Record<FlagKey, boolean>> {
  const results: Record<string, boolean> = {};
  
  for (const key of flagKeys) {
    results[key] = await checkFlag(key, context);
  }
  
  return results as Record<FlagKey, boolean>;
}

/**
 * Get all enabled features for a user
 */
export async function getEnabledFeatures(
  context: FlagEvaluationContext
): Promise<FlagKey[]> {
  const allFlags = Object.values(FLAGS);
  const results = await checkFlags(allFlags, context);
  
  return allFlags.filter(key => results[key]);
}

/**
 * Feature flag React hook context type
 */
export interface FeatureFlagsContextType {
  flags: Record<FlagKey, boolean>;
  isLoading: boolean;
  isSuperAdmin: boolean;
  checkFlag: (key: FlagKey) => boolean;
  refreshFlags: () => Promise<void>;
}

/**
 * Default flags for unauthenticated users (all disabled)
 */
export const DEFAULT_FLAGS: Record<FlagKey, boolean> = {
  [FLAGS.ENABLE_PUBLIC_SIGNUP]: false,
  [FLAGS.ENABLE_DEEP_INTELLIGENCE]: false,
  [FLAGS.ENABLE_MARKETING_DECISION_ENGINE]: false,
  [FLAGS.ENABLE_AD_CREATOR]: false,
  [FLAGS.ENABLE_LANDING_BUILDER]: false,
  [FLAGS.ENABLE_SHIPPING_OPS]: false,
  [FLAGS.ENABLE_FINANCE_PROFIT_ENGINE]: false,
  [FLAGS.ENABLE_INTEGRATIONS]: false,
  [FLAGS.ENABLE_AI_CALLS]: false,
  [FLAGS.ENABLE_BATCH_AI_JOBS]: false,
};
