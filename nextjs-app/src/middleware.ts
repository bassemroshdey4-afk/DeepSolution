/**
 * Next.js Middleware - Production Proof v6 (Kill Switch Edition)
 * 
 * PRODUCTION PROOFS:
 * 1. x-mw-hit: 1 header on ALL responses (including redirects)
 * 2. x-mw-version: v6-killswitch header for version tracking
 * 3. x-mw-timestamp: ISO timestamp for cache verification
 * 4. KILL_SWITCH: When true, logs only without redirecting
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
const MW_VERSION = 'v6-killswitch-2026-02-02';

// KILL SWITCH: When true, disable redirects and log only
const KILL_SWITCH = process.env.NEXT_PUBLIC_KILL_SWITCH === 'true';

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
  '/privacy',
  '/terms',
  '/api/health',
  '/api/webhook',
  '/api/setup',
  '/api/onboarding',
  '/api/probe',
];

// ALL paths that should get x-mw-hit header (including login)
const MW_HIT_PATHS = ['/dashboard', '/setup', '/onboarding', '/login'];

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

/**
 * Add MW headers to ANY response (including redirects)
 */
function addMwHeaders(response: NextResponse, pathname: string, originalPath?: string): NextResponse {
  // ALWAYS add these headers for production proof
  response.headers.set('x-mw-hit', '1');
  response.headers.set('x-mw-version', MW_VERSION);
  response.headers.set('x-mw-timestamp', new Date().toISOString());
  response.headers.set('x-mw-build-id', BUILD_ID);
  response.headers.set('x-mw-kill-switch', KILL_SWITCH ? 'active' : 'inactive');
  response.headers.set('x-mw-path', pathname);
  if (originalPath) {
    response.headers.set('x-mw-original-path', originalPath);
  }
  
  // Prevent caching
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
  
  return response;
}

/**
 * Create redirect response WITH MW headers
 */
function createRedirectWithHeaders(url: URL, originalPath: string): NextResponse {
  const response = NextResponse.redirect(url);
  return addMwHeaders(response, url.pathname, originalPath);
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
  kill_switch_active: boolean;
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
  
  console.log(`[MW-${requestId}] v=${MW_VERSION} build=${BUILD_ID} kill_switch=${KILL_SWITCH} path=${pathname}${search}`);
  
  // PASSTHROUGH PATHS - NO MODIFICATIONS (except /api/probe)
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
  
  // Public paths - add headers but no auth required
  const publicPaths = ['/', '/brand', '/api/auth', '/api/n8n', '/login'];
  const isPublic = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  
  if (isPublic) {
    const response = NextResponse.next();
    return addMwHeaders(response, pathname);
  }
  
  // Basic Auth for alpha testing (if enabled)
  if (ENABLE_BASIC_AUTH && BASIC_AUTH_PASS) {
    if (!validateBasicAuth(request)) {
      const response = new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="DeepSolution Alpha"',
        },
      });
      return addMwHeaders(response, pathname);
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
        kill_switch_active: KILL_SWITCH,
        source: 'DB_FETCH'
      });
      
      // KILL SWITCH: Log only, don't redirect
      if (KILL_SWITCH) {
        console.log(`[MW-${requestId}] KILL_SWITCH: Would redirect to /login but allowing through`);
        const response = NextResponse.next();
        response.headers.set('x-mw-would-redirect', '/login');
        return addMwHeaders(response, pathname);
      }
      
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'config');
      return createRedirectWithHeaders(loginUrl, pathname);
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
        kill_switch_active: KILL_SWITCH,
        source: 'DB_FETCH'
      });
      
      // KILL SWITCH: Log only, don't redirect
      if (KILL_SWITCH) {
        console.log(`[MW-${requestId}] KILL_SWITCH: Would redirect to /login but allowing through`);
        const response = NextResponse.next();
        response.headers.set('x-mw-would-redirect', '/login');
        return addMwHeaders(response, pathname);
      }
      
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return createRedirectWithHeaders(loginUrl, pathname);
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
            : `onboarding_completed=${profile?.onboarding_completed} (not true)`,
          kill_switch_active: KILL_SWITCH,
          source: 'DB_FETCH'
        });
        
        // KILL SWITCH: Log only, don't redirect
        if (KILL_SWITCH) {
          console.log(`[MW-${requestId}] KILL_SWITCH: Would redirect to /onboarding but allowing through`);
          const response = NextResponse.next();
          response.headers.set('x-mw-would-redirect', '/onboarding');
          response.headers.set('x-mw-db-onboarding', String(profile?.onboarding_completed ?? 'null'));
          return addMwHeaders(response, pathname);
        }
        
        const onboardingUrl = new URL('/onboarding', request.url);
        return createRedirectWithHeaders(onboardingUrl, pathname);
      }
    }
    
    // STEP 2: FETCH SETUP STATUS FROM DB (only if onboarding is complete)
    if (dbOnboardingCompleted && pathname !== '/setup' && !pathname.startsWith('/setup/') && pathname !== '/onboarding') {
      // Get tenant_id from profile
      const { data: profileWithTenant } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', userId)
        .single();
      
      if (profileWithTenant?.default_tenant_id) {
        const { data: tenantSetup, error: setupError } = await supabase
          .from('tenant_setup')
          .select('setup_completed, current_step')
          .eq('tenant_id', profileWithTenant.default_tenant_id)
          .single();
        
        console.log(`[MW-${requestId}] DB Setup:`, JSON.stringify({
          setup_completed: tenantSetup?.setup_completed,
          error: setupError?.message
        }));
        
        // STRICT CHECK: setup_completed must be EXACTLY true in DB
        const dbSetupCompleted = tenantSetup?.setup_completed === true;
        
        if (!dbSetupCompleted) {
          logJourneyDecision({
            user_id: userId,
            db_onboarding_completed: true,
            db_setup_completed: tenantSetup?.setup_completed ?? null,
            redirect_target: '/setup',
            reason: setupError 
              ? `Setup error: ${setupError.message}` 
              : `setup_completed=${tenantSetup?.setup_completed} (not true)`,
            kill_switch_active: KILL_SWITCH,
            source: 'DB_FETCH'
          });
          
          // KILL SWITCH: Log only, don't redirect
          if (KILL_SWITCH) {
            console.log(`[MW-${requestId}] KILL_SWITCH: Would redirect to /setup but allowing through`);
            const response = NextResponse.next();
            response.headers.set('x-mw-would-redirect', '/setup');
            response.headers.set('x-mw-db-setup', String(tenantSetup?.setup_completed ?? 'null'));
            return addMwHeaders(response, pathname);
          }
          
          const setupUrl = new URL('/setup', request.url);
          return createRedirectWithHeaders(setupUrl, pathname);
        }
      } else {
        // No tenant - redirect to setup
        logJourneyDecision({
          user_id: userId,
          db_onboarding_completed: true,
          db_setup_completed: null,
          redirect_target: '/setup',
          reason: 'No tenant_id found',
          kill_switch_active: KILL_SWITCH,
          source: 'DB_FETCH'
        });
        
        // KILL SWITCH: Log only, don't redirect
        if (KILL_SWITCH) {
          console.log(`[MW-${requestId}] KILL_SWITCH: Would redirect to /setup (no tenant) but allowing through`);
          const response = NextResponse.next();
          response.headers.set('x-mw-would-redirect', '/setup');
          response.headers.set('x-mw-reason', 'no-tenant');
          return addMwHeaders(response, pathname);
        }
        
        const setupUrl = new URL('/setup', request.url);
        return createRedirectWithHeaders(setupUrl, pathname);
      }
    }
    
    // All checks passed - allow access
    console.log(`[MW-${requestId}] Access granted to ${pathname}`);
    const response = NextResponse.next();
    return addMwHeaders(response, pathname);
  }
  
  // Default: allow with headers
  const response = NextResponse.next();
  return addMwHeaders(response, pathname);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
