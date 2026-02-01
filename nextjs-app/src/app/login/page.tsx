'use client';

// Force dynamic rendering to prevent prerendering errors with useContext
export const dynamic = 'force-dynamic';

/**
 * Login Page
 * 
 * Authentication page with:
 * - Google OAuth via Supabase
 * - Full logo display
 * - Clean, professional design
 * - RTL support
 * - Comprehensive error handling
 * 
 * IMPORTANT: 
 * - No automatic redirects that could break OAuth flow
 * - redirectTo MUST NOT have trailing slash
 * - Works on both production and preview domains
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createBrowserClient } from '@supabase/ssr';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

/**
 * Get the correct site URL for OAuth redirects
 * Handles production, preview, and local environments
 */
function getSiteUrl(): string {
  // Check for explicit env variable first
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // In browser, use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Fallback to production URL
  return 'https://deepsolution.vercel.app';
}

// Create Supabase client for auth (with fallback for missing env)
// CRITICAL: Use createBrowserClient to ensure cookies are set for middleware
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey 
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;

// Error messages in Arabic
const ERROR_MESSAGES: Record<string, string> = {
  oauth_error: 'حدث خطأ أثناء المصادقة مع Google. يرجى المحاولة مرة أخرى.',
  no_code: 'لم يتم استلام رمز المصادقة. تأكد من إعدادات Supabase URL Configuration.',
  config_error: 'خطأ في إعدادات المصادقة. يرجى التواصل مع الدعم الفني.',
  exchange_error: 'فشل في تبادل رمز المصادقة. يرجى المحاولة مرة أخرى.',
  no_session: 'لم يتم إنشاء جلسة. يرجى المحاولة مرة أخرى.',
  auth_failed: 'فشل في تسجيل الدخول. يرجى المحاولة مرة أخرى.',
  unexpected_error: 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.',
  auth_callback_error: 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.',
  config: 'خطأ في إعدادات المصادقة. يرجى التواصل مع الدعم الفني.',
};

function LoginContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const authError = searchParams.get('error');
  const errorMessage = searchParams.get('message');

  // Only redirect if already authenticated - AFTER auth check is complete
  useEffect(() => {
    if (!authLoading) {
      setHasCheckedAuth(true);
      if (isAuthenticated) {
        router.push(redirectTo);
      }
    }
  }, [isAuthenticated, authLoading, router, redirectTo]);

  // Show auth error from callback
  useEffect(() => {
    if (authError) {
      const message = ERROR_MESSAGES[authError] || 
        (errorMessage ? decodeURIComponent(errorMessage) : 'حدث خطأ غير معروف.');
      setError(message);
    }
  }, [authError, errorMessage]);

  // Handle Google OAuth login - ONLY triggered by button click
  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError('نظام المصادقة غير مُعد. يرجى التواصل مع الدعم الفني.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const siteUrl = getSiteUrl();
      // Callback URL MUST match what's configured in Supabase Dashboard
      // MUST NOT have trailing slash
      const callbackUrl = `${siteUrl}/auth/callback`;
      
      console.log('[Login] ====== Starting Google OAuth ======');
      console.log('[Login] Site URL:', siteUrl);
      console.log('[Login] Callback URL:', callbackUrl);
      console.log('[Login] Supabase URL:', supabaseUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      console.log('[Login] OAuth response:', { url: data?.url ? 'received' : 'none', error: error?.message });

      if (error) {
        throw error;
      }
      
      // If we have a URL, the redirect should happen automatically
      // But just in case, we can manually redirect
      if (data?.url) {
        console.log('[Login] Redirecting to OAuth provider...');
        window.location.href = data.url;
      }
      
    } catch (err: unknown) {
      console.error('[Login] OAuth error:', err);
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الدخول.';
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
    router.replace('/login');
  };

  // Show loading while checking auth status
  if (authLoading || !hasCheckedAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">جاري التحويل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-white/10 flex items-center justify-center">
            <span className="text-5xl font-bold text-white">DS</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Deep Solution
          </h1>
          <p className="text-white/80 text-lg leading-relaxed">
            منصة متكاملة لإدارة التجارة الإلكترونية
            <br />
            من الطلب إلى التسليم
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-white">DS</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">Deep Solution</h1>
          </div>

          {/* Login Card */}
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                مرحباً بك
              </h2>
              <p className="text-muted-foreground">
                سجّل دخولك للوصول إلى لوحة التحكم
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    <button
                      onClick={clearError}
                      className="mt-2 text-xs text-red-600 dark:text-red-300 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      حاول مرة أخرى
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading || !supabase}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 py-3 px-4 rounded-xl text-base font-medium flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-gray-700 dark:text-gray-200">تسجيل الدخول بـ Google</span>
                </>
              )}
            </button>

            {!supabase && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-center text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ نظام المصادقة يحتاج إعداد متغيرات البيئة:
                </p>
                <ul className="mt-2 text-xs text-amber-600 dark:text-amber-500 list-disc list-inside">
                  <li>NEXT_PUBLIC_SUPABASE_URL</li>
                  <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                </ul>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground mt-6">
              بالمتابعة، أنت توافق على{' '}
              <Link href="/terms" className="text-primary hover:underline">شروط الاستخدام</Link>
              {' '}و{' '}
              <Link href="/privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-8">
            © {new Date().getFullYear()} Deep Solution. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
