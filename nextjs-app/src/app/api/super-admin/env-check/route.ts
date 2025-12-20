import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Environment variables to check (names only, never values)
const ENV_VARS = [
  // Database
  { key: 'SUPABASE_URL', category: 'Database', description: 'Supabase project URL' },
  { key: 'SUPABASE_ANON_KEY', category: 'Database', description: 'Supabase anonymous key' },
  { key: 'SUPABASE_SERVICE_KEY', category: 'Database', description: 'Supabase service role key' },
  { key: 'NEXT_PUBLIC_SUPABASE_URL', category: 'Database', description: 'Public Supabase URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', category: 'Database', description: 'Public Supabase key' },
  
  // Auth
  { key: 'NEXTAUTH_SECRET', category: 'Auth', description: 'NextAuth secret' },
  { key: 'NEXTAUTH_URL', category: 'Auth', description: 'NextAuth URL' },
  
  // AI
  { key: 'OPENAI_API_KEY', category: 'AI', description: 'OpenAI API key' },
  
  // Integrations
  { key: 'N8N_WEBHOOK_SECRET', category: 'Integrations', description: 'n8n webhook secret' },
  { key: 'N8N_WEBHOOK_URL', category: 'Integrations', description: 'n8n webhook URL' },
  
  // Access Control
  { key: 'BASIC_AUTH_USER', category: 'Access Control', description: 'Basic auth username' },
  { key: 'BASIC_AUTH_PASS', category: 'Access Control', description: 'Basic auth password' },
  { key: 'ENABLE_BASIC_AUTH', category: 'Access Control', description: 'Enable basic auth' },
  
  // Vercel
  { key: 'VERCEL_URL', category: 'Deployment', description: 'Vercel deployment URL' },
  { key: 'VERCEL_ENV', category: 'Deployment', description: 'Vercel environment' },
  
  // App
  { key: 'NODE_ENV', category: 'App', description: 'Node environment' },
];

async function verifySuperAdmin(): Promise<boolean> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return false;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sb-access-token')?.value;
    
    if (!sessionCookie) return false;
    
    const { data: { user } } = await supabase.auth.getUser(sessionCookie);
    if (!user) return false;
    
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    return !!superAdmin;
  } catch {
    return false;
  }
}

type HealthCheckStatus = 'ok' | 'error' | 'warning';
type HealthCheck = { name: string; status: HealthCheckStatus; message: string };

async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  
  // Database check
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('tenants').select('id').limit(1);
      checks.push({
        name: 'Database',
        status: error ? 'error' : 'ok',
        message: error ? 'Connection failed' : 'Connected',
      });
    } else {
      checks.push({
        name: 'Database',
        status: 'error',
        message: 'Not configured',
      });
    }
  } catch {
    checks.push({
      name: 'Database',
      status: 'error',
      message: 'Connection error',
    });
  }
  
  // Auth check
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.auth.admin.listUsers({ perPage: 1 });
      checks.push({
        name: 'Auth Service',
        status: error ? 'warning' : 'ok',
        message: error ? 'Limited access' : 'Operational',
      });
    } else {
      checks.push({
        name: 'Auth Service',
        status: 'warning',
        message: 'Service key not configured',
      });
    }
  } catch {
    checks.push({
      name: 'Auth Service',
      status: 'warning',
      message: 'Check failed',
    });
  }
  
  // OpenAI check
  const openaiKey = process.env.OPENAI_API_KEY;
  checks.push({
    name: 'OpenAI API',
    status: openaiKey ? 'ok' : 'warning',
    message: openaiKey ? 'Key configured' : 'Not configured',
  });
  
  // n8n check
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  checks.push({
    name: 'n8n Integration',
    status: n8nUrl ? 'ok' : 'warning',
    message: n8nUrl ? 'Configured' : 'Not configured',
  });
  
  // Basic Auth check
  const basicAuthEnabled = process.env.ENABLE_BASIC_AUTH === 'true';
  const basicAuthPass = process.env.BASIC_AUTH_PASS;
  checks.push({
    name: 'Basic Auth',
    status: basicAuthEnabled && basicAuthPass ? 'ok' : 'warning',
    message: basicAuthEnabled ? (basicAuthPass ? 'Enabled' : 'Missing password') : 'Disabled',
  });
  
  return checks;
}

export async function GET() {
  // Verify super admin access
  const isSuperAdmin = await verifySuperAdmin();
  
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Check environment variables (existence only, never values)
  const envStatus = ENV_VARS.map(env => ({
    key: env.key,
    category: env.category,
    description: env.description,
    exists: !!process.env[env.key],
  }));
  
  // Run health checks
  const healthChecks = await runHealthChecks();
  
  return NextResponse.json({
    envStatus,
    healthChecks,
    timestamp: new Date().toISOString(),
  });
}
