'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, ChevronLeft, ChevronRight, Loader2, Star, Zap, Crown, Rocket } from 'lucide-react';

interface Props {
  data: any;
  onNext: (data: any) => Promise<boolean>;
  onBack: () => void;
  saving: boolean;
}

const orderRanges = [
  { 
    id: '0-50', 
    label: '0 - 50', 
    description: 'متجر جديد أو صغير',
    plan: 'Starter',
    planColor: 'from-slate-500 to-slate-600',
    icon: Star
  },
  { 
    id: '51-300', 
    label: '51 - 300', 
    description: 'متجر متوسط النمو',
    plan: 'Growth',
    planColor: 'from-blue-500 to-cyan-500',
    icon: Zap
  },
  { 
    id: '301-1500', 
    label: '301 - 1500', 
    description: 'متجر كبير ونشط',
    plan: 'Pro',
    planColor: 'from-violet-500 to-purple-500',
    icon: Crown
  },
  { 
    id: '1500+', 
    label: '+1500', 
    description: 'متجر ضخم / Enterprise',
    plan: 'Enterprise',
    planColor: 'from-amber-500 to-orange-500',
    icon: Rocket
  },
];

export default function Step3Orders({ data, onNext, onBack, saving }: Props) {
  const [monthlyOrders, setMonthlyOrders] = useState(data?.monthly_orders || '');
  const [error, setError] = useState('');

  const selectedRange = orderRanges.find(r => r.id === monthlyOrders);

  const handleNext = async () => {
    if (!monthlyOrders) {
      setError('يرجى اختيار عدد الطلبات الشهرية');
      return;
    }
    setError('');
    await onNext({ monthly_orders: monthlyOrders });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
      {/* Icon */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center"
        >
          <ShoppingCart className="w-10 h-10 text-orange-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">حجم الطلبات</h2>
        <p className="text-slate-400">كم عدد الطلبات المتوقعة شهرياً؟</p>
      </div>

      {/* Order Ranges */}
      <div className="space-y-3 mb-6">
        {orderRanges.map((range, index) => {
          const Icon = range.icon;
          return (
            <motion.button
              key={range.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setMonthlyOrders(range.id);
                setError('');
              }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                monthlyOrders === range.id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${range.planColor} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className={`font-bold text-lg ${monthlyOrders === range.id ? 'text-orange-400' : 'text-white'}`}>
                      {range.label}
                    </span>
                    <span className="text-slate-400 text-sm mr-2">طلب/شهر</span>
                  </div>
                </div>
                <span className="text-slate-400 text-sm">{range.description}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Plan Recommendation */}
      {selectedRange && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl bg-gradient-to-r ${selectedRange.planColor} mb-6`}
        >
          <div className="flex items-center gap-3">
            <selectedRange.icon className="w-8 h-8 text-white" />
            <div>
              <p className="text-white/80 text-sm">الخطة المقترحة لك</p>
              <p className="text-white font-bold text-xl">{selectedRange.plan}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-400 text-sm mb-4 text-center"
        >
          {error}
        </motion.p>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBack}
          className="px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all flex items-center gap-2"
        >
          <ChevronRight className="w-5 h-5" />
          السابق
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          disabled={saving}
          className="flex-1 py-4 px-6 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
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
        </motion.button>
      </div>
    </div>
  );
}
