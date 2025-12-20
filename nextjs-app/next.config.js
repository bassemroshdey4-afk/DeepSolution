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
  
  // Note: i18n is not supported in App Router
  // RTL is handled via html lang="ar" dir="rtl" in layout.tsx
  
  // Disable static generation for error pages
  // This prevents the Html import error during build
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  
  // Skip static generation for pages router error pages
  // by using server-side rendering instead
  experimental: {
    // Use server-side rendering for error pages
  },
};

module.exports = nextConfig;
