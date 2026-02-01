'use client';

import { motion } from 'framer-motion';
import { 
  Globe, 
  MessageCircle, 
  Instagram, 
  Facebook,
  Phone,
  Store,
  ShoppingBag,
  Loader2,
  ChevronLeft
} from 'lucide-react';

interface SetupData {
  order_sources: string[];
  [key: string]: any;
}

interface Props {
  data: SetupData;
  onUpdate: (data: Partial<SetupData>) => void;
  onNext: (data?: Partial<SetupData>) => void;
  saving: boolean;
}

const ORDER_SOURCES = [
  { id: 'website', label: 'موقع إلكتروني', icon: Globe, color: 'emerald' },
  { id: 'whatsapp', label: 'واتساب', icon: MessageCircle, color: 'green' },
  { id: 'instagram', label: 'انستجرام', icon: Instagram, color: 'pink' },
  { id: 'facebook', label: 'فيسبوك', icon: Facebook, color: 'blue' },
  { id: 'phone', label: 'هاتف', icon: Phone, color: 'yellow' },
  { id: 'marketplace', label: 'سوق إلكتروني', icon: Store, color: 'orange' },
  { id: 'pos', label: 'نقطة بيع', icon: ShoppingBag, color: 'purple' },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-400' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' },
};

export default function Step1OrderSources({ data, onUpdate, onNext, saving }: Props) {
  const toggleSource = (sourceId: string) => {
    const current = data.order_sources || [];
    const updated = current.includes(sourceId)
      ? current.filter(s => s !== sourceId)
      : [...current, sourceId];
    onUpdate({ order_sources: updated });
  };

  const handleNext = () => {
    onNext({ order_sources: data.order_sources });
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">من أين تستقبل طلباتك؟</h2>
        <p className="text-slate-400">اختر جميع القنوات التي تستقبل منها طلبات العملاء</p>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {ORDER_SOURCES.map((source, index) => {
          const isSelected = data.order_sources?.includes(source.id);
          const colors = colorClasses[source.color];
          
          return (
            <motion.button
              key={source.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => toggleSource(source.id)}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-200
                ${isSelected 
                  ? `${colors.bg} ${colors.border}` 
                  : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}
              `}
            >
              <source.icon 
                className={`w-8 h-8 mx-auto mb-2 ${isSelected ? colors.text : 'text-slate-400'}`} 
              />
              <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                {source.label}
              </p>
              
              {/* Checkmark */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`absolute top-2 left-2 w-5 h-5 rounded-full ${colors.bg} ${colors.border} border flex items-center justify-center`}
                >
                  <svg className={`w-3 h-3 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected Count */}
      <div className="text-center mb-6">
        <p className="text-slate-400">
          تم اختيار <span className="text-emerald-400 font-bold">{data.order_sources?.length || 0}</span> قناة
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div /> {/* Empty div for spacing */}
        <button
          onClick={handleNext}
          disabled={saving || !data.order_sources?.length}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
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
