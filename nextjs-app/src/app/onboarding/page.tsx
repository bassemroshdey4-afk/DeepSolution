'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Building2, Globe, Loader2, CheckCircle2, Package, Users } from 'lucide-react';

/**
 * Onboarding Page - Multi-step wizard
 * 
 * This page is shown to new users after their first Google login.
 * It collects business info and creates their tenant (workspace).
 * Progress is saved to profiles table in Supabase.
 */

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Step configuration
const STEPS = [
  { id: 1, title: 'مرحباً', icon: Building2 },
  { id: 2, title: 'معلومات النشاط', icon: Globe },
  { id: 3, title: 'حجم الطلبات', icon: Package },
  { id: 4, title: 'الخطة المقترحة', icon: Users },
];

// Monthly order volume options
const ORDER_VOLUMES = [
  { value: '0-100', label: 'أقل من 100 طلب', plan: 'starter' },
  { value: '100-500', label: '100 - 500 طلب', plan: 'growth' },
  { value: '500-2000', label: '500 - 2000 طلب', plan: 'professional' },
  { value: '2000+', label: 'أكثر من 2000 طلب', plan: 'enterprise' },
];

// Plan details
const PLANS: Record<string, { name: string; description: string; features: string[] }> = {
  starter: {
    name: 'Starter',
    description: 'مثالي للمتاجر الناشئة',
    features: ['إدارة الطلبات', 'تقارير أساسية', 'دعم عبر البريد'],
  },
  growth: {
    name: 'Growth',
    description: 'للمتاجر المتنامية',
    features: ['كل مميزات Starter', 'AI Bot واحد', 'تقارير متقدمة', 'دعم أولوية'],
  },
  professional: {
    name: 'Professional',
    description: 'للمتاجر المتوسطة',
    features: ['كل مميزات Growth', '3 AI Bots', 'تكامل متعدد', 'مدير حساب'],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'للمتاجر الكبيرة',
    features: ['كل مميزات Professional', 'AI Bots غير محدود', 'API مخصص', 'دعم 24/7'],
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Form data
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('ecommerce');
  const [country, setCountry] = useState('EG');
  const [currency, setCurrency] = useState('EGP');
  const [language, setLanguage] = useState('ar');
  const [monthlyOrderVolume, setMonthlyOrderVolume] = useState('');
  const [recommendedPlan, setRecommendedPlan] = useState('');

  // Check if user is authenticated and load saved progress
  useEffect(() => {
    async function checkAuthAndLoadProgress() {
      if (!supabase) {
        setError('خطأ في إعدادات النظام. يرجى التواصل مع الدعم الفني.');
        setInitialLoading(false);
        return;
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push('/login');
        return;
      }

      setUser(user);

      // Load profile and check onboarding status
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        // If onboarding already completed, redirect to dashboard or setup
        if (profile.onboarding_completed) {
          router.push('/setup');
          return;
        }

        // Load saved progress
        if (profile.onboarding_step > 0) {
          setStep(profile.onboarding_step);
        }
        if (profile.company_name) setBusinessName(profile.company_name);
        if (profile.country) setCountry(profile.country);
        if (profile.language) setLanguage(profile.language);
        if (profile.currency) setCurrency(profile.currency);
        if (profile.monthly_order_volume) setMonthlyOrderVolume(profile.monthly_order_volume);
        if (profile.recommended_plan) setRecommendedPlan(profile.recommended_plan);
      }

      setInitialLoading(false);
    }

    checkAuthAndLoadProgress();
  }, [router]);

  // Save progress to database
  async function saveProgress(data: Record<string, any>, nextStep?: number) {
    if (!supabase || !user) return;

    const updateData: Record<string, any> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (nextStep !== undefined) {
      updateData.onboarding_step = nextStep;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      console.error('Error saving progress:', error);
    }
  }

  // Handle step navigation
  async function goToStep(newStep: number) {
    setStep(newStep);
    await saveProgress({}, newStep);
  }

  // Handle business info submission
  async function handleBusinessInfoSubmit() {
    if (!businessName.trim()) {
      setError('يرجى إدخال اسم النشاط التجاري');
      return;
    }

    setLoading(true);
    setError(null);

    await saveProgress({
      company_name: businessName.trim(),
      country,
      language,
      currency,
    }, 3);

    setLoading(false);
    setStep(3);
  }

  // Handle order volume selection
  async function handleOrderVolumeSelect(volume: string) {
    setMonthlyOrderVolume(volume);
    
    // Find recommended plan
    const selected = ORDER_VOLUMES.find(v => v.value === volume);
    const plan = selected?.plan || 'starter';
    setRecommendedPlan(plan);

    await saveProgress({
      monthly_order_volume: volume,
      recommended_plan: plan,
    }, 4);

    setStep(4);
  }

  // Handle final submission - create tenant and complete onboarding
  async function handleComplete() {
    if (!supabase || !user) {
      setError('خطأ في الاتصال. يرجى تحديث الصفحة.');
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
            language,
            locale: language,
            monthly_order_volume: monthlyOrderVolume,
            recommended_plan: recommendedPlan,
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

      // 3. Update profile - mark onboarding as complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          default_tenant_id: tenant.id,
          onboarding_completed: true,
          onboarding_step: 5,
        })
        .eq('id', user.id);

      if (profileError) {
        console.warn('Could not update profile:', profileError);
      }

      // 4. Create initial tenant_setup record
      await supabase
        .from('tenant_setup')
        .insert({
          tenant_id: tenant.id,
          setup_completed: false,
          current_step: 1,
        });

      // Success! Redirect to setup wizard
      router.push('/setup');

    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
      setLoading(false);
    }
  }

  // Loading state
  if (initialLoading) {
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
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step >= s.id 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {step > s.id ? '✓' : s.id}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${step > s.id ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                )}
              </div>
            ))}
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
                onClick={() => goToStep(2)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
              >
                ابدأ الإعداد
              </button>
            </div>
          )}

          {/* Step 2: Business Info */}
          {step === 2 && (
            <div>
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
                      const currencies: Record<string, string> = {
                        EG: 'EGP', SA: 'SAR', AE: 'AED', KW: 'KWD',
                        QA: 'QAR', BH: 'BHD', OM: 'OMR', JO: 'JOD',
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
                    <option value="EGP">جنيه مصري</option>
                    <option value="SAR">ريال سعودي</option>
                    <option value="AED">درهم إماراتي</option>
                    <option value="KWD">دينار كويتي</option>
                    <option value="USD">دولار أمريكي</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleBusinessInfoSubmit}
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  'التالي'
                )}
              </button>
            </div>
          )}

          {/* Step 3: Order Volume */}
          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Package className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  كم عدد طلباتك الشهرية؟
                </h2>
                <p className="text-slate-400 text-sm">
                  سنقترح لك الخطة المناسبة بناءً على حجم عملك
                </p>
              </div>

              <div className="space-y-3">
                {ORDER_VOLUMES.map((volume) => (
                  <button
                    key={volume.value}
                    onClick={() => handleOrderVolumeSelect(volume.value)}
                    className={`w-full p-4 rounded-lg border text-right transition-all ${
                      monthlyOrderVolume === volume.value
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-white font-medium">{volume.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => goToStep(2)}
                className="w-full mt-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                ← رجوع
              </button>
            </div>
          )}

          {/* Step 4: Recommended Plan */}
          {step === 4 && recommendedPlan && (
            <div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  الخطة المقترحة لك
                </h2>
              </div>

              {/* Plan Card */}
              <div className="p-6 rounded-xl border-2 border-emerald-500 bg-emerald-500/10 mb-6">
                <h3 className="text-2xl font-bold text-emerald-400 mb-2">
                  {PLANS[recommendedPlan]?.name}
                </h3>
                <p className="text-slate-300 mb-4">
                  {PLANS[recommendedPlan]?.description}
                </p>
                <ul className="space-y-2">
                  {PLANS[recommendedPlan]?.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري إنشاء مساحة العمل...
                  </>
                ) : (
                  'إنشاء مساحة العمل'
                )}
              </button>

              <button
                onClick={() => goToStep(3)}
                className="w-full mt-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                ← رجوع
              </button>
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
