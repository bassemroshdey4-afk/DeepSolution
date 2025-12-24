import { createBrowserClient } from '@supabase/ssr';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client for browser using SSR package
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Production URL - always use this for OAuth to avoid PKCE issues
const PRODUCTION_URL = 'https://deepsolution.vercel.app';

// Helper to get the site URL based on environment
export function getSiteUrl(): string {
  // Always use production URL for OAuth callbacks to avoid PKCE cookie issues
  // PKCE stores code_verifier in cookies, and different domains = different cookies
  return PRODUCTION_URL;
}

// Get the redirect URL for OAuth callbacks
export function getRedirectUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}
