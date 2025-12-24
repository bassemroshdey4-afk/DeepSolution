'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export interface ProductInput {
  name: string;
  description?: string;
  sku?: string;
  price?: number;
  cost?: number;
  quantity?: number;
  is_active?: boolean;
  barcode?: string;
  compare_at_price?: number;
  low_stock_threshold?: number;
  weight?: number;
  weight_unit?: string;
  is_featured?: boolean;
  category?: string;
  tags?: string[];
  images?: string[];
  metadata?: Record<string, unknown>;
}

export interface Product extends ProductInput {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

// Get current user's tenant_id
async function getCurrentTenantId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  // First, try to get tenant_id from tenant_users table
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  
  if (tenantUser?.tenant_id) {
    return tenantUser.tenant_id;
  }
  
  // Fallback: try profiles table with default_tenant_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_tenant_id')
    .eq('id', user.id)
    .single();
  
  return profile?.default_tenant_id || null;
}

// Create a new product
export async function createProduct(input: ProductInput): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const tenant_id = await getCurrentTenantId(supabase);
    
    if (!tenant_id) {
      return { success: false, error: 'لم يتم العثور على المتجر. يرجى تسجيل الدخول مرة أخرى.' };
    }
    
    const { data, error } = await supabase
      .from('products')
      .insert([{
        tenant_id,
        name: input.name,
        description: input.description || null,
        sku: input.sku || null,
        price: input.price || 0,
        cost: input.cost || 0,
        quantity: input.quantity || 0,
        is_active: input.is_active ?? true,
        barcode: input.barcode || null,
        compare_at_price: input.compare_at_price || null,
        low_stock_threshold: input.low_stock_threshold || 5,
        weight: input.weight || null,
        weight_unit: input.weight_unit || 'kg',
        is_featured: input.is_featured || false,
        category: input.category || null,
        tags: input.tags || [],
        images: input.images || [],
        metadata: input.metadata || {},
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating product:', error);
      return { success: false, error: error.message };
    }
    
    revalidatePath('/products');
    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { success: false, error: 'حدث خطأ غير متوقع' };
  }
}

// Get all products for current tenant
export async function getProducts(): Promise<{ success: boolean; data?: Product[]; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const tenant_id = await getCurrentTenantId(supabase);
    
    if (!tenant_id) {
      return { success: false, error: 'لم يتم العثور على المتجر' };
    }
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching products:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { success: false, error: 'حدث خطأ غير متوقع' };
  }
}

// Get a single product by ID
export async function getProduct(id: string): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const tenant_id = await getCurrentTenantId(supabase);
    
    if (!tenant_id) {
      return { success: false, error: 'لم يتم العثور على المتجر' };
    }
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();
    
    if (error) {
      console.error('Error fetching product:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { success: false, error: 'حدث خطأ غير متوقع' };
  }
}

// Update a product
export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const tenant_id = await getCurrentTenantId(supabase);
    
    if (!tenant_id) {
      return { success: false, error: 'لم يتم العثور على المتجر' };
    }
    
    const { data, error } = await supabase
      .from('products')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating product:', error);
      return { success: false, error: error.message };
    }
    
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { success: false, error: 'حدث خطأ غير متوقع' };
  }
}

// Delete a product
export async function deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const tenant_id = await getCurrentTenantId(supabase);
    
    if (!tenant_id) {
      return { success: false, error: 'لم يتم العثور على المتجر' };
    }
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);
    
    if (error) {
      console.error('Error deleting product:', error);
      return { success: false, error: error.message };
    }
    
    revalidatePath('/products');
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { success: false, error: 'حدث خطأ غير متوقع' };
  }
}

// Get product statistics
export async function getProductStats(): Promise<{ 
  success: boolean; 
  data?: { 
    total: number; 
    active: number; 
    outOfStock: number; 
    draft: number;
  }; 
  error?: string 
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const tenant_id = await getCurrentTenantId(supabase);
    
    if (!tenant_id) {
      return { success: false, error: 'لم يتم العثور على المتجر' };
    }
    
    const { data: products, error } = await supabase
      .from('products')
      .select('id, is_active, quantity')
      .eq('tenant_id', tenant_id);
    
    if (error) {
      console.error('Error fetching product stats:', error);
      return { success: false, error: error.message };
    }
    
    const total = products?.length || 0;
    const active = products?.filter(p => p.is_active).length || 0;
    const outOfStock = products?.filter(p => (p.quantity || 0) <= 0).length || 0;
    const draft = products?.filter(p => !p.is_active).length || 0;
    
    return { success: true, data: { total, active, outOfStock, draft } };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { success: false, error: 'حدث خطأ غير متوقع' };
  }
}
