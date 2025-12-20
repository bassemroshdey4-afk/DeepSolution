'use client';

// Force dynamic rendering to prevent prerendering errors with useContext
export const dynamic = 'force-dynamic';

/**
 * Login Page
 * 
 * Authentication page with:
 * - Full logo display
 * - Clean, professional design
 * - RTL support
 */

import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const { loginUrl, isLoading } = useAuth();

  const handleLogin = () => {
    window.location.href = loginUrl;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-ds-gradient items-center justify-center p-12">
        <div className="max-w-md text-center">
          <Image
            src="/ds-logo.png"
            alt="Deep Solution"
            width={120}
            height={120}
            className="mx-auto mb-8 rounded-2xl shadow-2xl"
          />
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
            <Image
              src="/ds-logo.png"
              alt="Deep Solution"
              width={80}
              height={80}
              className="mx-auto mb-4 rounded-xl"
            />
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

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full ds-btn-primary py-3 px-4 rounded-xl text-base font-medium flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
                </>
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground mt-6">
              بالمتابعة، أنت توافق على{' '}
              <a href="#" className="text-primary hover:underline">شروط الاستخدام</a>
              {' '}و{' '}
              <a href="#" className="text-primary hover:underline">سياسة الخصوصية</a>
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
