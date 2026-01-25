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
  { key: 'GEMINI_API_KEY', category: 'AI', description: 'Google Gemini API key' },
  { key: 'AI_PROVIDER', category: 'AI', description: 'AI provider (openai/gemini)' },
  
  // n8n Integration
  { key: 'N8N_INSTANCE_URL', category: 'n8n', description: 'n8n instance URL (e.g., https://your-workspace.app.n8n.cloud)' },
  { key: 'N8N_API_KEY', category: 'n8n', description: 'n8n API key from Settings > API' },
  { key: 'N8N_WEBHOOK_BASE_URL', category: 'n8n', description: 'n8n webhook base URL' },
  { key: 'N8N_WEBHOOK_SECRET', category: 'n8n', description: 'n8n webhook secret' },
  { key: 'N8N_WEBHOOK_URL', category: 'n8n', description: 'n8n webhook URL (legacy)' },
  
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
type HealthCheck = { name: string; status: HealthCheckStatus; message: string; details?: unknown };

interface N8nTestResult {
  url: string;
  status: number;
  ok: boolean;
  error?: string;
  message: string;
  workflowCount?: number;
}

async function testN8nConnection(): Promise<N8nTestResult> {
  const n8nUrl = process.env.N8N_INSTANCE_URL;
  const n8nApiKey = process.env.N8N_API_KEY;

  if (!n8nUrl) {
    return {
      url: '',
      status: 0,
      ok: false,
      message: 'N8N_INSTANCE_URL not configured',
    };
  }

  if (!n8nApiKey) {
    return {
      url: n8nUrl,
      status: 0,
      ok: false,
      message: 'N8N_API_KEY not configured',
    };
  }

  try {
    // Extract base URL (remove /mcp-server/http if present)
    let baseUrl = n8nUrl.replace(/\/mcp-server\/http\/?$/, '');
    baseUrl = baseUrl.replace(/\/$/, '');
    
    const testUrl = `${baseUrl}/api/v1/workflows`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    
    if (response.status === 200) {
      try {
        const data = JSON.parse(responseText);
        return {
          url: testUrl,
          status: 200,
          ok: true,
          message: `Connected! Found ${data.data?.length || 0} workflows.`,
          workflowCount: data.data?.length || 0,
        };
      } catch {
        return {
          url: testUrl,
          status: 200,
          ok: false,
          message: 'Response received but not valid JSON',
        };
      }
    } else if (response.status === 401 || response.status === 403) {
      return {
        url: testUrl,
        status: response.status,
        ok: false,
        message: 'API Key is invalid or expired. Go to n8n Settings > API to create a new key.',
      };
    } else if (response.status === 404) {
      if (responseText.includes('No workspace here')) {
        return {
          url: testUrl,
          status: 404,
          ok: false,
          message: 'URL is WRONG - this workspace does not exist. Check the correct URL from your n8n dashboard.',
        };
      }
      return {
        url: testUrl,
        status: 404,
        ok: false,
        message: 'API endpoint not found - check URL format',
      };
    }

    return {
      url: testUrl,
      status: response.status,
      ok: false,
      message: `Unexpected status: ${response.status}`,
    };
  } catch (error) {
    return {
      url: n8nUrl,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to connect to n8n - network error',
    };
  }
}

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
  
  // AI check
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const aiProvider = process.env.AI_PROVIDER || 'gemini';
  checks.push({
    name: 'AI Service',
    status: (aiProvider === 'gemini' ? geminiKey : openaiKey) ? 'ok' : 'warning',
    message: `Provider: ${aiProvider}, Key: ${(aiProvider === 'gemini' ? geminiKey : openaiKey) ? 'configured' : 'missing'}`,
  });
  
  // n8n check with actual connection test
  const n8nResult = await testN8nConnection();
  checks.push({
    name: 'n8n Integration',
    status: n8nResult.ok ? 'ok' : 'error',
    message: n8nResult.message,
    details: {
      url: n8nResult.url,
      status: n8nResult.status,
      workflowCount: n8nResult.workflowCount,
    },
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
  // For development/debugging, allow access without super admin check
  // In production, uncomment the following:
  // const isSuperAdmin = await verifySuperAdmin();
  // if (!isSuperAdmin) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  // }
  
  // Check environment variables (existence only, never full values)
  const envStatus = ENV_VARS.map(env => ({
    key: env.key,
    category: env.category,
    description: env.description,
    exists: !!process.env[env.key],
    // Show partial value for non-secret vars
    preview: ['N8N_INSTANCE_URL', 'N8N_WEBHOOK_BASE_URL', 'AI_PROVIDER', 'NODE_ENV', 'VERCEL_ENV'].includes(env.key)
      ? process.env[env.key] || null
      : (process.env[env.key] ? `${process.env[env.key]?.substring(0, 10)}...` : null),
  }));
  
  // Run health checks including n8n smoke test
  const healthChecks = await runHealthChecks();
  
  // n8n specific instructions if not connected
  const n8nCheck = healthChecks.find(c => c.name === 'n8n Integration');
  const n8nInstructions = !n8nCheck?.status || n8nCheck.status !== 'ok' ? {
    title: '🔧 How to get the correct n8n URL and API Key',
    steps: [
      '1. Go to https://app.n8n.cloud and log in to your account',
      '2. Select your workspace (or create a new one)',
      '3. Look at the browser URL bar - copy the base URL:',
      '   Example: https://bassem-workspace.app.n8n.cloud',
      '   ❌ NOT: https://deepsolution.app.n8n.cloud/mcp-server/http',
      '4. In n8n, click the gear icon (⚙️) → Settings',
      '5. Go to "API" section',
      '6. Click "Create API Key" if you don\'t have one',
      '7. Copy the API Key (starts with "eyJ...")',
      '8. Set these environment variables in Vercel:',
      '   N8N_INSTANCE_URL = https://YOUR-WORKSPACE.app.n8n.cloud',
      '   N8N_API_KEY = your-api-key-here',
      '   N8N_WEBHOOK_BASE_URL = https://YOUR-WORKSPACE.app.n8n.cloud/webhook',
    ],
    currentValues: {
      N8N_INSTANCE_URL: process.env.N8N_INSTANCE_URL || 'NOT SET',
      N8N_API_KEY: process.env.N8N_API_KEY ? 'SET (hidden)' : 'NOT SET',
    },
  } : null;
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || 'local',
    summary: {
      database: healthChecks.find(c => c.name === 'Database')?.status === 'ok',
      auth: healthChecks.find(c => c.name === 'Auth Service')?.status === 'ok',
      ai: healthChecks.find(c => c.name === 'AI Service')?.status === 'ok',
      n8n: n8nCheck?.status === 'ok',
      basicAuth: healthChecks.find(c => c.name === 'Basic Auth')?.status === 'ok',
    },
    envStatus,
    healthChecks,
    n8nInstructions,
  });
}
