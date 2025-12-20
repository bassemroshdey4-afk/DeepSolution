import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ isSuperAdmin: false, error: 'Database not configured' });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sb-access-token')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ isSuperAdmin: false, error: 'Not authenticated' });
    }
    
    // Verify the session and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionCookie);
    
    if (authError || !user) {
      return NextResponse.json({ isSuperAdmin: false, error: 'Invalid session' });
    }
    
    // Check if user is super admin
    const { data: superAdmin, error: saError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (saError || !superAdmin) {
      return NextResponse.json({ isSuperAdmin: false });
    }
    
    return NextResponse.json({ isSuperAdmin: true, userId: user.id });
  } catch (error) {
    console.error('Super admin check error:', error);
    return NextResponse.json({ isSuperAdmin: false, error: 'Internal error' });
  }
}
