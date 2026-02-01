'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  ShoppingCart,
  Warehouse,
  Headphones,
  Bot,
  Users,
  Plug,
  CheckCircle2,
  Sparkles,
  Check
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
  { id: 1, title: 'مصادر الطلبات', titleEn: 'Order Sources', icon: ShoppingCart, color: 'emerald' },
  { id: 2, title: 'المخازن', titleEn: 'Warehouses', icon: Warehouse, color: 'blue' },
  { id: 3, title: 'خدمة العملاء', titleEn: 'Customer Support', icon: Headphones, color: 'purple' },
  { id: 4, title: 'روبوتات الذكاء', titleEn: 'AI Bots', icon: Bot, color: 'orange' },
  { id: 5, title: 'فريق العمل', titleEn: 'Team', icon: Users, color: 'pink' },
  { id: 6, title: 'المنصات', titleEn: 'Platforms', icon: Plug, color: 'cyan' },
  { id: 7, title: 'الانتهاء', titleEn: 'Finish', icon: CheckCircle2, color: 'emerald' },
];

const STEP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-400' },
  blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400' },
  purple: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-400' },
  orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-400' },
  pink: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-400' },
  cyan: { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-400' },
};

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

const STORAGE_KEY = 'deepsolution_setup_draft';

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>(defaultSetupData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Load draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem(STORAGE_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setSetupData(prev => ({ ...prev, ...parsed }));
        if (parsed.current_step) {
          setCurrentStep(parsed.current_step);
        }
        if (parsed.completedSteps) {
          setCompletedSteps(parsed.completedSteps);
        }
      } catch (e) {
        console.error('Failed to parse draft:', e);
      }
    }
  }, []);

  // Save draft to localStorage
  const saveDraft = useCallback((data: Partial<SetupData>, step?: number, completed?: number[]) => {
    const draft = {
      ...setupData,
      ...data,
      current_step: step || currentStep,
      completedSteps: completed || completedSteps,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [setupData, currentStep, completedSteps]);

  // Fetch initial setup data
  useEffect(() => {
    async function fetchSetup() {
      try {
        const res = await fetch('/api/setup');
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 400 && data.error?.includes('onboarding')) {
            router.push('/onboarding');
            return;
          }
          throw new Error(data.error || 'Failed to fetch setup');
        }

        if (data.setup) {
          const serverData = {
            ...defaultSetupData,
            ...data.setup,
          };
          setSetupData(serverData);
          setCurrentStep(data.setup.current_step || 1);
          
          // Build completed steps from server data
          const completed: number[] = [];
          if (data.setup.order_sources?.length > 0) completed.push(1);
          if (data.setup.multi_warehouse !== undefined) completed.push(2);
          if (data.setup.support_mode) completed.push(3);
          if (data.setup.ai_bots_enabled !== undefined) completed.push(4);
          if (data.setup.staff_count !== undefined) completed.push(5);
          if (data.setup.platforms_enabled?.length >= 0) completed.push(6);
          setCompletedSteps(completed);
          
          if (data.setup.setup_completed) {
            localStorage.removeItem(STORAGE_KEY);
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

      const newData = {
        ...setupData,
        ...stepData,
        current_step: nextStep || currentStep,
      };
      setSetupData(newData);
      
      // Mark current step as completed
      const newCompleted = [...completedSteps];
      if (!newCompleted.includes(currentStep)) {
        newCompleted.push(currentStep);
        setCompletedSteps(newCompleted);
      }
      
      // Save to localStorage
      saveDraft(stepData, nextStep, newCompleted);

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

      // Clear draft
      localStorage.removeItem(STORAGE_KEY);

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
    saveDraft(data);
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
          </motion.div>
          <p className="text-slate-400">جاري تحميل إعدادات النظام...</p>
        </motion.div>
      </div>
    );
  }

  // Animation variants
  const pageVariants = {
    enter: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? 50 : -50,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? -50 : 50,
      opacity: 0,
      scale: 0.98,
    }),
  };

  const currentStepInfo = STEPS[currentStep - 1];
  const currentColor = STEP_COLORS[currentStepInfo?.color || 'emerald'];
  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-6 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-3"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">إعداد النظام</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white mb-1">DeepSolution</h1>
          <p className="text-slate-400 text-sm">قم بإعداد نظامك في دقائق معدودة</p>
        </motion.div>

        {/* Progress Bar - Compact */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          {/* Progress Line */}
          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
            <motion.div
              className={`absolute inset-y-0 right-0 ${currentColor.bg} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Step Icons */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = currentStep === step.id;
              const stepColor = STEP_COLORS[step.color];
              
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex flex-col items-center"
                >
                  <motion.div
                    className={`
                      relative w-10 h-10 rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${isCurrent 
                        ? `${stepColor.bg} text-white ring-4 ring-${step.color}-500/30` 
                        : isCompleted 
                          ? `${stepColor.bg} text-white`
                          : 'bg-slate-700 text-slate-400'}
                    `}
                    whileHover={{ scale: 1.1 }}
                    animate={isCurrent ? { 
                      boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0)', '0 0 0 10px rgba(16, 185, 129, 0.1)', '0 0 0 0 rgba(16, 185, 129, 0)']
                    } : {}}
                    transition={isCurrent ? { duration: 2, repeat: Infinity } : {}}
                  >
                    {isCompleted && !isCurrent ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                      >
                        <Check className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </motion.div>
                  <span className={`text-xs mt-1 hidden sm:block ${isCurrent ? 'text-white' : 'text-slate-500'}`}>
                    {step.title}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Current Step Info */}
          <div className="text-center mt-4">
            <p className={`font-medium ${currentColor.text}`}>{currentStepInfo?.title}</p>
            <p className="text-slate-500 text-xs">الخطوة {currentStep} من {STEPS.length}</p>
          </div>
        </motion.div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 sm:p-8 min-h-[450px]"
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
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
        </motion.div>

        {/* Footer */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-slate-500 text-xs mt-6"
        >
          © 2026 DeepSolution. جميع الحقوق محفوظة.
        </motion.p>
      </div>
    </div>
  );
}
