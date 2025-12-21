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
  
  // Disable automatic static optimization for error pages
  // This prevents the Html import error during build
  experimental: {
    // Disable pages router fallback
    disableOptimizedLoading: true,
  },
};

module.exports = nextConfig;
