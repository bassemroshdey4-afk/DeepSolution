import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create Supabase client only if env vars are available
function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  return createClient(url, key);
}

// GET /api/shipping - List shipments
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      // Return empty data if Supabase is not configured
      return NextResponse.json({
        data: [],
        stats: { total: 0, pending: 0, in_transit: 0, delivered: 0 },
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        message: 'Database not configured'
      });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const carrier = searchParams.get('carrier');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('shipments')
      .select('*, orders(order_number, customer_name, city)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (carrier) {
      query = query.eq('carrier', carrier);
    }

    const { data, error, count } = await query;

    if (error) {
      // If table doesn't exist, return empty
      if (error.code === '42P01') {
        return NextResponse.json({
          data: [],
          stats: { total: 0, pending: 0, in_transit: 0, delivered: 0 },
          pagination: { page, limit, total: 0, totalPages: 0 }
        });
      }
      throw error;
    }

    // Get stats
    const { data: allShipments } = await supabase
      .from('shipments')
      .select('status');
    
    const stats = {
      total: allShipments?.length || 0,
      pending: allShipments?.filter(s => s.status === 'pending').length || 0,
      in_transit: allShipments?.filter(s => s.status === 'in_transit').length || 0,
      delivered: allShipments?.filter(s => s.status === 'delivered').length || 0,
    };

    return NextResponse.json({
      data: data || [],
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Shipping GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shipments', data: [], stats: {} },
      { status: 500 }
    );
  }
}

// POST /api/shipping - Create shipment
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { order_id, carrier, tracking_number, estimated_delivery, shipping_cost, notes } = body;

    if (!order_id || !carrier) {
      return NextResponse.json(
        { error: 'order_id and carrier are required' },
        { status: 400 }
      );
    }

    // Generate tracking number if not provided
    const finalTrackingNumber = tracking_number || `DS${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const { data, error } = await supabase
      .from('shipments')
      .insert({
        order_id,
        carrier,
        tracking_number: finalTrackingNumber,
        estimated_delivery,
        shipping_cost: shipping_cost || 0,
        notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Update order status to shipped
    await supabase
      .from('orders')
      .update({ status: 'shipped' })
      .eq('id', order_id);

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Shipping POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create shipment' },
      { status: 500 }
    );
  }
}
