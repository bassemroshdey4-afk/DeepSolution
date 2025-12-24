import { createBrowserClient } from '@supabase/ssr';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client for browser using SSR package
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Helper to get the site URL based on environment
export function getSiteUrl(): string {
  // Check for explicit site URL first
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Vercel deployment URL
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  
  // Browser environment
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Default to localhost for development
  return 'http://localhost:3000';
}

// Get the redirect URL for OAuth callbacks
export function getRedirectUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}
