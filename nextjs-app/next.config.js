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
  
  // Internationalization for RTL support
  i18n: {
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    localeDetection: false,
  },
};

module.exports = nextConfig;
