'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

/**
 * Tenant Context
 * 
 * Provides tenant_id to all components for data isolation.
 * All API calls should use the tenant_id from this context.
 */

// Types
interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  settings: {
    business_type?: string;
    country?: string;
    currency?: string;
    locale?: string;
  };
  subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled';
  trial_ends_at: string | null;
  created_at: string;
}

interface TenantUser {
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  userRole: 'owner' | 'admin' | 'member' | 'viewer' | null;
  loading: boolean;
  error: string | null;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  tenantId: null,
  userRole: null,
  loading: true,
  error: null,
  switchTenant: async () => {},
  refreshTenant: async () => {},
});

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tenant on mount
  useEffect(() => {
    loadTenant();
  }, []);

  async function loadTenant() {
    if (!supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setLoading(false);
        return; // Not authenticated
      }

      // Get user's profile with default tenant
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.default_tenant_id) {
        setLoading(false);
        return; // No tenant assigned
      }

      // Get tenant details
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.default_tenant_id)
        .single();

      if (tenantError || !tenantData) {
        setError('فشل تحميل بيانات المساحة');
        setLoading(false);
        return;
      }

      // Get user's role in this tenant
      const { data: membership, error: memberError } = await supabase
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', profile.default_tenant_id)
        .eq('user_id', user.id)
        .single();

      if (memberError) {
        console.warn('Could not get user role:', memberError);
      }

      setTenant(tenantData as Tenant);
      setUserRole(membership?.role as any || 'member');
      setError(null);

    } catch (err: any) {
      console.error('Error loading tenant:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function switchTenant(tenantId: string) {
    if (!supabase) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify user has access to this tenant
      const { data: membership, error: memberError } = await supabase
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership) {
        throw new Error('ليس لديك صلاحية الوصول لهذه المساحة');
      }

      // Update default tenant
      await supabase
        .from('profiles')
        .update({ default_tenant_id: tenantId })
        .eq('id', user.id);

      // Reload tenant
      await loadTenant();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshTenant() {
    await loadTenant();
  }

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantId: tenant?.id || null,
        userRole,
        loading,
        error,
        switchTenant,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

// Helper hook to get tenant_id for API calls
export function useTenantId(): string | null {
  const { tenantId } = useTenant();
  return tenantId;
}

// Helper hook to check if user has specific role
export function useHasRole(requiredRoles: ('owner' | 'admin' | 'member' | 'viewer')[]): boolean {
  const { userRole } = useTenant();
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
}

// Helper hook to check if user is owner or admin
export function useIsAdmin(): boolean {
  return useHasRole(['owner', 'admin']);
}

// Helper hook to check if user is owner
export function useIsOwner(): boolean {
  return useHasRole(['owner']);
}
