import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(null, { status: 401 });
    }

    const user = session.user;
    
    // Get user profile from our users table
    const adminClient = createSupabaseAdminClient();
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
        console.error('Error creating user profile:', createError);
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
    console.error('Auth me error:', error);
    return NextResponse.json(null, { status: 500 });
  }
}
