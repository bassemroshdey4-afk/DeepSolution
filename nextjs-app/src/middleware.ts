/**
 * Next.js Middleware - OAuth Root Fix
 * 
 * CRITICAL FIX: /auth/callback MUST pass through with ALL query params intact
 * The issue was that middleware was stripping query params or redirecting
 * 
 * DEBUG MODE: Logging enabled to trace OAuth flow
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

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => 
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

export async function middleware(request: NextRequest) {
  const { pathname, search, href } = request.nextUrl;
  
  // ============================================================
  // DEBUG LOGGING - Remove after OAuth is fixed
  // ============================================================
  console.log('='.repeat(60));
  console.log('[MW] MIDDLEWARE HIT');
  console.log('[MW] pathname:', pathname);
  console.log('[MW] search:', search || '(empty)');
  console.log('[MW] full href:', href);
  console.log('='.repeat(60));
  
  // ============================================================
  // CRITICAL: /auth/callback - IMMEDIATE PASSTHROUGH
  // NO redirects, NO rewrites, NO modifications
  // Just pass the request through AS-IS with all query params
  // ============================================================
  if (pathname === '/auth/callback' || pathname.startsWith('/auth/callback')) {
    console.log('[MW] >>> AUTH CALLBACK DETECTED <<<');
    console.log('[MW] Query params:', search);
    console.log('[MW] Has code:', search.includes('code='));
    console.log('[MW] Passing through WITHOUT any modification...');
    
    // IMPORTANT: Use NextResponse.next() without any modifications
    // This preserves all query parameters
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
  const publicPaths = ['/', '/login', '/privacy', '/terms', '/brand', '/api/health', '/api/webhook', '/api/auth'];
  const isPublic = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  
  if (isPublic) {
    console.log('[MW] Public path:', pathname);
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
    console.log('[MW] Protected path:', pathname);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('[MW] Supabase not configured, redirecting to login');
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
      console.log('[MW] No session, redirecting to login');
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    console.log('[MW] Session valid for:', session.user.email);
    return addSecurityHeaders(response);
  }
  
  // Default: allow with security headers
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files
     * IMPORTANT: This matcher determines what requests hit the middleware
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
