/**
 * Inventory API Routes
 * 
 * GET /api/inventory - List inventory movements
 * POST /api/inventory - Create inventory adjustment
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

// GET /api/inventory
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const productId = searchParams.get('product_id') || '';
    const movementType = searchParams.get('movement_type') || '';

    let query = supabaseAdmin
      .from('inventory_movements')
      .select('*, products(name, sku)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (productId) {
      query = query.eq('product_id', productId);
    }
    if (movementType) {
      query = query.eq('movement_type', movementType);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Inventory fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch inventory movements' },
        { status: 500 }
      );
    }

    // Get low stock products
    const { data: lowStockProducts } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .filter('stock_quantity', 'lte', 'low_stock_threshold');

    return NextResponse.json({
      data,
      lowStockProducts: lowStockProducts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/inventory
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
    if (!body.product_id || body.quantity === undefined || !body.movement_type) {
      return NextResponse.json(
        { error: 'Product ID, quantity, and movement type are required' },
        { status: 400 }
      );
    }

    // Validate movement type
    const validTypes = ['in', 'out', 'adjustment'];
    if (!validTypes.includes(body.movement_type)) {
      return NextResponse.json(
        { error: 'Invalid movement type. Must be: in, out, or adjustment' },
        { status: 400 }
      );
    }

    // Get current product stock
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('stock_quantity')
      .eq('id', body.product_id)
      .eq('tenant_id', tenantId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const quantity = parseInt(body.quantity);
    const previousStock = product.stock_quantity;
    let newStock: number;

    switch (body.movement_type) {
      case 'in':
        newStock = previousStock + Math.abs(quantity);
        break;
      case 'out':
        newStock = previousStock - Math.abs(quantity);
        if (newStock < 0) {
          return NextResponse.json(
            { error: 'Insufficient stock' },
            { status: 400 }
          );
        }
        break;
      case 'adjustment':
        newStock = quantity; // Direct set
        break;
      default:
        newStock = previousStock;
    }

    // Create inventory movement
    const movementData = {
      tenant_id: tenantId,
      product_id: body.product_id,
      movement_type: body.movement_type,
      quantity: body.movement_type === 'adjustment' ? newStock - previousStock : quantity,
      previous_stock: previousStock,
      new_stock: newStock,
      reference_type: body.reference_type || 'manual',
      reference_id: body.reference_id || null,
      notes: body.notes || null,
      created_by: body.created_by || null,
    };

    const { data: movement, error: movementError } = await supabaseAdmin
      .from('inventory_movements')
      .insert(movementData)
      .select()
      .single();

    if (movementError) {
      console.error('Inventory movement create error:', movementError);
      return NextResponse.json(
        { error: 'Failed to create inventory movement' },
        { status: 500 }
      );
    }

    // Update product stock
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', body.product_id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('Product stock update error:', updateError);
      // Rollback movement
      await supabaseAdmin.from('inventory_movements').delete().eq('id', movement.id);
      return NextResponse.json(
        { error: 'Failed to update product stock' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: movement,
      product: {
        id: body.product_id,
        previous_stock: previousStock,
        new_stock: newStock,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
