/**
 * Next.js Middleware
 * Private Alpha Deployment: Basic Auth + noindex headers
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Basic Auth credentials from environment
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || '';

// Enable/disable basic auth (for development)
const ENABLE_BASIC_AUTH = process.env.ENABLE_BASIC_AUTH === 'true';

// Paths that don't require auth
const PUBLIC_PATHS = [
  '/api/health',
  '/api/webhook',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/brand',
];

/**
 * Check if path is public (no auth required)
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path));
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
  
  // CSP for additional security
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
  );
  
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip auth for public paths
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }
  
  // Basic Auth check (if enabled)
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
  
  // Continue with security headers
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
