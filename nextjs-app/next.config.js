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
};

module.exports = nextConfig;
