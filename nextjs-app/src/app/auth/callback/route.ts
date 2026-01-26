/**
 * OAuth Callback Route Handler
 * 
 * CRITICAL: This handles the PKCE Code Flow
 * Supabase sends ?code=xxx which we exchange for a session
 * 
 * DEBUG: Extensive logging to trace the OAuth flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Get Supabase URL with fallback
function getSupabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null;
}

// Get Supabase Anon Key with fallback
function getSupabaseAnonKey(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || null;
}

// Get Site URL with fallback
function getSiteUrl(): string {
  // Check for explicit env variable first
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  
  // Check Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback to production URL
  return 'https://deepsolution.vercel.app';
}

export async function GET(request: NextRequest) {
  // Get the full URL and all params
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Site URL for redirects
  const siteUrl = getSiteUrl();

  // ============================================================
  // DEBUG LOGGING
  // ============================================================
  console.log('='.repeat(60));
  console.log('[CALLBACK ROUTE] OAuth Callback Hit!');
  console.log('[CALLBACK ROUTE] Full URL:', requestUrl.toString());
  console.log('[CALLBACK ROUTE] pathname:', requestUrl.pathname);
  console.log('[CALLBACK ROUTE] search:', requestUrl.search || '(empty)');
  console.log('[CALLBACK ROUTE] code:', code ? `YES (${code.substring(0, 10)}...)` : 'NO');
  console.log('[CALLBACK ROUTE] error:', error || 'none');
  console.log('[CALLBACK ROUTE] Site URL:', siteUrl);
  console.log('='.repeat(60));

  // Handle OAuth errors from provider
  if (error) {
    console.error('[CALLBACK ROUTE] OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${siteUrl}/login?error=oauth_error&message=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // If no code, show detailed debug info
  if (!code) {
    console.error('[CALLBACK ROUTE] NO CODE RECEIVED!');
    console.error('[CALLBACK ROUTE] This means Supabase did not send the code');
    console.error('[CALLBACK ROUTE] Check Supabase URL Configuration:');
    console.error('[CALLBACK ROUTE] - Site URL should be:', siteUrl);
    console.error('[CALLBACK ROUTE] - Redirect URL should include:', `${siteUrl}/auth/callback`);
    
    // Check if this might be an implicit flow (hash-based)
    // Note: Hash is not available server-side, so we redirect to a client page
    console.error('[CALLBACK ROUTE] Possible causes:');
    console.error('[CALLBACK ROUTE] 1. Supabase URL Configuration is wrong');
    console.error('[CALLBACK ROUTE] 2. Supabase is using Implicit flow (hash) instead of PKCE');
    console.error('[CALLBACK ROUTE] 3. Middleware is stripping query params');
    
    return NextResponse.redirect(
      `${siteUrl}/login?error=no_code&debug=no_code_in_callback`
    );
  }

  // Validate Supabase config
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl) {
    console.error('[CALLBACK ROUTE] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL!');
    return NextResponse.redirect(`${siteUrl}/login?error=config_error&missing=supabase_url`);
  }

  if (!supabaseAnonKey) {
    console.error('[CALLBACK ROUTE] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY!');
    return NextResponse.redirect(`${siteUrl}/login?error=config_error&missing=supabase_key`);
  }

  try {
    console.log('[CALLBACK ROUTE] Creating Supabase client...');
    console.log('[CALLBACK ROUTE] Supabase URL:', supabaseUrl.substring(0, 30) + '...');
    
    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Expected in some contexts
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Expected in some contexts
          }
        },
      },
    });

    console.log('[CALLBACK ROUTE] Exchanging code for session...');
    
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[CALLBACK ROUTE] Exchange FAILED:', exchangeError.message);
      console.error('[CALLBACK ROUTE] Error code:', exchangeError.status);
      return NextResponse.redirect(
        `${siteUrl}/login?error=auth_failed&message=${encodeURIComponent(exchangeError.message)}`
      );
    }

    if (!data.session || !data.user) {
      console.error('[CALLBACK ROUTE] No session in response!');
      return NextResponse.redirect(`${siteUrl}/login?error=no_session`);
    }

    console.log('[CALLBACK ROUTE] ✅ SUCCESS!');
    console.log('[CALLBACK ROUTE] User ID:', data.user.id);
    console.log('[CALLBACK ROUTE] User Email:', data.user.email);
    console.log('[CALLBACK ROUTE] Session expires:', data.session.expires_at);
    console.log('[CALLBACK ROUTE] Redirecting to /dashboard...');

    // Redirect to dashboard
    return NextResponse.redirect(`${siteUrl}/dashboard`);

  } catch (err) {
    console.error('[CALLBACK ROUTE] Unexpected error:', err);
    return NextResponse.redirect(
      `${siteUrl}/login?error=unexpected&message=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`
    );
  }
}
