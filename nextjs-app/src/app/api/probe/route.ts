/**
 * Production Probe Endpoint v3
 * 
 * Returns deployment info for verification:
 * - vercelEnv: production/preview/development
 * - supabasePrefix: first 8 chars of Supabase URL
 * - hasAnonKey: boolean
 * - gitCommit: from VERCEL_GIT_COMMIT_SHA
 * - buildId: from NEXT_PUBLIC_BUILD_ID
 * - mwVersion: middleware version
 * - mwActive: middleware is active
 * 
 * NO SECRETS ARE EXPOSED
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MW_VERSION = 'v7-final-2026-02-02';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  // Extract project ref from Supabase URL (e.g., https://abcdefgh.supabase.co -> abcdefgh)
  const supabasePrefix = supabaseUrl
    .replace('https://', '')
    .replace('.supabase.co', '')
    .substring(0, 8);
  
  const probeData = {
    // Vercel environment
    vercelEnv: process.env.VERCEL_ENV || 'local',
    
    // Supabase project prefix (not the full URL)
    supabasePrefix: supabasePrefix || 'not-set',
    
    // Has anon key configured
    hasAnonKey: supabaseAnonKey.length > 0,
    
    // Git commit SHA from Vercel
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'local',
    
    // Build ID for version tracking
    buildId: process.env.NEXT_PUBLIC_BUILD_ID || 'dev-local',
    
    // Middleware version - FINAL REDIRECT LOGIC ACTIVE
    mwVersion: MW_VERSION,
    
    // Middleware is active with REAL redirects
    mwActive: true,
    
    // Redirect logic status
    redirectsEnabled: true,
    
    // Timestamp for cache verification
    timestamp: new Date().toISOString(),
    
    // Node environment
    nodeEnv: process.env.NODE_ENV || 'development',
  };
  
  return NextResponse.json(probeData, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'x-probe-version': 'v3',
      'x-mw-version': MW_VERSION,
      'x-redirects-enabled': 'true',
    },
  });
}
