'use client';

import { motion } from 'framer-motion';
import { 
  Headphones, 
  User, 
  Bot, 
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface SetupData {
  support_mode: 'human' | 'bot' | 'hybrid';
  [key: string]: any;
}

interface Props {
  data: SetupData;
  onUpdate: (data: Partial<SetupData>) => void;
  onNext: (data?: Partial<SetupData>) => void;
  onBack: () => void;
  saving: boolean;
}

const SUPPORT_MODES = [
  { 
    id: 'human' as const, 
    title: 'فريق بشري', 
    description: 'موظفين يردون على العملاء مباشرة',
    icon: User,
    color: 'blue',
    features: ['تواصل شخصي', 'مرونة في الحلول', 'فهم عميق للمشاكل']
  },
  { 
    id: 'bot' as const, 
    title: 'روبوت ذكي', 
    description: 'ذكاء اصطناعي يرد على العملاء 24/7',
    icon: Bot,
    color: 'purple',
    features: ['متاح 24/7', 'ردود فورية', 'توفير التكاليف']
  },
  { 
    id: 'hybrid' as const, 
    title: 'نظام هجين', 
    description: 'روبوت ذكي + تصعيد للفريق البشري',
    icon: Users,
    color: 'emerald',
    features: ['أفضل الحلين', 'تصعيد ذكي', 'كفاءة عالية'],
    recommended: true
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', ring: 'ring-blue-500/30' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400', ring: 'ring-purple-500/30' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
};

export default function Step3Support({ data, onUpdate, onNext, onBack, saving }: Props) {
  const handleSelect = (mode: 'human' | 'bot' | 'hybrid') => {
    onUpdate({ support_mode: mode });
  };

  const handleNext = () => {
    onNext({ support_mode: data.support_mode });
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Headphones className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">كيف تريد خدمة عملائك؟</h2>
        <p className="text-slate-400">اختر طريقة التواصل مع العملاء</p>
      </div>

      {/* Options */}
      <div className="space-y-4 mb-8">
        {SUPPORT_MODES.map((mode, index) => {
          const isSelected = data.support_mode === mode.id;
          const colors = colorClasses[mode.color];
          
          return (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleSelect(mode.id)}
              className={`
                w-full p-5 rounded-xl border-2 text-right transition-all duration-200
                ${isSelected 
                  ? `${colors.bg} ${colors.border} ring-4 ${colors.ring}` 
                  : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}
              `}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <mode.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white">{mode.title}</h3>
                    {mode.recommended && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        <Sparkles className="w-3 h-3" />
                        موصى به
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{mode.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {mode.features.map((feature, i) => (
                      <span 
                        key={i}
                        className={`px-2 py-1 rounded-full text-xs ${
                          isSelected ? `${colors.bg} ${colors.text}` : 'bg-slate-600/50 text-slate-400'
                        }`}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Radio indicator */}
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${isSelected ? colors.border : 'border-slate-500'}
                `}>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`w-3 h-3 rounded-full ${colors.border.replace('border-', 'bg-')}`}
                    />
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
          السابق
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-xl font-medium transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              التالي
              <ChevronLeft className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
