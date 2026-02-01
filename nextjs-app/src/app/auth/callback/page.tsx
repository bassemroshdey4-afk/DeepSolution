'use client';

/**
 * OAuth Callback Page (Client Component)
 * 
 * ROOT FIX: Uses createBrowserClient from @supabase/ssr
 * This ensures cookies are written correctly for middleware to read
 * 
 * The key difference:
 * - createClient() → stores session in localStorage only
 * - createBrowserClient() → stores session in BOTH localStorage AND cookies
 */

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// Get Supabase config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// CRITICAL: Use createBrowserClient (not createClient) to ensure cookies are set
// This is required for middleware to read the session
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
  | 'checking_session'
  | 'processing_code'
  | 'processing_hash'
  | 'success'
  | 'error'
  | 'debug';

interface DebugInfo {
  fullUrl: string;
  pathname: string;
  search: string;
  hash: string;
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

  const handleCallback = useCallback(async () => {
    // ============================================================
    // STEP 1: Collect all URL information
    // ============================================================
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    // Get hash from window (Implicit flow)
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const hashParams = parseHashFragment(hash);
    
    // Build debug info
    const debug: DebugInfo = {
      fullUrl: typeof window !== 'undefined' ? window.location.href : '',
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      search: typeof window !== 'undefined' ? window.location.search : '',
      hash: hash,
      hasCode: !!code,
      hasHash: hash.length > 1,
      hashKeys: Object.keys(hashParams),
      queryKeys: Array.from(searchParams.keys()),
      supabaseConfigured: !!supabase,
    };

    // ============================================================
    // STEP 2: Log everything for debugging
    // ============================================================
    console.log('='.repeat(70));
    console.log('[CALLBACK] ========== OAuth Callback Hit ==========');
    console.log('[CALLBACK] Using createBrowserClient (cookies enabled)');
    console.log('[CALLBACK] Full URL:', debug.fullUrl);
    console.log('[CALLBACK] Code:', code ? `YES (${code.substring(0, 20)}...)` : 'NO');
    console.log('[CALLBACK] Hash:', hash ? `YES (length: ${hash.length})` : 'NO');
    console.log('[CALLBACK] Hash keys:', debug.hashKeys.join(', ') || 'none');
    console.log('='.repeat(70));

    // ============================================================
    // STEP 3: Handle OAuth error from provider
    // ============================================================
    if (error) {
      console.error('[CALLBACK] OAuth error from provider:', error, errorDescription);
      router.replace(`/login?error=oauth_error&message=${encodeURIComponent(errorDescription || error)}`);
      return;
    }

    // ============================================================
    // STEP 4: Check Supabase config
    // ============================================================
    if (!supabase) {
      console.error('[CALLBACK] Supabase not configured!');
      debug.errorMessage = 'Supabase not configured';
      setDebugInfo(debug);
      setStatus('debug');
      setErrorMessage('نظام المصادقة غير مُعد.');
      return;
    }

    // ============================================================
    // FLOW 0: Check if detectSessionInUrl already worked
    // ============================================================
    console.log('[CALLBACK] Checking if session already exists...');
    setStatus('checking_session');
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        console.log('[CALLBACK] ✅ Session already exists! User:', sessionData.session.user.email);
        console.log('[CALLBACK] Cookies should be set by createBrowserClient');
        setStatus('success');
        // Use window.location for hard redirect to ensure cookies are sent
        window.location.href = '/dashboard';
        return;
      }
    } catch (err) {
      console.log('[CALLBACK] No existing session, continuing...');
    }

    // ============================================================
    // FLOW 1: PKCE Code Flow (code in query string)
    // ============================================================
    if (code) {
      console.log('[CALLBACK] Processing PKCE Code Flow...');
      setStatus('processing_code');
      
      try {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('[CALLBACK] Code exchange failed:', exchangeError.message);
          router.replace(`/login?error=exchange_error&message=${encodeURIComponent(exchangeError.message)}`);
          return;
        }

        if (data.session && data.user) {
          console.log('[CALLBACK] ✅ PKCE Success! User:', data.user.email);
          console.log('[CALLBACK] Session stored in cookies by createBrowserClient');
          setStatus('success');
          // Use window.location for hard redirect to ensure cookies are sent
          window.location.href = '/dashboard';
          return;
        }

        console.error('[CALLBACK] No session after code exchange');
        router.replace('/login?error=no_session');
        return;
      } catch (err) {
        console.error('[CALLBACK] Code exchange error:', err);
        router.replace(`/login?error=unexpected&message=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`);
        return;
      }
    }

    // ============================================================
    // FLOW 2: Implicit Flow (tokens in hash fragment)
    // ============================================================
    if (hashParams.access_token) {
      console.log('[CALLBACK] Processing Implicit Hash Flow...');
      setStatus('processing_hash');
      
      const accessToken = hashParams.access_token;
      const refreshToken = hashParams.refresh_token;

      try {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          console.error('[CALLBACK] setSession failed:', sessionError.message);
          router.replace(`/login?error=auth_failed&message=${encodeURIComponent(sessionError.message)}`);
          return;
        }

        if (data.session && data.user) {
          console.log('[CALLBACK] ✅ Implicit Flow Success! User:', data.user.email);
          setStatus('success');
          // Clear hash and redirect
          window.location.href = '/dashboard';
          return;
        }

        console.error('[CALLBACK] No session after setSession');
        router.replace('/login?error=no_session');
        return;
      } catch (err) {
        console.error('[CALLBACK] setSession error:', err);
        router.replace(`/login?error=unexpected&message=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`);
        return;
      }
    }

    // ============================================================
    // NO CODE AND NO HASH - Show Debug Info
    // ============================================================
    console.error('[CALLBACK] ❌ No code and no access_token!');
    debug.errorMessage = 'No authentication data received';
    setDebugInfo(debug);
    setStatus('debug');
    setErrorMessage('لم يتم استلام بيانات المصادقة.');
  }, [searchParams, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleCallback();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [handleCallback]);

  // Loading states
  if (status === 'loading' || status === 'checking_session' || status === 'processing_code' || status === 'processing_hash') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground font-medium">
            {status === 'checking_session' && 'جاري التحقق من الجلسة...'}
            {status === 'processing_code' && 'جاري معالجة رمز المصادقة...'}
            {status === 'processing_hash' && 'جاري إنشاء الجلسة...'}
            {status === 'loading' && 'جاري التحميل...'}
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
          <p className="text-muted-foreground text-sm mt-1">جاري التحويل...</p>
        </div>
      </div>
    );
  }

  // Debug state
  if (status === 'debug' && debugInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">مشكلة في تسجيل الدخول</h2>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono space-y-2">
              <p><span className="text-muted-foreground">Pathname:</span> {debugInfo.pathname}</p>
              <p><span className="text-muted-foreground">Code in URL:</span> {debugInfo.hasCode ? '✅ نعم' : '❌ لا'}</p>
              <p><span className="text-muted-foreground">Hash in URL:</span> {debugInfo.hasHash ? '✅ نعم' : '❌ لا'}</p>
              <p><span className="text-muted-foreground">Hash keys:</span> {debugInfo.hashKeys.length > 0 ? debugInfo.hashKeys.join(', ') : 'لا يوجد'}</p>
              <p><span className="text-muted-foreground">Query keys:</span> {debugInfo.queryKeys.length > 0 ? debugInfo.queryKeys.join(', ') : 'لا يوجد'}</p>
              <p><span className="text-muted-foreground">Supabase:</span> {debugInfo.supabaseConfigured ? '✅ مُعد' : '❌ غير مُعد'}</p>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">الحل المقترح:</p>
              <ol className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-decimal list-inside">
                <li>افتح Supabase Dashboard → Authentication → URL Configuration</li>
                <li>تأكد أن Site URL = https://deepsolution.vercel.app</li>
                <li>أضف /auth/callback إلى Redirect URLs</li>
              </ol>
            </div>

            <div className="mt-4 flex gap-3">
              <a 
                href="/login" 
                className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg text-center font-medium hover:bg-primary/90 transition-colors"
              >
                العودة لتسجيل الدخول
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-foreground font-medium">{errorMessage || 'حدث خطأ غير متوقع'}</p>
        <a href="/login" className="text-primary hover:underline mt-2 inline-block">
          العودة لتسجيل الدخول
        </a>
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
