/**
 * Auth Provider Guard
 * Ensures the application only uses Supabase Auth
 * Any misconfiguration will be caught at runtime
 */

export type AuthProvider = 'supabase';

// Get the configured auth provider (only supabase is allowed)
export function getAuthProvider(): AuthProvider {
  const provider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'supabase';
  
  if (provider !== 'supabase') {
    console.error(`[AUTH GUARD] Invalid AUTH_PROVIDER: ${provider}. Only 'supabase' is allowed.`);
    return 'supabase'; // Force supabase
  }
  
  return 'supabase';
}

// Check if auth is properly configured
export function isAuthConfigured(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return Boolean(supabaseUrl && supabaseKey);
}

// Get the site URL for redirects
export function getSiteUrl(): string {
  // Production: use Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Explicit site URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Default to Vercel production domain
  return 'https://deepsolution.vercel.app';
}

// Validate auth configuration at startup
export function validateAuthConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check provider
  const provider = process.env.NEXT_PUBLIC_AUTH_PROVIDER;
  if (provider && provider !== 'supabase') {
    errors.push(`Invalid AUTH_PROVIDER: ${provider}. Only 'supabase' is allowed.`);
  }
  
  // Check Supabase config
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  // Check for forbidden Manus OAuth references
  const oauthPortal = process.env.NEXT_PUBLIC_OAUTH_PORTAL_URL || '';
  if (oauthPortal.includes('manus')) {
    errors.push('NEXT_PUBLIC_OAUTH_PORTAL_URL contains Manus reference - this is forbidden');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
