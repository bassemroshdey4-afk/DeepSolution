'use client';

/**
 * OAuth Callback Page (Client Component)
 * 
 * CRITICAL: This handles BOTH OAuth flows:
 * 1. PKCE Code Flow: ?code=xxx (query string)
 * 2. Implicit Flow: #access_token=xxx (hash fragment)
 * 
 * The hash fragment (#) is NOT sent to the server, so we MUST use
 * a client component to read it from window.location.hash
 */

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Get Supabase config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client (only if config exists)
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Get site URL for redirects
function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://deepsolution.vercel.app';
}

// Parse hash fragment into object
function parseHashFragment(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!hash || hash.length <= 1) return params;
  
  const hashContent = hash.startsWith('#') ? hash.substring(1) : hash;
  const pairs = hashContent.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  
  return params;
}

type CallbackStatus = 
  | 'loading'
  | 'processing_code'
  | 'processing_hash'
  | 'success'
  | 'error'
  | 'debug';

interface DebugInfo {
  pathname: string;
  hasCode: boolean;
  hasHash: boolean;
  hashKeys: string[];
  queryKeys: string[];
  supabaseConfigured: boolean;
  errorMessage?: string;
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    async function handleCallback() {
      // Get code from query string (PKCE flow)
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      
      // Get hash from window (Implicit flow)
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const hashParams = parseHashFragment(hash);
      
      // Debug info
      const debug: DebugInfo = {
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        hasCode: !!code,
        hasHash: hash.length > 1,
        hashKeys: Object.keys(hashParams),
        queryKeys: Array.from(searchParams.keys()),
        supabaseConfigured: !!supabase,
      };

      console.log('='.repeat(60));
      console.log('[CALLBACK PAGE] OAuth Callback Hit!');
      console.log('[CALLBACK PAGE] Code:', code ? `YES (${code.substring(0, 10)}...)` : 'NO');
      console.log('[CALLBACK PAGE] Hash:', hash ? `YES (${hash.substring(0, 30)}...)` : 'NO');
      console.log('[CALLBACK PAGE] Hash keys:', debug.hashKeys.join(', ') || 'none');
      console.log('[CALLBACK PAGE] Query keys:', debug.queryKeys.join(', ') || 'none');
      console.log('[CALLBACK PAGE] Supabase configured:', debug.supabaseConfigured);
      console.log('='.repeat(60));

      // Handle OAuth error from provider
      if (error) {
        console.error('[CALLBACK PAGE] OAuth error:', error, errorDescription);
        router.replace(`/login?error=oauth_error&message=${encodeURIComponent(errorDescription || error)}`);
        return;
      }

      // Check Supabase config
      if (!supabase) {
        debug.errorMessage = 'Supabase not configured';
        setDebugInfo(debug);
        setStatus('debug');
        setErrorMessage('نظام المصادقة غير مُعد. تأكد من إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY');
        return;
      }

      // ============================================================
      // FLOW 1: PKCE Code Flow (code in query string)
      // ============================================================
      if (code) {
        console.log('[CALLBACK PAGE] Processing PKCE Code Flow...');
        setStatus('processing_code');
        
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('[CALLBACK PAGE] Code exchange failed:', exchangeError.message);
            router.replace(`/login?error=exchange_error&message=${encodeURIComponent(exchangeError.message)}`);
            return;
          }

          if (data.session && data.user) {
            console.log('[CALLBACK PAGE] ✅ PKCE Success! User:', data.user.email);
            setStatus('success');
            // Small delay to ensure cookies are set
            setTimeout(() => {
              router.replace('/dashboard');
            }, 100);
            return;
          }

          router.replace('/login?error=no_session');
          return;
        } catch (err) {
          console.error('[CALLBACK PAGE] Code exchange error:', err);
          router.replace(`/login?error=unexpected&message=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`);
          return;
        }
      }

      // ============================================================
      // FLOW 2: Implicit Flow (tokens in hash fragment)
      // ============================================================
      if (hashParams.access_token) {
        console.log('[CALLBACK PAGE] Processing Implicit Hash Flow...');
        setStatus('processing_hash');
        
        const accessToken = hashParams.access_token;
        const refreshToken = hashParams.refresh_token;
        
        if (!refreshToken) {
          console.warn('[CALLBACK PAGE] No refresh_token in hash, session may be short-lived');
        }

        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('[CALLBACK PAGE] setSession failed:', sessionError.message);
            router.replace(`/login?error=auth_failed&message=${encodeURIComponent(sessionError.message)}`);
            return;
          }

          if (data.session && data.user) {
            console.log('[CALLBACK PAGE] ✅ Implicit Flow Success! User:', data.user.email);
            setStatus('success');
            // Clear hash and redirect
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', window.location.pathname);
            }
            setTimeout(() => {
              router.replace('/dashboard');
            }, 100);
            return;
          }

          router.replace('/login?error=no_session');
          return;
        } catch (err) {
          console.error('[CALLBACK PAGE] setSession error:', err);
          router.replace(`/login?error=unexpected&message=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`);
          return;
        }
      }

      // ============================================================
      // NO CODE AND NO HASH - Show Debug Info
      // ============================================================
      console.error('[CALLBACK PAGE] No code and no access_token!');
      console.error('[CALLBACK PAGE] This means Supabase did not send any auth data');
      debug.errorMessage = 'No authentication data received';
      setDebugInfo(debug);
      setStatus('debug');
      setErrorMessage('لم يتم استلام بيانات المصادقة. راجع إعدادات Supabase URL Configuration.');
    }

    handleCallback();
  }, [searchParams, router]);

  // Loading state
  if (status === 'loading' || status === 'processing_code' || status === 'processing_hash') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground font-medium">
            {status === 'processing_code' && 'جاري معالجة رمز المصادقة...'}
            {status === 'processing_hash' && 'جاري إنشاء الجلسة...'}
            {status === 'loading' && 'جاري التحقق...'}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-foreground font-medium">تم تسجيل الدخول بنجاح!</p>
          <p className="text-muted-foreground text-sm mt-1">جاري التحويل إلى لوحة التحكم...</p>
        </div>
      </div>
    );
  }

  // Debug/Error state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-card border border-border rounded-xl p-6 shadow-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground">مشكلة في تسجيل الدخول</h2>
          <p className="text-muted-foreground mt-2">{errorMessage}</p>
        </div>

        {debugInfo && (
          <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono mb-6">
            <h3 className="font-bold text-foreground mb-2">معلومات التشخيص:</h3>
            <div className="space-y-1 text-muted-foreground">
              <p>• Pathname: {debugInfo.pathname}</p>
              <p>• Code in URL: {debugInfo.hasCode ? '✅ نعم' : '❌ لا'}</p>
              <p>• Hash in URL: {debugInfo.hasHash ? '✅ نعم' : '❌ لا'}</p>
              <p>• Hash keys: {debugInfo.hashKeys.length > 0 ? debugInfo.hashKeys.join(', ') : 'لا يوجد'}</p>
              <p>• Query keys: {debugInfo.queryKeys.length > 0 ? debugInfo.queryKeys.join(', ') : 'لا يوجد'}</p>
              <p>• Supabase: {debugInfo.supabaseConfigured ? '✅ مُعد' : '❌ غير مُعد'}</p>
            </div>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">الحل المقترح:</h3>
          <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>افتح Supabase Dashboard → Authentication → URL Configuration</li>
            <li>تأكد أن Site URL = https://deepsolution.vercel.app</li>
            <li>أضف /auth/callback إلى Redirect URLs</li>
            <li>في Vercel، تأكد من وجود NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>اعمل Redeploy وجرب مرة أخرى</li>
          </ol>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = '/login'}
            className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            العودة لتسجيل الدخول
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-muted text-foreground py-2 px-4 rounded-lg font-medium hover:bg-muted/80 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    </div>
  );
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
