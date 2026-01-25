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
      return NextResponse.json({ data: [], stats: { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0 }, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, message: 'Database not configured' });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ data: [], stats: {}, pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      throw error;
    }

    const { data: allOrders } = await supabase.from('orders').select('status');
    const stats = {
      total: allOrders?.length || 0,
      pending: allOrders?.filter(o => o.status === 'pending').length || 0,
      processing: allOrders?.filter(o => o.status === 'processing').length || 0,
      shipped: allOrders?.filter(o => o.status === 'shipped').length || 0,
      delivered: allOrders?.filter(o => o.status === 'delivered').length || 0,
    };

    return NextResponse.json({
      data: data || [],
      stats,
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    console.error('Orders GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders', data: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    
    const body = await request.json();
    const orderNumber = 'ORD-' + Date.now();
    const { data, error } = await supabase.from('orders').insert({ ...body, order_number: orderNumber, status: 'pending' }).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Orders POST error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
