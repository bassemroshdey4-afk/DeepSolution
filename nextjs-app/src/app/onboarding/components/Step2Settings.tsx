'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';

interface Props {
  data: any;
  onNext: (data: any) => Promise<boolean>;
  onBack: () => void;
  saving: boolean;
}

const currencies = [
  { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'QAR', name: 'ريال قطري', symbol: 'ر.ق' },
  { code: 'BHD', name: 'دينار بحريني', symbol: 'د.ب' },
  { code: 'OMR', name: 'ريال عماني', symbol: 'ر.ع' },
  { code: 'JOD', name: 'دينار أردني', symbol: 'د.أ' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
];

const timezones = [
  { code: 'Africa/Cairo', name: 'القاهرة (GMT+2)', offset: '+02:00' },
  { code: 'Asia/Riyadh', name: 'الرياض (GMT+3)', offset: '+03:00' },
  { code: 'Asia/Dubai', name: 'دبي (GMT+4)', offset: '+04:00' },
  { code: 'Asia/Kuwait', name: 'الكويت (GMT+3)', offset: '+03:00' },
  { code: 'Asia/Qatar', name: 'الدوحة (GMT+3)', offset: '+03:00' },
  { code: 'Asia/Bahrain', name: 'المنامة (GMT+3)', offset: '+03:00' },
  { code: 'Asia/Muscat', name: 'مسقط (GMT+4)', offset: '+04:00' },
  { code: 'Asia/Amman', name: 'عمّان (GMT+3)', offset: '+03:00' },
  { code: 'Africa/Casablanca', name: 'الدار البيضاء (GMT+1)', offset: '+01:00' },
  { code: 'Europe/London', name: 'لندن (GMT+0)', offset: '+00:00' },
];

const languages = [
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'English' },
];

export default function Step2Settings({ data, onNext, onBack, saving }: Props) {
  const [currency, setCurrency] = useState(data?.currency || data?.suggested_currency || 'EGP');
  const [timezone, setTimezone] = useState(data?.timezone || data?.suggested_timezone || 'Africa/Cairo');
  const [defaultLanguage, setDefaultLanguage] = useState(data?.default_language || data?.language || 'ar');
  const [useSuggested, setUseSuggested] = useState(false);

  const handleUseSuggested = () => {
    if (data?.suggested_currency) setCurrency(data.suggested_currency);
    if (data?.suggested_timezone) setTimezone(data.suggested_timezone);
    setUseSuggested(true);
  };

  const handleNext = async () => {
    await onNext({ currency, timezone, default_language: defaultLanguage });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
      {/* Icon */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center"
        >
          <Settings className="w-10 h-10 text-violet-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">العملة والتوقيت</h2>
        <p className="text-slate-400">حدد إعدادات العملة والمنطقة الزمنية</p>
      </div>

      {/* Use Suggested Button */}
      {(data?.suggested_currency || data?.suggested_timezone) && !useSuggested && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleUseSuggested}
          className="w-full mb-6 p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-xl flex items-center justify-center gap-2 text-violet-400 hover:bg-violet-500/20 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          استخدم الإعدادات المقترحة بناءً على موقعك
        </motion.button>
      )}

      {/* Currency */}
      <div className="mb-5">
        <label className="block text-slate-300 text-sm mb-2">العملة الأساسية</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code}) - {c.symbol}
            </option>
          ))}
        </select>
      </div>

      {/* Timezone */}
      <div className="mb-5">
        <label className="block text-slate-300 text-sm mb-2">المنطقة الزمنية</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        >
          {timezones.map((tz) => (
            <option key={tz.code} value={tz.code}>
              {tz.name}
            </option>
          ))}
        </select>
      </div>

      {/* Default Language */}
      <div className="mb-6">
        <label className="block text-slate-300 text-sm mb-2">اللغة الافتراضية للمتجر</label>
        <div className="grid grid-cols-2 gap-3">
          {languages.map((lang) => (
            <motion.button
              key={lang.code}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDefaultLanguage(lang.code)}
              className={`p-4 rounded-xl border-2 transition-all ${
                defaultLanguage === lang.code
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <span className={`font-medium ${defaultLanguage === lang.code ? 'text-violet-400' : 'text-white'}`}>
                {lang.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

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
          className="flex-1 py-4 px-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
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
