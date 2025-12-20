'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Deep Intelligence™ Thinking Experience
 * 
 * Premium loading experience for AI operations.
 * Replaces generic spinners with intelligent, calm, heavy animations.
 * 
 * Design principles:
 * - Intelligent: Shows meaningful progress stages
 * - Heavy: Feels substantial and premium
 * - Calm: No flashy or fast animations
 * - Premium: Uses brand colors and subtle gradients
 */

export interface ThinkingStage {
  id: string;
  label: string;
  description?: string;
}

// Default stages for general AI operations
export const DEFAULT_THINKING_STAGES: ThinkingStage[] = [
  { id: 'analyze', label: 'جاري تحليل البيانات', description: 'قراءة المعطيات الأساسية' },
  { id: 'process', label: 'معالجة المعلومات', description: 'استخراج الأنماط والعلاقات' },
  { id: 'decide', label: 'بناء القرار', description: 'تشكيل التوصيات الذكية' },
  { id: 'finalize', label: 'إتمام النتائج', description: 'تجهيز المخرجات النهائية' },
];

// Product analysis stages
export const PRODUCT_ANALYSIS_STAGES: ThinkingStage[] = [
  { id: 'signals', label: 'تحليل إشارات المنتج', description: 'قراءة الصور والوصف' },
  { id: 'market', label: 'قراءة بيانات السوق', description: 'فهم المنافسة والجمهور' },
  { id: 'strategy', label: 'بناء القرار الاستراتيجي', description: 'تحديد نقاط القوة' },
  { id: 'optimal', label: 'إتمام السيناريو الأمثل', description: 'تجهيز التوصيات' },
];

// Content generation stages
export const CONTENT_GENERATION_STAGES: ThinkingStage[] = [
  { id: 'context', label: 'فهم السياق', description: 'تحليل متطلبات المحتوى' },
  { id: 'structure', label: 'بناء الهيكل', description: 'تصميم البنية الأساسية' },
  { id: 'write', label: 'صياغة المحتوى', description: 'كتابة النص بأسلوب احترافي' },
  { id: 'polish', label: 'التحسين النهائي', description: 'مراجعة وتنقيح' },
];

// Marketing pipeline stages
export const MARKETING_PIPELINE_STAGES: ThinkingStage[] = [
  { id: 'intelligence', label: 'تحليل ذكاء المنتج', description: 'فهم القيمة والجمهور' },
  { id: 'channels', label: 'تحديد القنوات المثلى', description: 'اختيار منصات التسويق' },
  { id: 'creative', label: 'توليد الأفكار الإبداعية', description: 'بناء الرسائل والزوايا' },
  { id: 'ads', label: 'إنشاء الإعلانات', description: 'صياغة المحتوى الإعلاني' },
];

interface DeepIntelligenceThinkingProps {
  /** Current stage index (0-based) */
  currentStage?: number;
  /** Custom stages (defaults to DEFAULT_THINKING_STAGES) */
  stages?: ThinkingStage[];
  /** Show as overlay */
  overlay?: boolean;
  /** Additional className */
  className?: string;
  /** Title text */
  title?: string;
  /** Show stage descriptions */
  showDescriptions?: boolean;
}

export function DeepIntelligenceThinking({
  currentStage = 0,
  stages = DEFAULT_THINKING_STAGES,
  overlay = false,
  className,
  title = 'Deep Intelligence™',
  showDescriptions = true,
}: DeepIntelligenceThinkingProps) {
  const [displayStage, setDisplayStage] = useState(currentStage);

  // Smooth stage transitions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayStage(currentStage);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStage]);

  const content = (
    <div className={cn(
      'flex flex-col items-center justify-center p-8',
      overlay && 'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm',
      className
    )}>
      {/* Logo/Brand Mark */}
      <div className="mb-6">
        <motion.div
          className="relative w-16 h-16"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Gradient ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--primary)/0.3), hsl(var(--primary)))',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
          {/* Inner circle */}
          <div className="absolute inset-1 rounded-full bg-background flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">DS</span>
          </div>
        </motion.div>
      </div>

      {/* Title */}
      <motion.h3
        className="text-lg font-semibold text-foreground mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {title}
      </motion.h3>

      {/* Stages */}
      <div className="w-full max-w-sm space-y-3 mt-4">
        {stages.map((stage, index) => {
          const isActive = index === displayStage;
          const isComplete = index < displayStage;
          const isPending = index > displayStage;

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className={cn(
                'relative flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
                isActive && 'bg-primary/10',
                isComplete && 'opacity-60',
                isPending && 'opacity-40'
              )}
            >
              {/* Status indicator */}
              <div className="relative flex-shrink-0">
                {isActive ? (
                  <motion.div
                    className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <motion.div
                      className="w-3 h-3 rounded-full bg-primary"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </motion.div>
                ) : isComplete ? (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {stage.label}
                </p>
                {showDescriptions && stage.description && isActive && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-xs text-muted-foreground mt-0.5"
                  >
                    {stage.description}
                  </motion.p>
                )}
              </div>

              {/* Active indicator line */}
              {isActive && (
                <motion.div
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-primary"
                  layoutId="activeIndicator"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Subtle gradient background animation */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary)/0.3) 0%, transparent 70%)',
          }}
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary)/0.2) 0%, transparent 70%)',
          }}
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );

  if (overlay) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }

  return content;
}

/**
 * Skeleton variant for inline loading states
 */
export function DeepIntelligenceSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className="h-4 rounded bg-primary/10"
          style={{ width: `${100 - i * 15}%` }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Compact thinking indicator for inline use
 */
export function DeepIntelligenceIndicator({
  label = 'جاري التحليل',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <motion.div
        className="w-2 h-2 rounded-full bg-primary"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export default DeepIntelligenceThinking;
