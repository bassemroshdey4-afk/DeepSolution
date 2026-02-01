'use client';

import { motion } from 'framer-motion';
import { 
  Plug, 
  ShoppingBag, 
  Globe,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface SetupData {
  platforms_enabled: string[];
  [key: string]: any;
}

interface Props {
  data: SetupData;
  onUpdate: (data: Partial<SetupData>) => void;
  onNext: (data?: Partial<SetupData>) => void;
  onBack: () => void;
  saving: boolean;
}

const PLATFORMS = [
  { 
    id: 'shopify', 
    name: 'Shopify', 
    nameAr: 'شوبيفاي',
    description: 'منصة التجارة الإلكترونية العالمية',
    logo: '🛍️',
    color: 'green'
  },
  { 
    id: 'woocommerce', 
    name: 'WooCommerce', 
    nameAr: 'ووكومرس',
    description: 'إضافة ووردبريس للتجارة الإلكترونية',
    logo: '🔌',
    color: 'purple'
  },
  { 
    id: 'salla', 
    name: 'Salla', 
    nameAr: 'سلة',
    description: 'منصة سعودية للتجارة الإلكترونية',
    logo: '🛒',
    color: 'blue'
  },
  { 
    id: 'zid', 
    name: 'Zid', 
    nameAr: 'زد',
    description: 'منصة سعودية للمتاجر الإلكترونية',
    logo: '📦',
    color: 'orange'
  },
  { 
    id: 'magento', 
    name: 'Magento', 
    nameAr: 'ماجنتو',
    description: 'منصة Adobe للتجارة الإلكترونية',
    logo: '🏪',
    color: 'red'
  },
  { 
    id: 'custom', 
    name: 'Custom Website', 
    nameAr: 'موقع مخصص',
    description: 'موقع مبني بتقنية خاصة',
    logo: '🌐',
    color: 'slate'
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  green: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' },
  slate: { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-slate-400' },
};

export default function Step6Platforms({ data, onUpdate, onNext, onBack, saving }: Props) {
  const togglePlatform = (platformId: string) => {
    const current = data.platforms_enabled || [];
    const updated = current.includes(platformId)
      ? current.filter(p => p !== platformId)
      : [...current, platformId];
    onUpdate({ platforms_enabled: updated });
  };

  const handleNext = () => {
    onNext({ platforms_enabled: data.platforms_enabled });
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
          <Plug className="w-8 h-8 text-cyan-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">المنصات المستخدمة</h2>
        <p className="text-slate-400">اختر المنصات التي تستخدمها لمتجرك الإلكتروني</p>
      </div>

      {/* Platforms Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {PLATFORMS.map((platform, index) => {
          const isSelected = data.platforms_enabled?.includes(platform.id);
          const colors = colorClasses[platform.color];
          
          return (
            <motion.button
              key={platform.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => togglePlatform(platform.id)}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-200 text-right
                ${isSelected 
                  ? `${colors.bg} ${colors.border}` 
                  : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}
              `}
            >
              <div className="text-3xl mb-2">{platform.logo}</div>
              <p className={`font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                {platform.nameAr}
              </p>
              <p className="text-slate-500 text-xs">{platform.name}</p>
              
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
          تم اختيار <span className="text-cyan-400 font-bold">{data.platforms_enabled?.length || 0}</span> منصة
        </p>
      </div>

      {/* Info */}
      <div className="p-4 bg-slate-700/30 border border-slate-600 rounded-xl mb-6">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-slate-300 text-sm">
              سيتم ربط المنصات المختارة تلقائياً مع نظامك. يمكنك إضافة أو إزالة المنصات لاحقاً من الإعدادات.
            </p>
          </div>
        </div>
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
