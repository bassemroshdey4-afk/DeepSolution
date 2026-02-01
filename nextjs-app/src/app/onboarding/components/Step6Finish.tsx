'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Check, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  data: any;
  onComplete: () => Promise<void>;
}

const loadingSteps = [
  { id: 1, text: 'إنشاء حسابك...', duration: 800 },
  { id: 2, text: 'إعداد المتجر...', duration: 1000 },
  { id: 3, text: 'تفعيل الميزات...', duration: 800 },
  { id: 4, text: 'تحضير لوحة التحكم...', duration: 1200 },
];

export default function Step6Finish({ data, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const runSteps = async () => {
      for (let i = 0; i < loadingSteps.length; i++) {
        if (!isMounted) return;
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, loadingSteps[i].duration));
      }
      
      if (!isMounted) return;
      
      // Fire confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      setCompleted(true);
      
      // Wait a bit then redirect
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (isMounted) await onComplete();
    };
    
    runSteps();
    
    return () => { isMounted = false; };
  }, [onComplete]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center"
      >
        {completed ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <Check className="w-12 h-12 text-green-400" />
          </motion.div>
        ) : (
          <Rocket className="w-12 h-12 text-green-400 animate-bounce" />
        )}
      </motion.div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-2">
        {completed ? '🎉 تم بنجاح!' : 'جاري إعداد متجرك...'}
      </h2>
      <p className="text-slate-400 mb-8">
        {completed 
          ? `مرحباً بك في ${data?.company_name || 'DeepSolution'}!`
          : 'لحظات قليلة وسيكون كل شيء جاهزاً'
        }
      </p>

      {/* Loading Steps */}
      <div className="space-y-3 max-w-sm mx-auto">
        {loadingSteps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              index < currentStep || completed
                ? 'bg-green-500/10'
                : index === currentStep
                ? 'bg-slate-700/50'
                : 'bg-slate-800/30'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              index < currentStep || completed
                ? 'bg-green-500'
                : index === currentStep
                ? 'bg-slate-600'
                : 'bg-slate-700'
            }`}>
              {index < currentStep || completed ? (
                <Check className="w-4 h-4 text-white" />
              ) : index === currentStep ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <span className="text-slate-400 text-sm">{step.id}</span>
              )}
            </div>
            <span className={`text-sm ${
              index < currentStep || completed
                ? 'text-green-400'
                : index === currentStep
                ? 'text-white'
                : 'text-slate-500'
            }`}>
              {step.text}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      {completed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl"
        >
          <p className="text-green-400 text-sm">
            جاري تحويلك إلى لوحة التحكم...
          </p>
        </motion.div>
      )}
    </div>
  );
}
