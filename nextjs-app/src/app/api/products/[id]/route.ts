/**
 * Products [id] API Routes
 * 
 * GET /api/products/[id] - Get single product
 * PUT /api/products/[id] - Update product
 * DELETE /api/products/[id] - Delete product
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

// GET /api/products/[id]
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
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Product GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id]
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
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.cost !== undefined) updateData.cost = body.cost ? parseFloat(body.cost) : null;
    if (body.stock_quantity !== undefined) updateData.stock_quantity = parseInt(body.stock_quantity);
    if (body.low_stock_threshold !== undefined) updateData.low_stock_threshold = parseInt(body.low_stock_threshold);
    if (body.category !== undefined) updateData.category = body.category;
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Product update error:', error);
      return NextResponse.json(
        { error: 'Failed to update product' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Product PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id]
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

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Product delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete product' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
