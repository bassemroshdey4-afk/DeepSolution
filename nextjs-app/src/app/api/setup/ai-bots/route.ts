import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface AIBotScenarioData {
  id?: string;
  scenario_type: 'order_confirmation' | 'sales' | 'support' | 'escalation' | 'follow_up';
  is_enabled?: boolean;
  config?: Record<string, unknown>;
}

// Available AI Bot scenarios with descriptions
export const AI_BOT_SCENARIOS = [
  { 
    id: 'order_confirmation', 
    label: 'تأكيد الطلبات', 
    labelEn: 'Order Confirmation',
    description: 'إرسال رسائل تأكيد تلقائية للعملاء عند استلام الطلب',
    descriptionEn: 'Send automatic confirmation messages to customers when order is received'
  },
  { 
    id: 'sales', 
    label: 'مبيعات ذكية', 
    labelEn: 'Smart Sales',
    description: 'الرد على استفسارات العملاء وتقديم توصيات المنتجات',
    descriptionEn: 'Answer customer inquiries and provide product recommendations'
  },
  { 
    id: 'support', 
    label: 'دعم العملاء', 
    labelEn: 'Customer Support',
    description: 'الرد على الأسئلة الشائعة ومتابعة حالة الطلبات',
    descriptionEn: 'Answer FAQs and track order status'
  },
  { 
    id: 'escalation', 
    label: 'التصعيد الذكي', 
    labelEn: 'Smart Escalation',
    description: 'تحويل المحادثات المعقدة لموظف بشري تلقائياً',
    descriptionEn: 'Automatically transfer complex conversations to human agent'
  },
  { 
    id: 'follow_up', 
    label: 'متابعة ما بعد البيع', 
    labelEn: 'Post-Sale Follow-up',
    description: 'إرسال رسائل متابعة بعد التوصيل وطلب التقييم',
    descriptionEn: 'Send follow-up messages after delivery and request reviews'
  },
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

async function getUserTenant(supabase: Awaited<ReturnType<typeof createSupabaseClient>>, userId: string) {
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .single();
  
  return tenantUser?.tenant_id;
}

// GET: List AI bot scenarios
export async function GET() {
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

    const { data: scenarios, error } = await supabase
      .from('ai_bot_scenarios')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error fetching AI scenarios:', error);
      return NextResponse.json({ error: 'Failed to fetch AI scenarios' }, { status: 500 });
    }

    // Merge with available scenarios to show all options
    const mergedScenarios = AI_BOT_SCENARIOS.map(scenario => {
      const existing = scenarios?.find(s => s.scenario_type === scenario.id);
      return {
        ...scenario,
        is_enabled: existing?.is_enabled || false,
        config: existing?.config || {},
        db_id: existing?.id,
      };
    });

    return NextResponse.json({ 
      scenarios: mergedScenarios,
      availableScenarios: AI_BOT_SCENARIOS,
    });
  } catch (error) {
    console.error('AI Bots GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Enable/configure AI bot scenario
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

    const body: AIBotScenarioData = await request.json();

    if (!body.scenario_type) {
      return NextResponse.json({ error: 'Scenario type is required' }, { status: 400 });
    }

    // Validate scenario type
    const validTypes = AI_BOT_SCENARIOS.map(s => s.id);
    if (!validTypes.includes(body.scenario_type)) {
      return NextResponse.json({ error: 'Invalid scenario type' }, { status: 400 });
    }

    // Upsert scenario
    const { data: scenario, error } = await supabase
      .from('ai_bot_scenarios')
      .upsert({
        tenant_id: tenantId,
        scenario_type: body.scenario_type,
        is_enabled: body.is_enabled !== false,
        config: body.config || {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,scenario_type',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving AI scenario:', error);
      return NextResponse.json({ error: 'Failed to save AI scenario' }, { status: 500 });
    }

    return NextResponse.json({ scenario, success: true });
  } catch (error) {
    console.error('AI Bots POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Bulk update scenarios
export async function PUT(request: NextRequest) {
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

    const body: { scenarios: AIBotScenarioData[] } = await request.json();

    if (!body.scenarios || !Array.isArray(body.scenarios)) {
      return NextResponse.json({ error: 'Scenarios array is required' }, { status: 400 });
    }

    // Upsert all scenarios
    const results = await Promise.all(
      body.scenarios.map(async (scenario) => {
        const { data, error } = await supabase
          .from('ai_bot_scenarios')
          .upsert({
            tenant_id: tenantId,
            scenario_type: scenario.scenario_type,
            is_enabled: scenario.is_enabled !== false,
            config: scenario.config || {},
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id,scenario_type',
          })
          .select()
          .single();

        return { scenario: data, error };
      })
    );

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Some AI scenarios failed to save:', errors);
    }

    return NextResponse.json({ 
      scenarios: results.map(r => r.scenario).filter(Boolean),
      success: errors.length === 0,
      partialSuccess: errors.length > 0 && errors.length < results.length,
    });
  } catch (error) {
    console.error('AI Bots PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
