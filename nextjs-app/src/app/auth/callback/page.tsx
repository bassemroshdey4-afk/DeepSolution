'use client';

/**
 * OAuth Callback Page - Client Component (Bulletproof)
 * 
 * This page handles BOTH OAuth flows:
 * 1. PKCE Code Flow: ?code=xxx → exchangeCodeForSession
 * 2. Implicit Hash Flow: #access_token=xxx → setSession
 * 
 * Why Client Component?
 * - The hash (#) is NOT sent to the server
 * - We need window.location.hash to read implicit flow tokens
 * - We can still handle ?code= via searchParams
 * 
 * Flow:
 * - If URL has ?code= → exchange for session
 * - If URL has #access_token= → set session directly
 * - If neither → show debug info
 */

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Site URL for redirects
function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://deepsolution.vercel.app';
}

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

interface DebugInfo {
  pathname: string;
  hasCode: boolean;
  hasHash: boolean;
  hashKeys: string[];
  queryKeys: string[];
  error?: string;
  suggestion?: string;
  fullUrl?: string;
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'processing' | 'success' | 'error' | 'debug'>('loading');
  const [message, setMessage] = useState('جاري معالجة تسجيل الدخول...');
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  // Error message helper
  const getErrorMessage = useCallback((error: string, errorMsg: string | null): string => {
    const messages: Record<string, string> = {
      no_code: 'لم يتم استلام رمز المصادقة من Supabase.',
      auth_failed: 'فشل في تبادل رمز المصادقة.',
      oauth_error: 'حدث خطأ من مزود المصادقة (Google).',
      config_error: 'خطأ في إعدادات Supabase.',
      exchange_failed: 'فشل في تبادل الكود للجلسة.',
      session_failed: 'فشل في إنشاء الجلسة.',
    };
    
    if (errorMsg) {
      return `${messages[error] || error}: ${decodeURIComponent(errorMsg)}`;
    }
    return messages[error] || `خطأ: ${error}`;
  }, []);

  // Suggestion helper
  const getSuggestion = useCallback((queryKeys: string[], hashKeys: string[]): string => {
    if (queryKeys.length === 0 && hashKeys.length === 0) {
      return 'لم يتم استلام أي بيانات مصادقة. تأكد من إعدادات Supabase: Site URL = https://deepsolution.vercel.app و Redirect URLs تشمل /auth/callback';
    }
    if (hashKeys.includes('error')) {
      return 'حدث خطأ من مزود المصادقة. تحقق من إعدادات Google OAuth في Supabase.';
    }
    if (hashKeys.includes('access_token')) {
      return 'تم استلام توكن لكن فشلت معالجته. تحقق من Supabase client configuration.';
    }
    if (queryKeys.includes('error')) {
      return 'حدث خطأ أثناء المصادقة. تحقق من الرسالة أعلاه.';
    }
    return 'تحقق من إعدادات Supabase URL Configuration في لوحة تحكم Supabase.';
  }, []);

  useEffect(() => {
    const handleCallback = async () => {
      // Check if we're in browser
      if (typeof window === 'undefined') return;

      const fullUrl = window.location.href;
      const hash = window.location.hash;
      const pathname = window.location.pathname;
      const siteUrl = getSiteUrl();
      
      console.log('[Callback] ====== OAuth Callback ======');
      console.log('[Callback] Full URL:', fullUrl);
      console.log('[Callback] Hash present:', hash ? 'YES' : 'NO');
      console.log('[Callback] Pathname:', pathname);
      console.log('[Callback] Site URL:', siteUrl);

      // Get query params
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorMessage = searchParams.get('message') || searchParams.get('error_description');

      console.log('[Callback] Code present:', !!code);
      console.log('[Callback] Error:', error || 'none');

      // Handle error from query params
      if (error) {
        console.error('[Callback] Error in query:', error, errorMessage);
        setStatus('error');
        setMessage(getErrorMessage(error, errorMessage));
        return;
      }

      // Create Supabase client
      const supabase = createSupabaseClient();
      if (!supabase) {
        console.error('[Callback] Supabase client not configured');
        setStatus('error');
        setMessage('خطأ في إعدادات المصادقة. متغيرات البيئة غير موجودة.');
        return;
      }

      // ========== FLOW 1: PKCE Code Flow ==========
      if (code) {
        console.log('[Callback] Processing PKCE Code Flow...');
        setStatus('processing');
        setMessage('جاري تبادل رمز المصادقة...');

        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('[Callback] Exchange error:', exchangeError);
            setStatus('error');
            setMessage(getErrorMessage('exchange_failed', exchangeError.message));
            return;
          }

          if (data.session && data.user) {
            console.log('[Callback] ✅ Session created via PKCE!');
            console.log('[Callback] User:', data.user.email);
            setStatus('success');
            setMessage('تم تسجيل الدخول بنجاح! جاري التحويل...');
            
            // Redirect to dashboard
            setTimeout(() => {
              router.push('/dashboard');
            }, 500);
            return;
          } else {
            console.error('[Callback] No session in response');
            setStatus('error');
            setMessage(getErrorMessage('session_failed', 'لم يتم إنشاء جلسة'));
            return;
          }
        } catch (err) {
          console.error('[Callback] PKCE error:', err);
          setStatus('error');
          setMessage(getErrorMessage('exchange_failed', err instanceof Error ? err.message : 'Unknown error'));
          return;
        }
      }

      // ========== FLOW 2: Implicit Hash Flow ==========
      if (hash && hash.length > 1) {
        console.log('[Callback] Processing Implicit Hash Flow...');
        setStatus('processing');
        setMessage('جاري معالجة التوكن...');

        try {
          // Parse hash params
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const errorInHash = hashParams.get('error');
          const errorDescInHash = hashParams.get('error_description');

          console.log('[Callback] Hash params:', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            error: errorInHash,
          });

          // Check for error in hash
          if (errorInHash) {
            console.error('[Callback] Error in hash:', errorInHash);
            setStatus('error');
            setMessage(errorDescInHash || errorInHash || 'حدث خطأ في المصادقة');
            return;
          }

          // If we have access token, set the session
          if (accessToken) {
            console.log('[Callback] Setting session from hash tokens...');
            
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              console.error('[Callback] Session error:', sessionError);
              setStatus('error');
              setMessage(getErrorMessage('session_failed', sessionError.message));
              return;
            }

            if (data.session) {
              console.log('[Callback] ✅ Session created from hash!');
              console.log('[Callback] User:', data.session.user.email);
              setStatus('success');
              setMessage('تم تسجيل الدخول بنجاح! جاري التحويل...');
              
              // Clear the hash from URL for security
              window.history.replaceState(null, '', pathname);
              
              // Redirect to dashboard
              setTimeout(() => {
                router.push('/dashboard');
              }, 500);
              return;
            }
          }
        } catch (err) {
          console.error('[Callback] Hash processing error:', err);
          setStatus('error');
          setMessage('حدث خطأ أثناء معالجة التوكن');
          return;
        }
      }

      // ========== NO CODE, NO HASH - Show Debug ==========
      console.log('[Callback] No code or valid hash found - showing debug');
      
      const queryKeys = Array.from(searchParams.keys());
      const hashKeys = hash ? Array.from(new URLSearchParams(hash.substring(1)).keys()) : [];
      
      setDebugInfo({
        pathname,
        hasCode: false,
        hasHash: hash.length > 1,
        hashKeys,
        queryKeys,
        suggestion: getSuggestion(queryKeys, hashKeys),
        fullUrl: fullUrl.replace(/access_token=[^&]+/, 'access_token=***').replace(/refresh_token=[^&]+/, 'refresh_token=***'),
      });
      setStatus('debug');
    };

    // Small delay to ensure window is ready
    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
  }, [searchParams, router, getErrorMessage, getSuggestion]);

  // Loading/Processing state
  if (status === 'loading' || status === 'processing' || status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground font-medium">{message}</p>
          {status === 'success' && (
            <p className="text-muted-foreground text-sm mt-2">جاري التحويل للوحة التحكم...</p>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">فشل تسجيل الدخول</h1>
          <p className="text-muted-foreground mb-6 text-sm">{message}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            العودة لصفحة تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  // Debug state
  if (status === 'debug' && debugInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">معلومات التشخيص</h1>
            <p className="text-muted-foreground text-sm">لم يتم استلام بيانات المصادقة المتوقعة</p>
          </div>

          <div className="space-y-3 text-sm" dir="ltr">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-mono text-muted-foreground text-xs">
                <span className="text-foreground font-semibold">Pathname:</span> {debugInfo.pathname}
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-mono text-muted-foreground text-xs">
                <span className="text-foreground font-semibold">Query Keys:</span>{' '}
                {debugInfo.queryKeys.length > 0 ? debugInfo.queryKeys.join(', ') : '(none)'}
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-mono text-muted-foreground text-xs">
                <span className="text-foreground font-semibold">Has Hash:</span>{' '}
                {debugInfo.hasHash ? 'Yes' : 'No'}
              </p>
              {debugInfo.hashKeys.length > 0 && (
                <p className="font-mono text-muted-foreground text-xs mt-1">
                  <span className="text-foreground font-semibold">Hash Keys:</span>{' '}
                  {debugInfo.hashKeys.join(', ')}
                </p>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-mono text-muted-foreground text-xs break-all">
                <span className="text-foreground font-semibold">URL:</span>{' '}
                {debugInfo.fullUrl}
              </p>
            </div>
          </div>

          {debugInfo.suggestion && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg" dir="rtl">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>اقتراح:</strong> {debugInfo.suggestion}
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              العودة لصفحة تسجيل الدخول
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-muted text-foreground py-3 px-4 rounded-xl font-medium hover:bg-muted/80 transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
