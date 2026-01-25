/**
 * Orders [id] API Routes
 * 
 * GET /api/orders/[id] - Get single order with items
 * PUT /api/orders/[id] - Update order (status, etc.)
 * DELETE /api/orders/[id] - Cancel/delete order
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

// GET /api/orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized - No tenant selected' },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, products(name, sku, image_url))')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Order GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized - No tenant selected' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    
    if (body.status !== undefined) updateData.status = body.status;
    if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;
    if (body.payment_method !== undefined) updateData.payment_method = body.payment_method;
    if (body.shipping_address !== undefined) updateData.shipping_address = body.shipping_address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*, order_items(*)')
      .single();

    if (error) {
      console.error('Order update error:', error);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Order PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized - No tenant selected' },
        { status: 401 }
      );
    }

    // Check if order can be deleted (only pending orders)
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'pending' && order.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only pending or cancelled orders can be deleted' },
        { status: 400 }
      );
    }

    // Delete order items first (cascade should handle this, but being explicit)
    await supabaseAdmin
      .from('order_items')
      .delete()
      .eq('order_id', id);

    // Delete order
    const { error } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Order delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete order' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Order DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
