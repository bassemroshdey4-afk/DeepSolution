/**
 * Super Admin System
 * Hidden administrative capabilities for platform owner
 */

import { createClient } from '@supabase/supabase-js';

export interface SuperAdmin {
  id: string;
  user_id: string;
  granted_by: string | null;
  granted_at: string;
  is_active: boolean;
  notes: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  is_active: boolean;
  created_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  joined_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface AuditLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

/**
 * Get Supabase admin client
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase admin credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Check if user is Super Admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Require Super Admin access (throws if not)
 */
export async function requireSuperAdmin(userId: string): Promise<void> {
  const isAdmin = await isSuperAdmin(userId);
  if (!isAdmin) {
    throw new Error('Super Admin access required');
  }
}

// ============================================================================
// TENANT MANAGEMENT
// ============================================================================

/**
 * List all tenants (Super Admin only)
 */
export async function listAllTenants(): Promise<Tenant[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get tenant details (Super Admin only)
 */
export async function getTenantDetails(tenantId: string): Promise<Tenant | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();
  
  if (error) return null;
  return data;
}

/**
 * Disable a tenant (Super Admin only)
 */
export async function disableTenant(tenantId: string, adminUserId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('tenants')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
  
  if (error) throw error;
  
  // Log audit
  await logAuditEvent({
    action: 'tenant.disabled',
    entity_type: 'tenant',
    entity_id: tenantId,
    user_id: adminUserId,
    new_values: { is_active: false },
  });
}

/**
 * Enable a tenant (Super Admin only)
 */
export async function enableTenant(tenantId: string, adminUserId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('tenants')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
  
  if (error) throw error;
  
  // Log audit
  await logAuditEvent({
    action: 'tenant.enabled',
    entity_type: 'tenant',
    entity_id: tenantId,
    user_id: adminUserId,
    new_values: { is_active: true },
  });
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * List all users across tenants (Super Admin only)
 */
export async function listAllUsers(): Promise<TenantUser[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tenant_users')
    .select(`
      *,
      profile:profiles(full_name, avatar_url)
    `)
    .order('joined_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Disable a user account (Super Admin only)
 */
export async function disableUser(userId: string, adminUserId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  // Disable in all tenants
  const { error } = await supabase
    .from('tenant_users')
    .update({ is_active: false })
    .eq('user_id', userId);
  
  if (error) throw error;
  
  // Log audit
  await logAuditEvent({
    action: 'user.disabled',
    entity_type: 'user',
    entity_id: userId,
    user_id: adminUserId,
    new_values: { is_active: false },
  });
}

/**
 * Enable a user account (Super Admin only)
 */
export async function enableUser(userId: string, adminUserId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('tenant_users')
    .update({ is_active: true })
    .eq('user_id', userId);
  
  if (error) throw error;
  
  // Log audit
  await logAuditEvent({
    action: 'user.enabled',
    entity_type: 'user',
    entity_id: userId,
    user_id: adminUserId,
    new_values: { is_active: true },
  });
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

/**
 * Log an audit event
 */
export async function logAuditEvent(event: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  tenant_id?: string;
  user_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('audit_logs').insert({
      action: event.action,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      tenant_id: event.tenant_id,
      user_id: event.user_id,
      old_values: event.old_values,
      new_values: event.new_values,
      ip_address: event.ip_address,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Get audit logs (Super Admin only)
 */
export async function getAuditLogs(options: {
  limit?: number;
  offset?: number;
  action?: string;
  entity_type?: string;
  tenant_id?: string;
  user_id?: string;
} = {}): Promise<AuditLog[]> {
  const supabase = getSupabaseAdmin();
  
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit || 100);
  
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
  }
  if (options.action) {
    query = query.eq('action', options.action);
  }
  if (options.entity_type) {
    query = query.eq('entity_type', options.entity_type);
  }
  if (options.tenant_id) {
    query = query.eq('tenant_id', options.tenant_id);
  }
  if (options.user_id) {
    query = query.eq('user_id', options.user_id);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================================================
// FEATURE FLAG MANAGEMENT
// ============================================================================

/**
 * Update global feature flag (Super Admin only)
 */
export async function updateFeatureFlag(
  flagKey: string,
  status: 'enabled' | 'disabled' | 'super_admin_only',
  adminUserId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { data: flag, error: fetchError } = await supabase
    .from('feature_flags')
    .select('id, default_status')
    .eq('flag_key', flagKey)
    .single();
  
  if (fetchError || !flag) throw new Error('Feature flag not found');
  
  const oldStatus = flag.default_status;
  
  const { error } = await supabase
    .from('feature_flags')
    .update({ default_status: status, updated_at: new Date().toISOString() })
    .eq('flag_key', flagKey);
  
  if (error) throw error;
  
  // Log audit
  await logAuditEvent({
    action: 'feature_flag.updated',
    entity_type: 'feature_flag',
    entity_id: flag.id,
    user_id: adminUserId,
    old_values: { status: oldStatus },
    new_values: { status },
  });
}

/**
 * Grant Super Admin access (Super Admin only)
 */
export async function grantSuperAdmin(
  targetUserId: string,
  grantedByUserId: string,
  notes?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('super_admins')
    .upsert({
      user_id: targetUserId,
      granted_by: grantedByUserId,
      granted_at: new Date().toISOString(),
      is_active: true,
      notes,
    });
  
  if (error) throw error;
  
  // Log audit
  await logAuditEvent({
    action: 'super_admin.granted',
    entity_type: 'super_admin',
    entity_id: targetUserId,
    user_id: grantedByUserId,
    new_values: { is_active: true, notes },
  });
}

/**
 * Revoke Super Admin access (Super Admin only)
 */
export async function revokeSuperAdmin(
  targetUserId: string,
  revokedByUserId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('super_admins')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId);
  
  if (error) throw error;
  
  // Log audit
  await logAuditEvent({
    action: 'super_admin.revoked',
    entity_type: 'super_admin',
    entity_id: targetUserId,
    user_id: revokedByUserId,
    new_values: { is_active: false },
  });
}

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

/**
 * Get system health status (Super Admin only)
 */
export async function getSystemHealth(): Promise<{
  database: boolean;
  auth: boolean;
  storage: boolean;
  timestamp: string;
}> {
  const supabase = getSupabaseAdmin();
  
  let database = false;
  let auth = false;
  let storage = false;
  
  // Check database
  try {
    const { error } = await supabase.from('tenants').select('id').limit(1);
    database = !error;
  } catch {
    database = false;
  }
  
  // Check auth (by checking if we can list users)
  try {
    const { error } = await supabase.auth.admin.listUsers({ perPage: 1 });
    auth = !error;
  } catch {
    auth = false;
  }
  
  // Check storage
  try {
    const { error } = await supabase.storage.listBuckets();
    storage = !error;
  } catch {
    storage = false;
  }
  
  return {
    database,
    auth,
    storage,
    timestamp: new Date().toISOString(),
  };
}
