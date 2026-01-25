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
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Get the site URL for redirects
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://deepsolution.vercel.app';

  // Check for OAuth errors from provider
  if (error) {
    console.error('[Auth Callback] OAuth error:', error, errorDescription);
    const errorMessage = encodeURIComponent(errorDescription || error);
    return NextResponse.redirect(`${siteUrl}/login?error=oauth_error&message=${errorMessage}`);
  }

  // No code means something went wrong
  if (!code) {
    console.error('[Auth Callback] No code provided');
    return NextResponse.redirect(`${siteUrl}/login?error=no_code`);
  }

  // Check Supabase config
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Auth Callback] Missing Supabase config');
    return NextResponse.redirect(`${siteUrl}/login?error=config_error`);
  }

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (e) {
            // Cookie errors in Server Components are expected
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (e) {
            // Cookie errors in Server Components are expected
          }
        },
      },
    });

    // Exchange the code for a session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[Auth Callback] Exchange error:', exchangeError.message);
      return NextResponse.redirect(`${siteUrl}/login?error=exchange_error&message=${encodeURIComponent(exchangeError.message)}`);
    }

    if (!data.session || !data.user) {
      console.error('[Auth Callback] No session returned');
      return NextResponse.redirect(`${siteUrl}/login?error=no_session`);
    }

    const user = data.user;
    console.log('[Auth Callback] Success! User:', user.email);

    // Check if user has a profile with a default tenant
    let redirectTo = '/dashboard';
    
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, default_tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        // Profile doesn't exist yet - trigger should create it
        // But we still need to redirect to onboarding
        console.log('[Auth Callback] Profile error (may not exist yet):', profileError.message);
        redirectTo = '/onboarding';
      } else if (!profile || !profile.default_tenant_id) {
        // Profile exists but no tenant assigned
        console.log('[Auth Callback] No tenant assigned, redirecting to onboarding');
        redirectTo = '/onboarding';
      } else {
        // User has a tenant, go to dashboard
        console.log('[Auth Callback] User has tenant:', profile.default_tenant_id);
        redirectTo = '/dashboard';
      }
    } catch (profileCheckError) {
      // If profiles table doesn't exist yet, redirect to onboarding
      console.log('[Auth Callback] Profile check failed, redirecting to onboarding');
      redirectTo = '/onboarding';
    }

    // Redirect to the determined destination
    return NextResponse.redirect(`${siteUrl}${redirectTo}`);

  } catch (err) {
    console.error('[Auth Callback] Unexpected error:', err);
    return NextResponse.redirect(`${siteUrl}/login?error=unexpected_error`);
  }
}
