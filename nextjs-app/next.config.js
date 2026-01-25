/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React Strict Mode
  reactStrictMode: true,
  
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
  // NOTE: No Manus OAuth references - only Supabase Auth
  env: {
    NEXT_PUBLIC_APP_TITLE: process.env.VITE_APP_TITLE || 'DeepSolution',
    NEXT_PUBLIC_APP_LOGO: process.env.VITE_APP_LOGO,
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_AUTH_PROVIDER: 'supabase', // HARD-CODED: Only Supabase Auth allowed
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://deepsolution.vercel.app',
  },
};

module.exports = nextConfig;
