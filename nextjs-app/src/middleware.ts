/**
 * Next.js Middleware - Production Proof v5
 * 
 * PRODUCTION PROOFS:
 * 1. x-mw-hit: 1 header on /dashboard|/setup|/onboarding
 * 2. x-mw-version: v5-prod header for version tracking
 * 3. x-mw-timestamp: ISO timestamp for cache verification
 * 
 * CRITICAL RULES:
 * 1. Middleware is the SOLE authority for user routing after login
 * 2. NO defaults, NO backfill - DB values only
 * 3. NO cache - fresh DB fetch every request
 * 4. NO session.user_metadata - DB is source of truth
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Build ID for production verification
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev-local';
const MW_VERSION = 'v5-prod-2026-02-02';

// Basic Auth credentials from environment
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || '';
const ENABLE_BASIC_AUTH = process.env.ENABLE_BASIC_AUTH === 'true';

// Protected paths that require Supabase session
const PROTECTED_PATHS = [
  '/dashboard',
  '/onboarding',
  '/setup',
  '/orders',
  '/products',
  '/inventory',
  '/shipping',
  '/finance',
  '/profit',
  '/campaigns',
  '/ai-pipeline',
  '/content-writer',
  '/integrations',
  '/wallet',
  '/settings',
  '/admin',
  '/purchasing',
  '/landing-pages',
  '/audit-log',
  '/payment-settings',
];

// Paths that should NEVER be touched by middleware
const PASSTHROUGH_PATHS = [
  '/auth',
  '/login',
  '/privacy',
  '/terms',
  '/api/health',
  '/api/webhook',
  '/api/setup',
  '/api/onboarding',
  '/api/probe',
];

// Paths that get x-mw-hit header for production proof
const MW_HIT_PATHS = ['/dashboard', '/setup', '/onboarding'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
}

function isPassthroughPath(pathname: string): boolean {
  return PASSTHROUGH_PATHS.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
}

function shouldAddMwHitHeader(pathname: string): boolean {
  return MW_HIT_PATHS.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
}

function validateBasicAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  
  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [user, pass] = credentials.split(':');
    return user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS;
  } catch {
    return false;
  }
}

function addSecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  // PRODUCTION PROOF: Add x-mw-hit header for specific paths
  if (shouldAddMwHitHeader(pathname)) {
    response.headers.set('x-mw-hit', '1');
    response.headers.set('x-mw-version', MW_VERSION);
    response.headers.set('x-mw-timestamp', new Date().toISOString());
    response.headers.set('x-mw-build-id', BUILD_ID);
  }
  
  // Prevent caching of protected pages
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  
  // Security headers
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://www.googleapis.com; frame-src https://accounts.google.com;"
  );
  return response;
}

/**
 * Log user journey decision with all relevant data
 */
function logJourneyDecision(data: {
  user_id: string | null;
  db_onboarding_completed: boolean | null;
  db_setup_completed: boolean | null;
  redirect_target: string;
  reason: string;
  source: 'DB_FETCH';
}) {
  console.log('[MW-JOURNEY-DB]', JSON.stringify({
    timestamp: new Date().toISOString(),
    mw_version: MW_VERSION,
    build_id: BUILD_ID,
    ...data
  }));
}

/**
 * Extract user ID from Supabase auth cookie
 */
function extractUserIdFromCookie(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();
  
  for (const cookie of cookies) {
    if (cookie.name.includes('-auth-token')) {
      try {
        const decoded = JSON.parse(cookie.value);
        if (decoded?.user?.id) {
          return decoded.user.id;
        }
        if (typeof decoded === 'string') {
          const innerDecoded = JSON.parse(decoded);
          if (innerDecoded?.user?.id) {
            return innerDecoded.user.id;
          }
        }
      } catch {
        try {
          const parts = cookie.value.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload?.sub) {
              return payload.sub;
            }
          }
        } catch {
          continue;
        }
      }
    }
  }
  
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[MW-${requestId}] v=${MW_VERSION} build=${BUILD_ID} path=${pathname}${search}`);
  
  // PASSTHROUGH PATHS - NO MODIFICATIONS
  if (isPassthroughPath(pathname)) {
    console.log(`[MW-${requestId}] Passthrough: ${pathname}`);
    return NextResponse.next();
  }
  
  // Skip static files
  if (pathname.startsWith('/_next/') || 
      pathname === '/favicon.ico' || 
      pathname === '/robots.txt' ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.ico')) {
    return NextResponse.next();
  }
  
  // Public paths - no auth required
  const publicPaths = ['/', '/brand', '/api/auth', '/api/n8n'];
  const isPublic = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  
  if (isPublic) {
    return addSecurityHeaders(NextResponse.next(), pathname);
  }
  
  // Basic Auth for alpha testing (if enabled)
  if (ENABLE_BASIC_AUTH && BASIC_AUTH_PASS) {
    if (!validateBasicAuth(request)) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="DeepSolution Alpha"',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }
  }
  
  // Protected paths - require authentication and journey completion
  if (isProtectedPath(pathname)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log(`[MW-${requestId}] ERROR: Supabase not configured`);
      logJourneyDecision({
        user_id: null,
        db_onboarding_completed: null,
        db_setup_completed: null,
        redirect_target: '/login',
        reason: 'Supabase not configured',
        source: 'DB_FETCH'
      });
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'config');
      return NextResponse.redirect(loginUrl);
    }
    
    // Extract user ID from cookie
    const userId = extractUserIdFromCookie(request);
    
    if (!userId) {
      console.log(`[MW-${requestId}] No user ID in cookie - redirecting to login`);
      logJourneyDecision({
        user_id: null,
        db_onboarding_completed: null,
        db_setup_completed: null,
        redirect_target: '/login',
        reason: 'No user ID in cookie',
        source: 'DB_FETCH'
      });
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    console.log(`[MW-${requestId}] User: ${userId}`);
    
    // CREATE FRESH SUPABASE CLIENT WITH SERVICE KEY
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        }
      }
    });
    
    // STEP 1: FETCH ONBOARDING STATUS FROM DB
    console.log(`[MW-${requestId}] Fetching profile from DB...`);
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_step')
      .eq('id', userId)
      .single();
    
    console.log(`[MW-${requestId}] DB Profile:`, JSON.stringify({
      onboarding_completed: profile?.onboarding_completed,
      error: profileError?.message
    }));
    
    // STRICT CHECK: onboarding_completed must be EXACTLY true in DB
    const dbOnboardingCompleted = profile?.onboarding_completed === true;
    
    // If NOT on onboarding page and onboarding NOT completed → redirect to /onboarding
    if (pathname !== '/onboarding' && !pathname.startsWith('/onboarding/')) {
      if (!dbOnboardingCompleted) {
        logJourneyDecision({
          user_id: userId,
          db_onboarding_completed: profile?.onboarding_completed ?? null,
          db_setup_completed: null,
          redirect_target: '/onboarding',
          reason: profileError 
            ? `Profile error: ${profileError.message}` 
            : profile 
              ? `DB onboarding_completed = ${profile.onboarding_completed} (not true)` 
              : 'No profile found in DB',
          source: 'DB_FETCH'
        });
        console.log(`[MW-${requestId}] REDIRECT to /onboarding`);
        const redirectResponse = NextResponse.redirect(new URL('/onboarding', request.url));
        redirectResponse.headers.set('x-mw-hit', '1');
        redirectResponse.headers.set('x-mw-version', MW_VERSION);
        redirectResponse.headers.set('x-mw-redirect-reason', 'onboarding-not-completed');
        return redirectResponse;
      }
    }
    
    // If ON onboarding page and onboarding IS completed → redirect to setup or dashboard
    if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
      if (dbOnboardingCompleted) {
        const { data: tenantUser } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', userId)
          .single();
        
        if (tenantUser?.tenant_id) {
          const { data: setup } = await supabase
            .from('tenant_setup')
            .select('setup_completed')
            .eq('tenant_id', tenantUser.tenant_id)
            .single();
          
          const dbSetupCompleted = setup?.setup_completed === true;
          
          if (dbSetupCompleted) {
            logJourneyDecision({
              user_id: userId,
              db_onboarding_completed: true,
              db_setup_completed: true,
              redirect_target: '/dashboard',
              reason: 'Both completed, redirecting from /onboarding',
              source: 'DB_FETCH'
            });
            console.log(`[MW-${requestId}] REDIRECT to /dashboard from /onboarding`);
            return NextResponse.redirect(new URL('/dashboard', request.url));
          } else {
            logJourneyDecision({
              user_id: userId,
              db_onboarding_completed: true,
              db_setup_completed: setup?.setup_completed ?? null,
              redirect_target: '/setup',
              reason: 'Onboarding done, setup not done',
              source: 'DB_FETCH'
            });
            console.log(`[MW-${requestId}] REDIRECT to /setup from /onboarding`);
            return NextResponse.redirect(new URL('/setup', request.url));
          }
        }
      }
      const response = NextResponse.next();
      return addSecurityHeaders(response, pathname);
    }
    
    // STEP 2: FETCH SETUP STATUS FROM DB
    if (pathname === '/setup' || pathname.startsWith('/setup/')) {
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', userId)
        .single();
      
      if (tenantUser?.tenant_id) {
        const { data: setup } = await supabase
          .from('tenant_setup')
          .select('setup_completed')
          .eq('tenant_id', tenantUser.tenant_id)
          .single();
        
        if (setup?.setup_completed === true) {
          logJourneyDecision({
            user_id: userId,
            db_onboarding_completed: true,
            db_setup_completed: true,
            redirect_target: '/dashboard',
            reason: 'Setup completed, redirecting from /setup',
            source: 'DB_FETCH'
          });
          console.log(`[MW-${requestId}] REDIRECT to /dashboard from /setup`);
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }
      const response = NextResponse.next();
      return addSecurityHeaders(response, pathname);
    }
    
    // For all other protected paths (dashboard, orders, etc.)
    console.log(`[MW-${requestId}] Checking setup for: ${pathname}`);
    
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();
    
    console.log(`[MW-${requestId}] DB Tenant:`, JSON.stringify({
      tenant_id: tenantUser?.tenant_id,
      error: tenantError?.message
    }));
    
    if (!tenantUser?.tenant_id) {
      logJourneyDecision({
        user_id: userId,
        db_onboarding_completed: dbOnboardingCompleted,
        db_setup_completed: null,
        redirect_target: '/onboarding',
        reason: tenantError 
          ? `Tenant error: ${tenantError.message}` 
          : 'No tenant found in DB',
        source: 'DB_FETCH'
      });
      console.log(`[MW-${requestId}] REDIRECT to /onboarding - no tenant`);
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    
    const { data: setup, error: setupError } = await supabase
      .from('tenant_setup')
      .select('setup_completed')
      .eq('tenant_id', tenantUser.tenant_id)
      .single();
    
    console.log(`[MW-${requestId}] DB Setup:`, JSON.stringify({
      setup_completed: setup?.setup_completed,
      error: setupError?.message
    }));
    
    const dbSetupCompleted = setup?.setup_completed === true;
    
    if (!dbSetupCompleted) {
      logJourneyDecision({
        user_id: userId,
        db_onboarding_completed: true,
        db_setup_completed: setup?.setup_completed ?? null,
        redirect_target: '/setup',
        reason: setupError 
          ? `Setup error: ${setupError.message}` 
          : setup 
            ? `DB setup_completed = ${setup.setup_completed} (not true)` 
            : 'No setup record in DB',
        source: 'DB_FETCH'
      });
      console.log(`[MW-${requestId}] REDIRECT to /setup`);
      const redirectResponse = NextResponse.redirect(new URL('/setup', request.url));
      redirectResponse.headers.set('x-mw-hit', '1');
      redirectResponse.headers.set('x-mw-version', MW_VERSION);
      redirectResponse.headers.set('x-mw-redirect-reason', 'setup-not-completed');
      return redirectResponse;
    }
    
    // ALL CHECKS PASSED - ALLOW ACCESS
    logJourneyDecision({
      user_id: userId,
      db_onboarding_completed: true,
      db_setup_completed: true,
      redirect_target: pathname,
      reason: 'All journey steps completed in DB - access granted',
      source: 'DB_FETCH'
    });
    console.log(`[MW-${requestId}] ACCESS GRANTED to ${pathname}`);
    
    const response = NextResponse.next();
    return addSecurityHeaders(response, pathname);
  }
  
  // Default: allow with security headers
  return addSecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/setup/:path*',
    '/onboarding/:path*',
    '/orders/:path*',
    '/products/:path*',
    '/inventory/:path*',
    '/shipping/:path*',
    '/finance/:path*',
    '/profit/:path*',
    '/campaigns/:path*',
    '/ai-pipeline/:path*',
    '/content-writer/:path*',
    '/integrations/:path*',
    '/wallet/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/purchasing/:path*',
    '/landing-pages/:path*',
    '/audit-log/:path*',
    '/payment-settings/:path*',
    '/auth/:path*',
    '/login',
    '/brand/:path*',
    '/api/:path*',
    '/',
  ],
};
