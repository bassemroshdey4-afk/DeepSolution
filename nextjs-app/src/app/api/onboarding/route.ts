import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Types for onboarding data
interface OnboardingData {
  current_step?: number;
  completed?: boolean;
  language?: string;
  country?: string;
  suggested_currency?: string;
  suggested_timezone?: string;
  company_name?: string;
  company_slug?: string;
  logo_url?: string;
  currency?: string;
  timezone?: string;
  default_language?: string;
  monthly_orders?: string;
  recommended_plan?: string;
  industry?: string;
  sales_channels?: string[];
  multi_warehouse?: boolean;
  cod_enabled?: boolean;
  team_size?: string;
}

// Country to currency/timezone mapping
const COUNTRY_DEFAULTS: Record<string, { currency: string; timezone: string }> = {
  EG: { currency: 'EGP', timezone: 'Africa/Cairo' },
  SA: { currency: 'SAR', timezone: 'Asia/Riyadh' },
  AE: { currency: 'AED', timezone: 'Asia/Dubai' },
  KW: { currency: 'KWD', timezone: 'Asia/Kuwait' },
  QA: { currency: 'QAR', timezone: 'Asia/Qatar' },
  BH: { currency: 'BHD', timezone: 'Asia/Bahrain' },
  OM: { currency: 'OMR', timezone: 'Asia/Muscat' },
  JO: { currency: 'JOD', timezone: 'Asia/Amman' },
  LB: { currency: 'LBP', timezone: 'Asia/Beirut' },
  IQ: { currency: 'IQD', timezone: 'Asia/Baghdad' },
  MA: { currency: 'MAD', timezone: 'Africa/Casablanca' },
  TN: { currency: 'TND', timezone: 'Africa/Tunis' },
  DZ: { currency: 'DZD', timezone: 'Africa/Algiers' },
  US: { currency: 'USD', timezone: 'America/New_York' },
  GB: { currency: 'GBP', timezone: 'Europe/London' },
};

// Monthly orders to plan recommendation
const PLAN_RECOMMENDATIONS: Record<string, string> = {
  '0-50': 'starter',
  '51-300': 'pro',
  '301-1500': 'business',
  '1500+': 'enterprise',
};

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

// GET: Fetch current onboarding state
export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create onboarding record
    let { data: onboarding, error } = await supabase
      .from('tenant_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // Record doesn't exist, create it
      const { data: newOnboarding, error: insertError } = await supabase
        .from('tenant_onboarding')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating onboarding:', insertError);
        return NextResponse.json({ error: 'Failed to create onboarding record' }, { status: 500 });
      }

      onboarding = newOnboarding;
    } else if (error) {
      console.error('Error fetching onboarding:', error);
      return NextResponse.json({ error: 'Failed to fetch onboarding' }, { status: 500 });
    }

    return NextResponse.json({ onboarding, user: { id: user.id, email: user.email, name: user.user_metadata?.full_name } });
  } catch (error) {
    console.error('Onboarding GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update onboarding step
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: OnboardingData & { step?: number } = await request.json();
    const { step, ...data } = body;

    // Auto-fill suggestions based on country
    if (data.country && COUNTRY_DEFAULTS[data.country]) {
      data.suggested_currency = COUNTRY_DEFAULTS[data.country].currency;
      data.suggested_timezone = COUNTRY_DEFAULTS[data.country].timezone;
    }

    // Auto-recommend plan based on monthly orders
    if (data.monthly_orders && PLAN_RECOMMENDATIONS[data.monthly_orders]) {
      data.recommended_plan = PLAN_RECOMMENDATIONS[data.monthly_orders];
    }

    // Update current step if provided
    if (typeof step === 'number') {
      data.current_step = step;
    }

    // Upsert onboarding data
    const { data: onboarding, error } = await supabase
      .from('tenant_onboarding')
      .upsert({
        user_id: user.id,
        ...data,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating onboarding:', error);
      return NextResponse.json({ error: 'Failed to update onboarding' }, { status: 500 });
    }

    return NextResponse.json({ onboarding, success: true });
  } catch (error) {
    console.error('Onboarding POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Complete onboarding and create tenant
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get onboarding data
    const { data: onboarding, error: fetchError } = await supabase
      .from('tenant_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !onboarding) {
      return NextResponse.json({ error: 'Onboarding data not found' }, { status: 404 });
    }

    // Create tenant with onboarding data
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: onboarding.company_name,
        slug: onboarding.company_slug || onboarding.company_name?.toLowerCase().replace(/\s+/g, '-'),
        owner_id: user.id,
        plan: onboarding.recommended_plan || 'trial',
        settings: {
          language: onboarding.default_language || onboarding.language,
          country: onboarding.country,
          currency: onboarding.currency || onboarding.suggested_currency,
          timezone: onboarding.timezone || onboarding.suggested_timezone,
          industry: onboarding.industry,
          sales_channels: onboarding.sales_channels,
          multi_warehouse: onboarding.multi_warehouse,
          cod_enabled: onboarding.cod_enabled,
          team_size: onboarding.team_size,
          logo_url: onboarding.logo_url,
        },
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
    }

    // Add user as tenant owner
    const { error: memberError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding tenant member:', memberError);
      // Non-fatal, continue
    }

    // Update onboarding as completed
    const { error: updateError } = await supabase
      .from('tenant_onboarding')
      .update({
        tenant_id: tenant.id,
        completed: true,
        current_step: 6,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error completing onboarding:', updateError);
    }

    // Update profile if exists
    await supabase
      .from('profiles')
      .update({
        default_tenant_id: tenant.id,
        onboarding_completed: true,
      })
      .eq('id', user.id);

    return NextResponse.json({ 
      success: true, 
      tenant,
      message: 'Onboarding completed successfully' 
    });
  } catch (error) {
    console.error('Onboarding PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
