import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Types for setup data
interface SetupData {
  current_step?: number;
  setup_completed?: boolean;
  order_sources?: string[];
  multi_warehouse?: boolean;
  support_mode?: 'human' | 'bot' | 'hybrid';
  ai_bots_enabled?: boolean;
  whatsapp_bot_enabled?: boolean;
  meta_bot_enabled?: boolean;
  sales_agent_enabled?: boolean;
  training_sources?: string[];
  staff_count?: number;
  platforms_enabled?: string[];
}

// Available order sources
export const ORDER_SOURCES = [
  { id: 'website', label: 'موقع إلكتروني', labelEn: 'Website' },
  { id: 'whatsapp', label: 'واتساب', labelEn: 'WhatsApp' },
  { id: 'instagram', label: 'انستجرام', labelEn: 'Instagram' },
  { id: 'facebook', label: 'فيسبوك', labelEn: 'Facebook' },
  { id: 'tiktok', label: 'تيك توك', labelEn: 'TikTok' },
  { id: 'phone', label: 'هاتف', labelEn: 'Phone' },
  { id: 'marketplace', label: 'سوق إلكتروني (أمازون/نون)', labelEn: 'Marketplace (Amazon/Noon)' },
  { id: 'pos', label: 'نقطة بيع', labelEn: 'Point of Sale' },
];

// Available platforms
export const PLATFORMS = [
  { id: 'shopify', label: 'شوبيفاي', labelEn: 'Shopify' },
  { id: 'woocommerce', label: 'ووكومرس', labelEn: 'WooCommerce' },
  { id: 'salla', label: 'سلة', labelEn: 'Salla' },
  { id: 'zid', label: 'زد', labelEn: 'Zid' },
  { id: 'magento', label: 'ماجنتو', labelEn: 'Magento' },
  { id: 'custom', label: 'موقع مخصص', labelEn: 'Custom Website' },
];

// Staff roles
export const STAFF_ROLES = [
  { id: 'admin', label: 'مدير', labelEn: 'Admin' },
  { id: 'manager', label: 'مدير عمليات', labelEn: 'Operations Manager' },
  { id: 'agent', label: 'موظف مبيعات', labelEn: 'Sales Agent' },
  { id: 'warehouse', label: 'موظف مخزن', labelEn: 'Warehouse Staff' },
  { id: 'support', label: 'دعم عملاء', labelEn: 'Customer Support' },
];

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

// Helper to get user's tenant
async function getUserTenant(supabase: Awaited<ReturnType<typeof createSupabaseClient>>, userId: string) {
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .single();
  
  return tenantUser?.tenant_id;
}

// GET: Fetch current setup state
export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await getUserTenant(supabase, user.id);
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found. Please complete onboarding first.' }, { status: 400 });
    }

    // Get or create setup record
    let { data: setup, error } = await supabase
      .from('tenant_setup')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Record doesn't exist, create it
      const { data: newSetup, error: insertError } = await supabase
        .from('tenant_setup')
        .insert({ tenant_id: tenantId })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating setup:', insertError);
        return NextResponse.json({ error: 'Failed to create setup record' }, { status: 500 });
      }

      setup = newSetup;
    } else if (error) {
      console.error('Error fetching setup:', error);
      return NextResponse.json({ error: 'Failed to fetch setup' }, { status: 500 });
    }

    // Get warehouses
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('*')
      .eq('tenant_id', tenantId);

    // Get staff members
    const { data: staff } = await supabase
      .from('staff_members')
      .select('*')
      .eq('tenant_id', tenantId);

    // Get AI bot scenarios
    const { data: aiScenarios } = await supabase
      .from('ai_bot_scenarios')
      .select('*')
      .eq('tenant_id', tenantId);

    return NextResponse.json({ 
      setup, 
      warehouses: warehouses || [],
      staff: staff || [],
      aiScenarios: aiScenarios || [],
      constants: {
        orderSources: ORDER_SOURCES,
        platforms: PLATFORMS,
        staffRoles: STAFF_ROLES,
      }
    });
  } catch (error) {
    console.error('Setup GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update setup step
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

    const body: SetupData & { step?: number } = await request.json();
    const { step, ...data } = body;

    // Update current step if provided
    if (typeof step === 'number') {
      data.current_step = step;
    }

    // Upsert setup data
    const { data: setup, error } = await supabase
      .from('tenant_setup')
      .upsert({
        tenant_id: tenantId,
        ...data,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating setup:', error);
      return NextResponse.json({ error: 'Failed to update setup' }, { status: 500 });
    }

    return NextResponse.json({ setup, success: true });
  } catch (error) {
    console.error('Setup POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Complete setup
export async function PUT() {
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

    // Mark setup as completed
    const { data: setup, error } = await supabase
      .from('tenant_setup')
      .update({
        setup_completed: true,
        current_step: 7,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error completing setup:', error);
      return NextResponse.json({ error: 'Failed to complete setup' }, { status: 500 });
    }

    // Update tenant settings - mark setup as done
    await supabase
      .from('tenants')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    return NextResponse.json({ 
      success: true, 
      setup,
      message: 'Setup completed successfully' 
    });
  } catch (error) {
    console.error('Setup PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
