// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'DeepSolution - منصة إدارة التجارة الإلكترونية',
  description: 'منظومة SaaS عالمية لإدارة وتشغيل التجارة الإلكترونية',
  icons: {
    icon: '/ds-logo.png',
    shortcut: '/ds-logo.png',
    apple: '/ds-logo.png',
  },
  // Private Alpha: Prevent indexing
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
  // Prevent Open Graph sharing
  openGraph: undefined,
  twitter: undefined,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Private Alpha: Additional noindex meta tags */}
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="googlebot" content="noindex, nofollow" />
      </head>
      <body className="font-sans antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
