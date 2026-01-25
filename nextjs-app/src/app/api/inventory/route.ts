import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ data: [], stats: { totalItems: 0, lowStock: 0, outOfStock: 0, totalValue: 0 }, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, message: 'Database not configured' });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('inventory')
      .select('*, products(name, sku)', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ data: [], stats: {}, pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      throw error;
    }

    const { data: allInventory } = await supabase.from('inventory').select('quantity, unit_cost');
    const stats = {
      totalItems: allInventory?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0,
      lowStock: allInventory?.filter(i => i.quantity > 0 && i.quantity <= 10).length || 0,
      outOfStock: allInventory?.filter(i => i.quantity === 0).length || 0,
      totalValue: allInventory?.reduce((sum, i) => sum + ((i.quantity || 0) * (i.unit_cost || 0)), 0) || 0,
    };

    return NextResponse.json({
      data: data || [],
      stats,
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    console.error('Inventory GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory', data: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    
    const body = await request.json();
    const { data, error } = await supabase.from('inventory').insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Inventory POST error:', error);
    return NextResponse.json({ error: 'Failed to create inventory' }, { status: 500 });
  }
}
