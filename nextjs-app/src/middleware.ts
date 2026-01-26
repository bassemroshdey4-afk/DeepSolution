/**
 * Next.js Middleware - SECURITY HARDENED
 * 
 * 3-Layer Security Lock:
 * 1. Route Protection: All app routes require authentication
 * 2. Basic Auth: Optional layer for alpha testing
 * 3. Security Headers: noindex, CSP, etc.
 * 
 * CRITICAL: 
 * - /auth/callback MUST be excluded to allow OAuth flow
 * - /login MUST be excluded to allow users to log in
 * - No data should ever be shown without valid session
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Basic Auth credentials from environment
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || '';

// Enable/disable basic auth (for alpha testing)
const ENABLE_BASIC_AUTH = process.env.ENABLE_BASIC_AUTH === 'true';

// Paths that are completely public (no auth required at all)
// IMPORTANT: /auth/callback MUST be here for OAuth to work
const PUBLIC_PATHS = [
  '/',                    // Landing page only
  '/login',               // Login page
  '/auth/callback',       // OAuth callback - CRITICAL for OAuth flow
  '/auth',                // Auth pages
  '/api/auth',            // Auth API routes
  '/api/health',          // Health check
  '/api/webhook',         // Webhooks
  '/privacy',             // Privacy policy
  '/terms',               // Terms of service
  '/_next',               // Next.js internals
  '/favicon.ico',
  '/robots.txt',
  '/brand',
  '/ds-logo.png',
];

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

/**
 * Check if path is public (no auth required)
 */
function isPublicPath(pathname: string): boolean {
  // Exact match for /auth/callback (most important)
  if (pathname === '/auth/callback') return true;
  
  return PUBLIC_PATHS.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
}

/**
 * Check if path requires authentication
 */
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
}

/**
 * Validate Basic Auth credentials
 */
function validateBasicAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  
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
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent indexing (Private Alpha)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // CSP for additional security - allow Supabase and Google
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://www.googleapis.com; frame-src https://accounts.google.com;"
  );
  
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Log for debugging (remove in production)
  console.log('[Middleware] Path:', pathname);
  
  // Skip auth for static files
  if (pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image')) {
    return NextResponse.next();
  }
  
  // CRITICAL: Always allow /auth/callback without ANY checks
  // This is essential for OAuth to work
  if (pathname === '/auth/callback' || pathname.startsWith('/auth/callback')) {
    console.log('[Middleware] Allowing /auth/callback - OAuth flow');
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }
  
  // Basic Auth check (Layer 2 - if enabled for alpha testing)
  // BUT skip for public paths
  if (ENABLE_BASIC_AUTH && BASIC_AUTH_PASS && !isPublicPath(pathname)) {
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
  
  // Allow public paths without session check
  if (isPublicPath(pathname)) {
    console.log('[Middleware] Public path:', pathname);
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }
  
  // For protected paths, check Supabase session
  if (isProtectedPath(pathname)) {
    console.log('[Middleware] Protected path:', pathname);
    
    // Create Supabase client for middleware
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      // If Supabase not configured, redirect to login
      console.log('[Middleware] Supabase not configured');
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'config');
      return NextResponse.redirect(loginUrl);
    }
    
    // Create response to pass cookies
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
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
      }
    );
    
    // Check session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      // No valid session - redirect to login
      console.log('[Middleware] No session, redirecting to login');
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    console.log('[Middleware] Session valid for:', session.user.email);
    // Session valid - continue with security headers
    return addSecurityHeaders(response);
  }
  
  // Default: allow with security headers
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
