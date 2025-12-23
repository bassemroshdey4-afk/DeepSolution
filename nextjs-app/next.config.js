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
  
  // Expose VITE_ environment variables to the client
  env: {
    NEXT_PUBLIC_APP_ID: process.env.VITE_APP_ID,
    NEXT_PUBLIC_OAUTH_PORTAL_URL: process.env.VITE_OAUTH_PORTAL_URL,
    NEXT_PUBLIC_APP_TITLE: process.env.VITE_APP_TITLE,
    NEXT_PUBLIC_APP_LOGO: process.env.VITE_APP_LOGO,
  },
};

module.exports = nextConfig;
