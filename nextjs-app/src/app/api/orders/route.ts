/**
 * Orders API Routes
 * 
 * GET /api/orders - List all orders for tenant
 * POST /api/orders - Create new order
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

// Helper to get tenant_id from session
async function getTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get('tenant_id')?.value;
  return tenantId || null;
}

// GET /api/orders
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getTenantId();
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized - No tenant selected' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';

    let query = supabaseAdmin
      .from('orders')
      .select('*, order_items(*, products(name, sku))', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Orders fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Get stats
    const { data: statsData } = await supabaseAdmin
      .from('orders')
      .select('status, total_amount')
      .eq('tenant_id', tenantId);

    const stats = {
      total: statsData?.length || 0,
      pending: statsData?.filter(o => o.status === 'pending').length || 0,
      shipped: statsData?.filter(o => o.status === 'shipped').length || 0,
      delivered: statsData?.filter(o => o.status === 'delivered').length || 0,
      revenue: statsData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
    };

    return NextResponse.json({
      data,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/orders
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getTenantId();
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized - No tenant selected' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.customer_name || !body.customer_phone || !body.shipping_address || !body.city) {
      return NextResponse.json(
        { error: 'Customer name, phone, address, and city are required' },
        { status: 400 }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'At least one order item is required' },
        { status: 400 }
      );
    }

    // Generate order number
    const { data: orderNumberData } = await supabaseAdmin
      .rpc('generate_order_number', { p_tenant_id: tenantId });
    
    const orderNumber = orderNumberData || `DS-${Date.now()}`;

    // Calculate totals
    let totalAmount = 0;
    const orderItems = [];

    for (const item of body.items) {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', item.product_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.product_id} not found` },
          { status: 400 }
        );
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal,
      });
    }

    // Apply shipping and discount
    const shippingCost = parseFloat(body.shipping_cost || '0');
    const discountAmount = parseFloat(body.discount_amount || '0');
    totalAmount = totalAmount + shippingCost - discountAmount;

    // Create order
    const orderData = {
      tenant_id: tenantId,
      order_number: orderNumber,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_email: body.customer_email || null,
      shipping_address: body.shipping_address,
      city: body.city,
      total_amount: totalAmount,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      status: 'pending',
      payment_status: body.payment_status || 'pending',
      payment_method: body.payment_method || null,
      notes: body.notes || null,
      metadata: body.metadata || {},
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Order create error:', orderError);
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      );
    }

    // Create order items
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      console.error('Order items create error:', itemsError);
      // Rollback order
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json(
        { error: 'Failed to create order items' },
        { status: 500 }
      );
    }

    // Fetch complete order with items
    const { data: completeOrder } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order.id)
      .single();

    return NextResponse.json({ data: completeOrder }, { status: 201 });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
