'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  ShoppingCart,
  Warehouse,
  Headphones,
  Bot,
  Users,
  Plug,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

// Import step components
import Step1OrderSources from './components/Step1OrderSources';
import Step2Warehouses from './components/Step2Warehouses';
import Step3Support from './components/Step3Support';
import Step4AIBots from './components/Step4AIBots';
import Step5Staff from './components/Step5Staff';
import Step6Platforms from './components/Step6Platforms';
import Step7Finish from './components/Step7Finish';

// Types
interface SetupData {
  current_step: number;
  setup_completed: boolean;
  order_sources: string[];
  multi_warehouse: boolean;
  support_mode: 'human' | 'bot' | 'hybrid';
  ai_bots_enabled: boolean;
  whatsapp_bot_enabled: boolean;
  meta_bot_enabled: boolean;
  sales_agent_enabled: boolean;
  training_sources: string[];
  staff_count: number;
  platforms_enabled: string[];
}

const STEPS = [
  { id: 1, title: 'مصادر الطلبات', titleEn: 'Order Sources', icon: ShoppingCart },
  { id: 2, title: 'المخازن', titleEn: 'Warehouses', icon: Warehouse },
  { id: 3, title: 'خدمة العملاء', titleEn: 'Customer Support', icon: Headphones },
  { id: 4, title: 'روبوتات الذكاء', titleEn: 'AI Bots', icon: Bot },
  { id: 5, title: 'فريق العمل', titleEn: 'Team', icon: Users },
  { id: 6, title: 'المنصات', titleEn: 'Platforms', icon: Plug },
  { id: 7, title: 'الانتهاء', titleEn: 'Finish', icon: CheckCircle2 },
];

const defaultSetupData: SetupData = {
  current_step: 1,
  setup_completed: false,
  order_sources: [],
  multi_warehouse: false,
  support_mode: 'human',
  ai_bots_enabled: false,
  whatsapp_bot_enabled: false,
  meta_bot_enabled: false,
  sales_agent_enabled: false,
  training_sources: [],
  staff_count: 1,
  platforms_enabled: [],
};

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>(defaultSetupData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Fetch initial setup data
  useEffect(() => {
    async function fetchSetup() {
      try {
        const res = await fetch('/api/setup');
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 400 && data.error?.includes('onboarding')) {
            // Redirect to onboarding if not completed
            router.push('/onboarding');
            return;
          }
          throw new Error(data.error || 'Failed to fetch setup');
        }

        if (data.setup) {
          setSetupData({
            ...defaultSetupData,
            ...data.setup,
          });
          setCurrentStep(data.setup.current_step || 1);
          
          // If setup is completed, redirect to dashboard
          if (data.setup.setup_completed) {
            router.push('/dashboard');
            return;
          }
        }
      } catch (err: any) {
        console.error('Setup fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSetup();
  }, [router]);

  // Save step data
  async function saveStep(stepData: Partial<SetupData>, nextStep?: number) {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stepData,
          step: nextStep || currentStep,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      setSetupData(prev => ({
        ...prev,
        ...stepData,
        current_step: nextStep || currentStep,
      }));

      return true;
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Complete setup
  async function completeSetup() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/setup', {
        method: 'PUT',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete setup');
      }

      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

      return true;
    } catch (err: any) {
      console.error('Complete error:', err);
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Navigate to next step
  async function goToNextStep(stepData?: Partial<SetupData>) {
    if (currentStep >= STEPS.length) return;

    setDirection('forward');
    
    if (stepData) {
      const success = await saveStep(stepData, currentStep + 1);
      if (!success) return;
    }

    setCurrentStep(prev => prev + 1);
  }

  // Navigate to previous step
  function goToPrevStep() {
    if (currentStep <= 1) return;
    setDirection('backward');
    setCurrentStep(prev => prev - 1);
  }

  // Update setup data locally
  function updateSetupData(data: Partial<SetupData>) {
    setSetupData(prev => ({ ...prev, ...data }));
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">جاري تحميل إعدادات النظام...</p>
        </div>
      </div>
    );
  }

  // Animation variants
  const pageVariants = {
    enter: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? -100 : 100,
      opacity: 0,
    }),
  };

  const currentStepInfo = STEPS[currentStep - 1];
  const StepIcon = currentStepInfo?.icon || ShoppingCart;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">إعداد النظام</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">DeepSolution</h1>
          <p className="text-slate-400">قم بإعداد نظامك في دقائق معدودة</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <motion.div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${currentStep >= step.id 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-700 text-slate-400'}
                    ${currentStep === step.id ? 'ring-4 ring-emerald-500/30' : ''}
                  `}
                  initial={false}
                  animate={{
                    scale: currentStep === step.id ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <step.icon className="w-5 h-5" />
                </motion.div>
                {index < STEPS.length - 1 && (
                  <div 
                    className={`w-8 sm:w-16 h-1 mx-1 rounded ${
                      currentStep > step.id ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-white font-medium">{currentStepInfo?.title}</p>
            <p className="text-slate-500 text-sm">الخطوة {currentStep} من {STEPS.length}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Step Content */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 sm:p-8 min-h-[400px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {currentStep === 1 && (
                <Step1OrderSources
                  data={setupData}
                  onUpdate={updateSetupData}
                  onNext={goToNextStep}
                  saving={saving}
                />
              )}
              {currentStep === 2 && (
                <Step2Warehouses
                  data={setupData}
                  onUpdate={updateSetupData}
                  onNext={goToNextStep}
                  onBack={goToPrevStep}
                  saving={saving}
                />
              )}
              {currentStep === 3 && (
                <Step3Support
                  data={setupData}
                  onUpdate={updateSetupData}
                  onNext={goToNextStep}
                  onBack={goToPrevStep}
                  saving={saving}
                />
              )}
              {currentStep === 4 && (
                <Step4AIBots
                  data={setupData}
                  onUpdate={updateSetupData}
                  onNext={goToNextStep}
                  onBack={goToPrevStep}
                  saving={saving}
                />
              )}
              {currentStep === 5 && (
                <Step5Staff
                  data={setupData}
                  onUpdate={updateSetupData}
                  onNext={goToNextStep}
                  onBack={goToPrevStep}
                  saving={saving}
                />
              )}
              {currentStep === 6 && (
                <Step6Platforms
                  data={setupData}
                  onUpdate={updateSetupData}
                  onNext={goToNextStep}
                  onBack={goToPrevStep}
                  saving={saving}
                />
              )}
              {currentStep === 7 && (
                <Step7Finish
                  data={setupData}
                  onComplete={completeSetup}
                  onBack={goToPrevStep}
                  saving={saving}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          © 2026 DeepSolution. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
}
