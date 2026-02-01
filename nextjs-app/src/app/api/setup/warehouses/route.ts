import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface WarehouseData {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  is_default?: boolean;
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

// GET: List warehouses
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

    const { data: warehouses, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching warehouses:', error);
      return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
    }

    return NextResponse.json({ warehouses: warehouses || [] });
  } catch (error) {
    console.error('Warehouses GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create warehouse
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

    const body: WarehouseData = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Warehouse name is required' }, { status: 400 });
    }

    // If this is the first warehouse or marked as default, ensure only one default
    if (body.is_default) {
      await supabase
        .from('warehouses')
        .update({ is_default: false })
        .eq('tenant_id', tenantId);
    }

    // Check if this is the first warehouse
    const { count } = await supabase
      .from('warehouses')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .insert({
        tenant_id: tenantId,
        name: body.name,
        address: body.address,
        city: body.city,
        country: body.country || 'SA',
        is_default: body.is_default || count === 0, // First warehouse is default
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating warehouse:', error);
      return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 });
    }

    return NextResponse.json({ warehouse, success: true });
  } catch (error) {
    console.error('Warehouses POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update warehouse
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

    const body: WarehouseData = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Warehouse ID is required' }, { status: 400 });
    }

    // If setting as default, unset others
    if (body.is_default) {
      await supabase
        .from('warehouses')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .neq('id', body.id);
    }

    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .update({
        name: body.name,
        address: body.address,
        city: body.city,
        country: body.country,
        is_default: body.is_default,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating warehouse:', error);
      return NextResponse.json({ error: 'Failed to update warehouse' }, { status: 500 });
    }

    return NextResponse.json({ warehouse, success: true });
  } catch (error) {
    console.error('Warehouses PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove warehouse
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
    const warehouseId = searchParams.get('id');

    if (!warehouseId) {
      return NextResponse.json({ error: 'Warehouse ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', warehouseId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error deleting warehouse:', error);
      return NextResponse.json({ error: 'Failed to delete warehouse' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Warehouses DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
