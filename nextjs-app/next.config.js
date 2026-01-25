/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React Strict Mode
  reactStrictMode: true,
  
  // Proxy API requests to existing Express backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
  
  // SECURITY: Add security headers globally
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          // Prevent indexing (Alpha/Private deployment)
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          // Security headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  
  typescript: {
    ignoreBuildErrors: false,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Skip static generation of error pages to avoid Html import bug
  experimental: {
    // Use PPR for better error handling
    ppr: false,
  },
  
  // Output file tracing root to avoid lockfile warnings
  outputFileTracingRoot: __dirname,
  
  // Expose environment variables to the client
  env: {
    NEXT_PUBLIC_APP_ID: process.env.VITE_APP_ID,
    NEXT_PUBLIC_OAUTH_PORTAL_URL: process.env.VITE_OAUTH_PORTAL_URL,
    NEXT_PUBLIC_APP_TITLE: process.env.VITE_APP_TITLE,
    NEXT_PUBLIC_APP_LOGO: process.env.VITE_APP_LOGO,
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
};

module.exports = nextConfig;
