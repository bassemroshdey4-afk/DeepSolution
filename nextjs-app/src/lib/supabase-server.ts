/**
 * Supabase Server Client
 * 
 * IMPORTANT: This file uses @supabase/ssr for server-side auth
 * 
 * Required ENV variables:
 * - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)
 * - SUPABASE_SERVICE_ROLE_KEY (for admin operations)
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Get Supabase URL with fallback
function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    console.error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
    throw new Error('supabaseUrl is required. Add NEXT_PUBLIC_SUPABASE_URL to Vercel Environment Variables.');
  }
  return url;
}

// Get Supabase Anon Key with fallback
function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    console.error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
    throw new Error('supabaseKey is required. Add NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel Environment Variables.');
  }
  return key;
}

// Get Supabase Service Role Key
function getSupabaseServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!key) {
    console.error('[Supabase] Missing SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('supabaseServiceKey is required. Add SUPABASE_SERVICE_ROLE_KEY to Vercel Environment Variables.');
  }
  return key;
}

/**
 * Create Supabase client for server components
 * Uses cookies for session management
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Handle cookie errors in Server Components
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Handle cookie errors in Server Components
        }
      },
    },
  });
}

/**
 * Create Supabase Admin client for server-side operations
 * Uses service role key - NEVER expose to client
 */
export function createSupabaseAdminClient() {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServiceKey();

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return {
    configured: missing.length === 0,
    missing,
  };
}
