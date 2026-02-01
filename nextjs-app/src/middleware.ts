/**
 * Next.js Middleware - Legacy Users Hard Redirect v3
 * 
 * CRITICAL RULES:
 * 1. Middleware is the SOLE authority for user routing after login
 * 2. NO defaults, NO backfill - DB values only
 * 3. profiles.onboarding_completed != true → /onboarding (mandatory)
 * 4. tenant_setup.setup_completed != true → /setup (after onboarding)
 * 5. Dashboard access ONLY after both are completed
 * 6. Clear logging for every redirect decision
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
  '/auth',        // All auth routes including /auth/callback
  '/login',       // Login page
  '/privacy',     // Privacy policy
  '/terms',       // Terms of service
  '/api/health',  // Health check
  '/api/webhook', // Webhooks
  '/api/setup',   // Setup API routes
  '/api/onboarding', // Onboarding API routes
];

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

function addSecurityHeaders(response: NextResponse): NextResponse {
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
  onboarding_completed: boolean | null;
  setup_completed: boolean | null;
  redirect_target: string;
  reason: string;
}) {
  console.log('[MW-JOURNEY]', JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data
  }));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  
  // ============================================================
  // CRITICAL: PASSTHROUGH PATHS - NO MODIFICATIONS AT ALL
  // This includes /auth/callback, /login, etc.
  // ============================================================
  if (isPassthroughPath(pathname)) {
    console.log(`[MW] Passthrough: ${pathname}${search}`);
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
    return addSecurityHeaders(NextResponse.next());
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
  
  // Protected paths - require Supabase session
  if (isProtectedPath(pathname)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      logJourneyDecision({
        user_id: null,
        onboarding_completed: null,
        setup_completed: null,
        redirect_target: '/login',
        reason: 'Supabase not configured'
      });
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'config');
      return NextResponse.redirect(loginUrl);
    }
    
    let response = NextResponse.next({
      request: { headers: request.headers },
    });
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      logJourneyDecision({
        user_id: null,
        onboarding_completed: null,
        setup_completed: null,
        redirect_target: '/login',
        reason: 'No session'
      });
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    const userId = session.user.id;
    
    // ============================================================
    // STEP 1: CHECK ONBOARDING STATUS (MANDATORY - NO DEFAULTS)
    // If onboarding_completed is NOT explicitly true → /onboarding
    // ============================================================
    
    // Fetch profile - NO DEFAULTS, NO BACKFILL
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .single();
    
    // Determine onboarding status - STRICT CHECK
    // Only true if explicitly set to true in DB
    const onboardingCompleted = profile?.onboarding_completed === true;
    
    // If NOT on onboarding page and onboarding NOT completed → redirect to /onboarding
    if (pathname !== '/onboarding' && !pathname.startsWith('/onboarding/')) {
      if (!onboardingCompleted) {
        logJourneyDecision({
          user_id: userId,
          onboarding_completed: profile?.onboarding_completed ?? null,
          setup_completed: null,
          redirect_target: '/onboarding',
          reason: profileError 
            ? `Profile error: ${profileError.message}` 
            : profile 
              ? 'onboarding_completed is not true' 
              : 'No profile found'
        });
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    }
    
    // If ON onboarding page and onboarding IS completed → redirect to setup or dashboard
    if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
      if (onboardingCompleted) {
        // Check setup status to determine where to redirect
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
          
          const setupCompleted = setup?.setup_completed === true;
          
          if (setupCompleted) {
            logJourneyDecision({
              user_id: userId,
              onboarding_completed: true,
              setup_completed: true,
              redirect_target: '/dashboard',
              reason: 'Onboarding and Setup both completed, redirecting from /onboarding'
            });
            return NextResponse.redirect(new URL('/dashboard', request.url));
          } else {
            logJourneyDecision({
              user_id: userId,
              onboarding_completed: true,
              setup_completed: setup?.setup_completed ?? null,
              redirect_target: '/setup',
              reason: 'Onboarding completed, Setup not completed, redirecting from /onboarding'
            });
            return NextResponse.redirect(new URL('/setup', request.url));
          }
        }
        // No tenant yet - stay on onboarding to create one
      }
      // Not completed - allow access to onboarding
      return addSecurityHeaders(response);
    }
    
    // ============================================================
    // STEP 2: CHECK SETUP STATUS (ONLY IF ONBOARDING COMPLETED)
    // If setup_completed is NOT explicitly true → /setup
    // ============================================================
    
    // Skip setup check if on /setup page
    if (pathname === '/setup' || pathname.startsWith('/setup/')) {
      // If setup completed, redirect to dashboard
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
            onboarding_completed: true,
            setup_completed: true,
            redirect_target: '/dashboard',
            reason: 'Setup completed, redirecting from /setup'
          });
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }
      // Not completed - allow access to setup
      return addSecurityHeaders(response);
    }
    
    // For all other protected paths (dashboard, orders, etc.)
    // Check setup status
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();
    
    if (!tenantUser?.tenant_id) {
      // No tenant - redirect to onboarding to create one
      logJourneyDecision({
        user_id: userId,
        onboarding_completed: onboardingCompleted,
        setup_completed: null,
        redirect_target: '/onboarding',
        reason: tenantError 
          ? `Tenant error: ${tenantError.message}` 
          : 'No tenant found for user'
      });
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    
    const { data: setup, error: setupError } = await supabase
      .from('tenant_setup')
      .select('setup_completed')
      .eq('tenant_id', tenantUser.tenant_id)
      .single();
    
    // STRICT CHECK - Only true if explicitly set to true in DB
    const setupCompleted = setup?.setup_completed === true;
    
    if (!setupCompleted) {
      logJourneyDecision({
        user_id: userId,
        onboarding_completed: true,
        setup_completed: setup?.setup_completed ?? null,
        redirect_target: '/setup',
        reason: setupError 
          ? `Setup error: ${setupError.message}` 
          : setup 
            ? 'setup_completed is not true' 
            : 'No setup record found'
      });
      return NextResponse.redirect(new URL('/setup', request.url));
    }
    
    // ============================================================
    // STEP 3: ALL CHECKS PASSED - ALLOW ACCESS
    // ============================================================
    logJourneyDecision({
      user_id: userId,
      onboarding_completed: true,
      setup_completed: true,
      redirect_target: pathname,
      reason: 'All journey steps completed - access granted'
    });
    
    return addSecurityHeaders(response);
  }
  
  // Default: allow with security headers
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
