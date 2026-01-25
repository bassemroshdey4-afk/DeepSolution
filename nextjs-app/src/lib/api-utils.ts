import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API Utilities for Multi-Tenant Data Isolation
 * 
 * All API routes should use these utilities to ensure:
 * 1. User is authenticated
 * 2. User has access to the requested tenant
 * 3. All queries are scoped by tenant_id
 */

// Create Supabase client
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Get service role client for admin operations
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Auth context type
export interface AuthContext {
  userId: string;
  email: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

/**
 * Authenticate request and get tenant context
 * Returns null if not authenticated or no tenant access
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    // Get auth token from cookie or header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      // Try to get from cookie
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;

      // Get user's default tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.default_tenant_id) return null;

      // Get user's role in tenant
      const { data: membership } = await supabase
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', profile.default_tenant_id)
        .eq('user_id', user.id)
        .single();

      return {
        userId: user.id,
        email: user.email || '',
        tenantId: profile.default_tenant_id,
        role: membership?.role || 'member',
      };
    }

    // Verify token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Get user's default tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.default_tenant_id) return null;

    // Get user's role in tenant
    const { data: membership } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', profile.default_tenant_id)
      .eq('user_id', user.id)
      .single();

    return {
      userId: user.id,
      email: user.email || '',
      tenantId: profile.default_tenant_id,
      role: membership?.role || 'member',
    };

  } catch (err) {
    console.error('Auth context error:', err);
    return null;
  }
}

/**
 * Create an API handler with automatic auth and tenant context
 */
export function withAuth(
  handler: (
    request: NextRequest,
    context: AuthContext,
    supabase: any
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const authContext = await getAuthContext(request);
    
    if (!authContext) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(request, authContext, supabase);
  };
}

/**
 * Create an API handler that requires admin role
 */
export function withAdmin(
  handler: (
    request: NextRequest,
    context: AuthContext,
    supabase: any
  ) => Promise<NextResponse>
) {
  return withAuth(async (request, context, supabase) => {
    if (context.role !== 'owner' && context.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }
    return handler(request, context, supabase);
  });
}

/**
 * Create an API handler that requires owner role
 */
export function withOwner(
  handler: (
    request: NextRequest,
    context: AuthContext,
    supabase: any
  ) => Promise<NextResponse>
) {
  return withAuth(async (request, context, supabase) => {
    if (context.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Owner access required' },
        { status: 403 }
      );
    }
    return handler(request, context, supabase);
  });
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
