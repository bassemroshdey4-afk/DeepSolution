/**
 * Supabase OAuth Callback Handler
 * 
 * This route handles the OAuth callback from Supabase after Google login.
 * It exchanges the authorization code for a session and determines redirect:
 * - New users (no tenant) → /onboarding
 * - Existing users (has tenant) → /dashboard
 * 
 * Flow:
 * 1. User clicks "Login with Google" on /login
 * 2. Supabase redirects to Google OAuth
 * 3. Google redirects back to Supabase
 * 4. Supabase redirects to this callback with ?code=...
 * 5. We exchange the code for a session
 * 6. Check if user has a tenant
 * 7. Redirect to /onboarding or /dashboard
 * 
 * Error Handling:
 * - /login?error=no_code - No authorization code received
 * - /login?error=auth_failed - Session exchange failed
 * - /login?error=oauth_error - OAuth provider returned an error
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Get the site URL for redirects - MUST be the Vercel domain
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://deepsolution.vercel.app';

  console.log('[Auth Callback] Request received');
  console.log('[Auth Callback] URL:', requestUrl.toString());
  console.log('[Auth Callback] Code present:', !!code);
  console.log('[Auth Callback] Error:', error);

  // Handle OAuth errors from provider (Google/Supabase)
  if (error) {
    console.error('[Auth Callback] OAuth error from provider:', error, errorDescription);
    const errorMessage = encodeURIComponent(errorDescription || error);
    return NextResponse.redirect(`${siteUrl}/login?error=oauth_error&message=${errorMessage}`);
  }

  // CRITICAL: No code means the OAuth flow was interrupted
  if (!code) {
    console.error('[Auth Callback] No authorization code in URL');
    console.error('[Auth Callback] Full URL:', requestUrl.toString());
    console.error('[Auth Callback] Search params:', requestUrl.searchParams.toString());
    return NextResponse.redirect(`${siteUrl}/login?error=no_code`);
  }

  // Validate Supabase configuration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Auth Callback] Missing Supabase environment variables');
    console.error('[Auth Callback] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.error('[Auth Callback] NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'SET' : 'MISSING');
    return NextResponse.redirect(`${siteUrl}/login?error=config_error`);
  }

  try {
    // Get cookies for session management
    const cookieStore = await cookies();

    // Create Supabase server client with proper cookie handling
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          console.log(`[Auth Callback] Cookie GET: ${name} = ${cookie?.value ? 'EXISTS' : 'MISSING'}`);
          return cookie?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            console.log(`[Auth Callback] Cookie SET: ${name}`);
            cookieStore.set({ name, value, ...options });
          } catch (e) {
            // Cookie errors in Server Components are expected during streaming
            console.log(`[Auth Callback] Cookie SET error (expected): ${name}`);
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            console.log(`[Auth Callback] Cookie REMOVE: ${name}`);
            cookieStore.set({ name, value: '', ...options });
          } catch (e) {
            // Cookie errors in Server Components are expected
            console.log(`[Auth Callback] Cookie REMOVE error (expected): ${name}`);
          }
        },
      },
    });

    console.log('[Auth Callback] Exchanging code for session...');
    
    // Exchange the authorization code for a session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[Auth Callback] Exchange failed:', exchangeError.message);
      console.error('[Auth Callback] Exchange error details:', JSON.stringify(exchangeError));
      return NextResponse.redirect(
        `${siteUrl}/login?error=auth_failed&message=${encodeURIComponent(exchangeError.message)}`
      );
    }

    if (!data.session || !data.user) {
      console.error('[Auth Callback] No session or user in response');
      console.error('[Auth Callback] Data received:', JSON.stringify(data));
      return NextResponse.redirect(`${siteUrl}/login?error=auth_failed&message=no_session_created`);
    }

    const user = data.user;
    console.log('[Auth Callback] ✅ Session created successfully!');
    console.log('[Auth Callback] User ID:', user.id);
    console.log('[Auth Callback] User Email:', user.email);

    // Determine redirect destination based on user profile
    let redirectTo = '/dashboard';
    
    try {
      // Check if user has a profile with a default tenant
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, default_tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        // Profile doesn't exist yet - new user needs onboarding
        console.log('[Auth Callback] Profile not found (new user):', profileError.message);
        redirectTo = '/onboarding';
      } else if (!profile || !profile.default_tenant_id) {
        // Profile exists but no tenant assigned
        console.log('[Auth Callback] No tenant assigned, needs onboarding');
        redirectTo = '/onboarding';
      } else {
        // User has a tenant, go to dashboard
        console.log('[Auth Callback] User has tenant:', profile.default_tenant_id);
        redirectTo = '/dashboard';
      }
    } catch (profileCheckError) {
      // If profiles table doesn't exist yet, redirect to onboarding
      console.log('[Auth Callback] Profile check exception, defaulting to onboarding');
      redirectTo = '/onboarding';
    }

    console.log('[Auth Callback] Redirecting to:', redirectTo);
    
    // Create response with redirect
    const response = NextResponse.redirect(`${siteUrl}${redirectTo}`);
    
    return response;

  } catch (err) {
    console.error('[Auth Callback] Unexpected error:', err);
    console.error('[Auth Callback] Error stack:', err instanceof Error ? err.stack : 'No stack');
    return NextResponse.redirect(`${siteUrl}/login?error=auth_failed&message=unexpected_error`);
  }
}
