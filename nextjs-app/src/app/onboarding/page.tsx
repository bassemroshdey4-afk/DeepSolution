'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Building2, Globe, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Onboarding Page
 * 
 * This page is shown to new users after their first Google login.
 * It creates their tenant (workspace) and assigns them as owner.
 */

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Form data
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('ecommerce');
  const [country, setCountry] = useState('EG');
  const [currency, setCurrency] = useState('EGP');

  // Check if user is authenticated
  useEffect(() => {
    async function checkAuth() {
      if (!supabase) {
        setError('خطأ في إعدادات النظام. يرجى التواصل مع الدعم الفني.');
        return;
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        // Not authenticated, redirect to login
        router.push('/login');
        return;
      }

      setUser(user);

      // Check if user already has a tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      if (profile?.default_tenant_id) {
        // Already has a tenant, redirect to dashboard
        router.push('/dashboard');
      }
    }

    checkAuth();
  }, [router]);

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!supabase || !user) {
      setError('خطأ في الاتصال. يرجى تحديث الصفحة.');
      return;
    }

    if (!businessName.trim()) {
      setError('يرجى إدخال اسم النشاط التجاري');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: businessName.trim(),
          settings: {
            business_type: businessType,
            country,
            currency,
            locale: 'ar',
          },
        })
        .select()
        .single();

      if (tenantError) {
        throw new Error(`فشل إنشاء المساحة: ${tenantError.message}`);
      }

      // 2. Add user to tenant as owner
      const { error: memberError } = await supabase
        .from('tenant_users')
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        throw new Error(`فشل ربط المستخدم: ${memberError.message}`);
      }

      // 3. Update user's default tenant
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ default_tenant_id: tenant.id })
        .eq('id', user.id);

      if (profileError) {
        console.warn('Could not update default tenant:', profileError);
        // Non-fatal, continue
      }

      // Success! Move to completion step
      setStep(3);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (!user && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">DeepSolution</h1>
          <p className="text-slate-400">منصة إدارة التجارة الإلكترونية الذكية</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <div className={`w-12 h-0.5 ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
          </div>

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                مرحباً بك في DeepSolution!
              </h2>
              <p className="text-slate-400 mb-6">
                {user?.user_metadata?.full_name || user?.email}
              </p>
              <p className="text-slate-300 mb-8">
                لنبدأ بإعداد مساحة العمل الخاصة بك
              </p>
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
              >
                ابدأ الإعداد
              </button>
            </div>
          )}

          {/* Step 2: Business Info */}
          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  معلومات النشاط التجاري
                </h2>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Business Name */}
              <div className="mb-4">
                <label className="block text-slate-300 text-sm mb-2">
                  اسم النشاط التجاري *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="مثال: متجر الأناقة"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Business Type */}
              <div className="mb-4">
                <label className="block text-slate-300 text-sm mb-2">
                  نوع النشاط
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="ecommerce">تجارة إلكترونية</option>
                  <option value="retail">تجارة تجزئة</option>
                  <option value="wholesale">تجارة جملة</option>
                  <option value="services">خدمات</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              {/* Country & Currency */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-slate-300 text-sm mb-2">
                    الدولة
                  </label>
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      // Auto-set currency based on country
                      const currencies: Record<string, string> = {
                        EG: 'EGP',
                        SA: 'SAR',
                        AE: 'AED',
                        KW: 'KWD',
                        QA: 'QAR',
                        BH: 'BHD',
                        OM: 'OMR',
                        JO: 'JOD',
                        LB: 'LBP',
                        IQ: 'IQD',
                      };
                      setCurrency(currencies[e.target.value] || 'USD');
                    }}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="EG">مصر</option>
                    <option value="SA">السعودية</option>
                    <option value="AE">الإمارات</option>
                    <option value="KW">الكويت</option>
                    <option value="QA">قطر</option>
                    <option value="BH">البحرين</option>
                    <option value="OM">عمان</option>
                    <option value="JO">الأردن</option>
                    <option value="LB">لبنان</option>
                    <option value="IQ">العراق</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-2">
                    العملة
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="KWD">دينار كويتي (KWD)</option>
                    <option value="QAR">ريال قطري (QAR)</option>
                    <option value="BHD">دينار بحريني (BHD)</option>
                    <option value="OMR">ريال عماني (OMR)</option>
                    <option value="JOD">دينار أردني (JOD)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  'إنشاء مساحة العمل'
                )}
              </button>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                تم بنجاح!
              </h2>
              <p className="text-slate-300 mb-6">
                تم إنشاء مساحة العمل الخاصة بك
              </p>
              <p className="text-slate-400 text-sm">
                جاري التحويل إلى لوحة التحكم...
              </p>
              <div className="mt-4">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          © 2026 DeepSolution. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
}
