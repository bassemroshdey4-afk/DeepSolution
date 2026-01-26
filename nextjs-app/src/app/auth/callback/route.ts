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

export async function GET(request: NextRequest) {
  // Get the full URL and all params
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Site URL for redirects
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://deepsolution.vercel.app').replace(/\/$/, '');

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

  // If no code, redirect to login with debug info
  if (!code) {
    console.error('[CALLBACK ROUTE] NO CODE RECEIVED!');
    console.error('[CALLBACK ROUTE] This means Supabase did not send the code');
    console.error('[CALLBACK ROUTE] Check Supabase URL Configuration:');
    console.error('[CALLBACK ROUTE] - Site URL should be:', siteUrl);
    console.error('[CALLBACK ROUTE] - Redirect URL should include:', `${siteUrl}/auth/callback`);
    
    return NextResponse.redirect(
      `${siteUrl}/login?error=no_code&debug=route_handler_no_code`
    );
  }

  // Validate Supabase config
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[CALLBACK ROUTE] Missing Supabase environment variables!');
    return NextResponse.redirect(`${siteUrl}/login?error=config_error`);
  }

  try {
    console.log('[CALLBACK ROUTE] Creating Supabase client...');
    
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
