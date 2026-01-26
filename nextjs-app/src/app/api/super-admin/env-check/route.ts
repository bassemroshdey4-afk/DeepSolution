/**
 * Environment Check API
 * 
 * Returns status of environment variables
 * Does NOT expose actual values for security
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Required environment variables
const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

// Optional but recommended
const OPTIONAL_VARS = [
  'NEXT_PUBLIC_SITE_URL',
  'N8N_INSTANCE_URL',
  'N8N_API_KEY',
  'OPENAI_API_KEY',
  'BASIC_AUTH_USER',
  'BASIC_AUTH_PASS',
  'ENABLE_BASIC_AUTH',
];

// Alternative names (fallbacks)
const FALLBACKS: Record<string, string[]> = {
  'NEXT_PUBLIC_SUPABASE_URL': ['SUPABASE_URL'],
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': ['SUPABASE_ANON_KEY'],
  'SUPABASE_SERVICE_ROLE_KEY': ['SUPABASE_SERVICE_KEY'],
};

function isVarConfigured(key: string): boolean {
  if (process.env[key]) return true;
  
  // Check fallbacks
  const fallbacks = FALLBACKS[key];
  if (fallbacks) {
    return fallbacks.some(fb => !!process.env[fb]);
  }
  
  return false;
}

function getVarValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  
  const fallbacks = FALLBACKS[key];
  if (fallbacks) {
    for (const fb of fallbacks) {
      if (process.env[fb]) return process.env[fb];
    }
  }
  
  return undefined;
}

async function testDatabaseConnection(): Promise<boolean> {
  try {
    const url = getVarValue('NEXT_PUBLIC_SUPABASE_URL');
    const key = getVarValue('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getVarValue('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!url || !key) return false;
    
    const supabase = createClient(url, key);
    const { error } = await supabase.from('tenants').select('id').limit(1);
    
    // Even if table doesn't exist, connection worked
    return !error || error.code === 'PGRST116';
  } catch {
    return false;
  }
}

export async function GET() {
  // Check required variables
  const missing: string[] = [];
  const present: string[] = [];
  
  for (const key of REQUIRED_VARS) {
    if (isVarConfigured(key)) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }
  
  // Check optional variables
  for (const key of OPTIONAL_VARS) {
    if (isVarConfigured(key)) {
      present.push(key);
    }
  }
  
  // Test connections
  const dbConnected = await testDatabaseConnection();
  const authConfigured = isVarConfigured('NEXT_PUBLIC_SUPABASE_URL') && 
                         isVarConfigured('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  return NextResponse.json({
    configured: missing.length === 0,
    missing,
    present,
    dbConnected,
    authConfigured,
    timestamp: new Date().toISOString(),
  });
}
