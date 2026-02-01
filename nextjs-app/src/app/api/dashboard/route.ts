import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Dashboard API - جلب بيانات Dashboard المجمعة
 * 
 * PROTECTED: يتطلب onboarding_completed = true و setup_completed = true
 * NO DEFAULTS: لا يُرجع بيانات افتراضية - DB values only
 */

interface DashboardData {
  profile: {
    name: string | null;
    company_name: string | null;
    country: string | null;
    language: string | null;
    currency: string | null;
    monthly_order_volume: string | null;
    recommended_plan: string | null;
  };
  setup: {
    setup_completed: boolean;
    current_step: number;
    website_option: string | null;
    order_sources: string[];
    warehouse_count: number;
    support_mode: string | null;
    support_channels: string[];
    employee_count: number;
    employee_roles: string[];
  } | null;
  stats: {
    total_orders: number;
    pending_orders: number;
    total_products: number;
    low_stock_products: number;
    total_revenue: number;
    monthly_revenue: number;
  };
  features: {
    has_ai_bots: boolean;
    has_human_support: boolean;
    has_hybrid_support: boolean;
    has_whatsapp: boolean;
    has_instagram: boolean;
    has_website: boolean;
    has_multi_warehouse: boolean;
  };
  next_steps: {
    id: string;
    title: string;
    description: string;
    href: string;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
  }[];
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

/**
 * Log API access decision
 */
function logApiAccess(data: {
  user_id: string | null;
  onboarding_completed: boolean | null;
  setup_completed: boolean | null;
  access_granted: boolean;
  reason: string;
}) {
  console.log('[API-DASHBOARD]', JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data
  }));
}

export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      logApiAccess({
        user_id: null,
        onboarding_completed: null,
        setup_completed: null,
        access_granted: false,
        reason: 'No authenticated user'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ============================================================
    // JOURNEY CHECK: Verify onboarding and setup are completed
    // NO DEFAULTS - DB values only
    // ============================================================

    // Get profile data - check onboarding status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, company_name, country, language, currency, monthly_order_volume, recommended_plan, onboarding_completed')
      .eq('id', user.id)
      .single();

    // STRICT CHECK: onboarding_completed must be explicitly true
    if (profile?.onboarding_completed !== true) {
      logApiAccess({
        user_id: user.id,
        onboarding_completed: profile?.onboarding_completed ?? null,
        setup_completed: null,
        access_granted: false,
        reason: profileError 
          ? `Profile error: ${profileError.message}` 
          : 'onboarding_completed is not true'
      });
      return NextResponse.json({ 
        error: 'Onboarding not completed',
        redirect: '/onboarding'
      }, { status: 403 });
    }

    // Get tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantUser?.tenant_id) {
      logApiAccess({
        user_id: user.id,
        onboarding_completed: true,
        setup_completed: null,
        access_granted: false,
        reason: tenantError 
          ? `Tenant error: ${tenantError.message}` 
          : 'No tenant found'
      });
      return NextResponse.json({ 
        error: 'No tenant found',
        redirect: '/onboarding'
      }, { status: 403 });
    }

    // Get setup data - check setup status
    const { data: setupData, error: setupError } = await supabase
      .from('tenant_setup')
      .select('*')
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    // STRICT CHECK: setup_completed must be explicitly true
    if (setupData?.setup_completed !== true) {
      logApiAccess({
        user_id: user.id,
        onboarding_completed: true,
        setup_completed: setupData?.setup_completed ?? null,
        access_granted: false,
        reason: setupError 
          ? `Setup error: ${setupError.message}` 
          : 'setup_completed is not true'
      });
      return NextResponse.json({ 
        error: 'Setup not completed',
        redirect: '/setup'
      }, { status: 403 });
    }

    // ============================================================
    // JOURNEY VERIFIED - Proceed with dashboard data
    // ============================================================
    
    logApiAccess({
      user_id: user.id,
      onboarding_completed: true,
      setup_completed: true,
      access_granted: true,
      reason: 'All journey steps completed'
    });

    // Build setup object from DB - NO DEFAULTS
    const setup = {
      setup_completed: setupData.setup_completed,
      current_step: setupData.current_step,
      website_option: setupData.website_option,
      order_sources: setupData.order_sources || [],
      warehouse_count: setupData.warehouse_count,
      support_mode: setupData.support_mode,
      support_channels: setupData.support_channels || [],
      employee_count: setupData.employee_count,
      employee_roles: setupData.employee_roles || [],
    };

    // Get orders count
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantUser.tenant_id);

    const { count: pendingCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantUser.tenant_id)
      .eq('status', 'pending');

    // Get products count
    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantUser.tenant_id);

    // Get low stock products (stock < 10)
    const { count: lowStockCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantUser.tenant_id)
      .lt('stock', 10);

    // Get revenue (sum of delivered orders)
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total')
      .eq('tenant_id', tenantUser.tenant_id)
      .eq('status', 'delivered');

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

    // Get monthly revenue (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: monthlyRevenueData } = await supabase
      .from('orders')
      .select('total')
      .eq('tenant_id', tenantUser.tenant_id)
      .eq('status', 'delivered')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const monthlyRevenue = monthlyRevenueData?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

    const stats = {
      total_orders: ordersCount || 0,
      pending_orders: pendingCount || 0,
      total_products: productsCount || 0,
      low_stock_products: lowStockCount || 0,
      total_revenue: totalRevenue,
      monthly_revenue: monthlyRevenue,
    };

    // Determine features based on setup - NO DEFAULTS
    const features = {
      has_ai_bots: setup.support_mode === 'bot' || setup.support_mode === 'hybrid',
      has_human_support: setup.support_mode === 'human' || setup.support_mode === 'hybrid',
      has_hybrid_support: setup.support_mode === 'hybrid',
      has_whatsapp: setup.support_channels?.includes('whatsapp') || setup.order_sources?.includes('whatsapp'),
      has_instagram: setup.support_channels?.includes('instagram') || setup.order_sources?.includes('instagram'),
      has_website: setup.order_sources?.includes('website') || setup.website_option === 'build',
      has_multi_warehouse: (setup.warehouse_count || 0) > 1,
    };

    // Generate next steps based on current state
    const next_steps: DashboardData['next_steps'] = [];

    // Check if products exist
    if (stats.total_products === 0) {
      next_steps.push({
        id: 'add_products',
        title: 'أضف منتجاتك',
        description: 'أضف منتجاتك الأولى لبدء البيع',
        href: '/products/new',
        priority: 'high',
        completed: false,
      });
    }

    // Check if orders exist
    if (stats.total_orders === 0 && stats.total_products > 0) {
      next_steps.push({
        id: 'first_order',
        title: 'أنشئ أول طلب',
        description: 'أنشئ طلبك الأول لتجربة النظام',
        href: '/orders/new',
        priority: 'medium',
        completed: false,
      });
    }

    // Check low stock
    if (stats.low_stock_products > 0) {
      next_steps.push({
        id: 'restock',
        title: 'تحديث المخزون',
        description: `لديك ${stats.low_stock_products} منتجات بمخزون منخفض`,
        href: '/inventory',
        priority: 'medium',
        completed: false,
      });
    }

    // Suggest AI features if not using bots
    if (!features.has_ai_bots) {
      next_steps.push({
        id: 'enable_ai',
        title: 'فعّل الذكاء الاصطناعي',
        description: 'استخدم AI لتحسين خدمة العملاء والمبيعات',
        href: '/settings',
        priority: 'low',
        completed: false,
      });
    }

    const dashboardData: DashboardData = {
      profile: {
        name: profile?.name || null,
        company_name: profile?.company_name || null,
        country: profile?.country || null,
        language: profile?.language || null,
        currency: profile?.currency || null,
        monthly_order_volume: profile?.monthly_order_volume || null,
        recommended_plan: profile?.recommended_plan || null,
      },
      setup,
      stats,
      features,
      next_steps,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
