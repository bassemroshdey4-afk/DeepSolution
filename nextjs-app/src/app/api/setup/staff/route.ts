import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface StaffData {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'manager' | 'agent' | 'warehouse' | 'support';
  permissions?: Record<string, boolean>;
  is_active?: boolean;
}

async function createSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try { cookieStore.set(name, value, options); } catch (e) { /* ignore in RSC */ }
        });
      },
    },
  });
}

async function getUserTenant(supabase: Awaited<ReturnType<typeof createSupabaseClient>>, userId: string) {
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .single();
  
  return tenantUser?.tenant_id;
}

// GET: List staff members
export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await getUserTenant(supabase, user.id);
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    const { data: staff, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching staff:', error);
      return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }

    return NextResponse.json({ staff: staff || [] });
  } catch (error) {
    console.error('Staff GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create staff member
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await getUserTenant(supabase, user.id);
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    const body: StaffData = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Staff name is required' }, { status: 400 });
    }

    if (!body.role) {
      return NextResponse.json({ error: 'Staff role is required' }, { status: 400 });
    }

    const { data: staffMember, error } = await supabase
      .from('staff_members')
      .insert({
        tenant_id: tenantId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: body.role,
        permissions: body.permissions || {},
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating staff:', error);
      return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
    }

    return NextResponse.json({ staff: staffMember, success: true });
  } catch (error) {
    console.error('Staff POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update staff member
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await getUserTenant(supabase, user.id);
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    const body: StaffData = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
    }

    const { data: staffMember, error } = await supabase
      .from('staff_members')
      .update({
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: body.role,
        permissions: body.permissions,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating staff:', error);
      return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 });
    }

    return NextResponse.json({ staff: staffMember, success: true });
  } catch (error) {
    console.error('Staff PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove staff member
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await getUserTenant(supabase, user.id);
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id');

    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('staff_members')
      .delete()
      .eq('id', staffId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error deleting staff:', error);
      return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Staff DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
