'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  Rocket,
  ShoppingCart,
  Warehouse,
  Headphones,
  Bot,
  Users,
  Plug,
  Sparkles
} from 'lucide-react';

interface SetupData {
  order_sources: string[];
  multi_warehouse: boolean;
  support_mode: 'human' | 'bot' | 'hybrid';
  ai_bots_enabled: boolean;
  whatsapp_bot_enabled: boolean;
  meta_bot_enabled: boolean;
  sales_agent_enabled: boolean;
  staff_count: number;
  platforms_enabled: string[];
  [key: string]: any;
}

interface Props {
  data: SetupData;
  onComplete: () => Promise<boolean>;
  onBack: () => void;
  saving: boolean;
}

const SUPPORT_MODE_LABELS: Record<string, string> = {
  human: 'فريق بشري',
  bot: 'روبوت ذكي',
  hybrid: 'نظام هجين',
};

export default function Step7Finish({ data, onComplete, onBack, saving }: Props) {
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    const success = await onComplete();
    if (success) {
      setCompleted(true);
    }
    setCompleting(false);
  };

  // Summary items
  const summaryItems = [
    {
      icon: ShoppingCart,
      label: 'مصادر الطلبات',
      value: `${data.order_sources?.length || 0} قناة`,
      color: 'emerald'
    },
    {
      icon: Warehouse,
      label: 'المخازن',
      value: data.multi_warehouse ? 'متعدد المخازن' : 'مخزن واحد',
      color: 'blue'
    },
    {
      icon: Headphones,
      label: 'خدمة العملاء',
      value: SUPPORT_MODE_LABELS[data.support_mode] || 'غير محدد',
      color: 'purple'
    },
    {
      icon: Bot,
      label: 'روبوتات الذكاء',
      value: data.ai_bots_enabled ? 'مفعّل' : 'غير مفعّل',
      color: 'orange'
    },
    {
      icon: Users,
      label: 'فريق العمل',
      value: `${data.staff_count || 0} موظف`,
      color: 'pink'
    },
    {
      icon: Plug,
      label: 'المنصات',
      value: `${data.platforms_enabled?.length || 0} منصة`,
      color: 'cyan'
    },
  ];

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    orange: 'bg-orange-500/20 text-orange-400',
    pink: 'bg-pink-500/20 text-pink-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
  };

  // Completed state
  if (completed) {
    return (
      <div className="text-center py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white mb-2"
        >
          تم إعداد نظامك بنجاح!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-400 mb-6"
        >
          جاري تحويلك إلى لوحة التحكم...
        </motion.p>
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
        >
          <Rocket className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">مراجعة وإنهاء الإعداد</h2>
        <p className="text-slate-400">راجع إعداداتك قبل البدء</p>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {summaryItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 bg-slate-700/30 border border-slate-600 rounded-xl"
          >
            <div className={`w-10 h-10 rounded-lg ${colorClasses[item.color]} flex items-center justify-center mb-3`}>
              <item.icon className="w-5 h-5" />
            </div>
            <p className="text-slate-400 text-sm">{item.label}</p>
            <p className="text-white font-medium">{item.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Ready Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl mb-8 text-center"
      >
        <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">نظامك جاهز للانطلاق!</h3>
        <p className="text-slate-400">
          يمكنك تعديل هذه الإعدادات في أي وقت من لوحة التحكم
        </p>
      </motion.div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          disabled={completing}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <ChevronRight className="w-5 h-5" />
          السابق
        </button>
        <button
          onClick={handleComplete}
          disabled={saving || completing}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/20"
        >
          {completing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري الإنهاء...
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              ابدأ الآن
            </>
          )}
        </button>
      </div>
    </div>
  );
}
