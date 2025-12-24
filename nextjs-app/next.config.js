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
  
  // Environment variables mapping
  env: {
    // Supabase (use existing env vars if available)
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    // Site URL for OAuth redirects
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    NEXT_PUBLIC_VERCEL_URL: process.env.VERCEL_URL,
    // App branding
    NEXT_PUBLIC_APP_TITLE: process.env.VITE_APP_TITLE || 'DeepSolution',
    NEXT_PUBLIC_APP_LOGO: process.env.VITE_APP_LOGO,
  },
};

module.exports = nextConfig;
