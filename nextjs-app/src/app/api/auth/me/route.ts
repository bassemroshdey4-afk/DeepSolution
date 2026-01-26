/**
 * Auth Me API Route
 * 
 * Returns current user info from Supabase session
 * Creates user profile if not exists
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase-server';

export async function GET() {
  try {
    // Check if Supabase is configured
    const { configured, missing } = isSupabaseConfigured();
    if (!configured) {
      console.error('[Auth Me] Supabase not configured. Missing:', missing.join(', '));
      return NextResponse.json(
        { error: 'Supabase not configured', missing },
        { status: 500 }
      );
    }

    const supabase = await createSupabaseServerClient();
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[Auth Me] Session error:', sessionError.message);
      return NextResponse.json(null, { status: 401 });
    }
    
    if (!session) {
      // No session - user not logged in
      return NextResponse.json(null, { status: 401 });
    }

    const user = session.user;
    
    // Get user profile from our users table
    let adminClient;
    try {
      adminClient = createSupabaseAdminClient();
    } catch (err) {
      // If admin client fails, return basic user info
      console.warn('[Auth Me] Admin client not available:', err);
      return NextResponse.json({
        id: user.id,
        openId: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email,
        avatarUrl: user.user_metadata?.avatar_url,
        role: 'user',
      });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('*, tenants(name, slug)')
      .eq('auth_id', user.id)
      .single();

    // If no profile exists, create one
    if (!profile) {
      const { data: newProfile, error: createError } = await adminClient
        .from('users')
        .insert({
          auth_id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          avatar_url: user.user_metadata?.avatar_url,
          role: 'user',
        })
        .select()
        .single();

      if (createError) {
        console.error('[Auth Me] Error creating user profile:', createError);
      }

      return NextResponse.json({
        id: newProfile?.id || user.id,
        openId: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email,
        avatarUrl: user.user_metadata?.avatar_url,
        role: 'user',
      });
    }

    return NextResponse.json({
      id: profile.id,
      openId: user.id,
      name: profile.name || user.user_metadata?.full_name || 'User',
      email: profile.email || user.email,
      avatarUrl: profile.avatar_url || user.user_metadata?.avatar_url,
      role: profile.role || 'user',
      tenantId: profile.tenant_id,
      tenantName: profile.tenants?.name,
      tenantSlug: profile.tenants?.slug,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Auth Me] Error:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
