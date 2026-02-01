'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, ChevronLeft, Loader2 } from 'lucide-react';

interface Props {
  data: any;
  onNext: (data: any) => Promise<boolean>;
  saving: boolean;
}

const languages = [
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
];

const countries = [
  { code: 'EG', name: 'مصر', flag: '🇪🇬' },
  { code: 'SA', name: 'السعودية', flag: '🇸🇦' },
  { code: 'AE', name: 'الإمارات', flag: '🇦🇪' },
  { code: 'KW', name: 'الكويت', flag: '🇰🇼' },
  { code: 'QA', name: 'قطر', flag: '🇶🇦' },
  { code: 'BH', name: 'البحرين', flag: '🇧🇭' },
  { code: 'OM', name: 'عمان', flag: '🇴🇲' },
  { code: 'JO', name: 'الأردن', flag: '🇯🇴' },
  { code: 'LB', name: 'لبنان', flag: '🇱🇧' },
  { code: 'IQ', name: 'العراق', flag: '🇮🇶' },
  { code: 'MA', name: 'المغرب', flag: '🇲🇦' },
  { code: 'TN', name: 'تونس', flag: '🇹🇳' },
  { code: 'DZ', name: 'الجزائر', flag: '🇩🇿' },
];

export default function Step0Language({ data, onNext, saving }: Props) {
  const [language, setLanguage] = useState(data?.language || 'ar');
  const [country, setCountry] = useState(data?.country || '');
  const [error, setError] = useState('');

  const handleNext = async () => {
    if (!country) {
      setError('يرجى اختيار الدولة');
      return;
    }
    setError('');
    await onNext({ language, country });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
      {/* Icon */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center"
        >
          <Globe className="w-10 h-10 text-blue-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">اللغة والموقع</h2>
        <p className="text-slate-400">اختر لغة الواجهة ودولة نشاطك التجاري</p>
      </div>

      {/* Language Selection */}
      <div className="mb-6">
        <label className="block text-slate-300 text-sm mb-3">لغة الواجهة</label>
        <div className="grid grid-cols-2 gap-3">
          {languages.map((lang) => (
            <motion.button
              key={lang.code}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLanguage(lang.code)}
              className={`p-4 rounded-xl border-2 transition-all ${
                language === lang.code
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <span className="text-2xl mb-2 block">{lang.flag}</span>
              <span className={`font-medium ${language === lang.code ? 'text-blue-400' : 'text-white'}`}>
                {lang.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Country Selection */}
      <div className="mb-6">
        <label className="block text-slate-300 text-sm mb-3">دولة النشاط التجاري</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
          {countries.map((c) => (
            <motion.button
              key={c.code}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setCountry(c.code);
                setError('');
              }}
              className={`p-3 rounded-xl border-2 transition-all ${
                country === c.code
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <span className="text-xl mb-1 block">{c.flag}</span>
              <span className={`text-xs font-medium ${country === c.code ? 'text-blue-400' : 'text-slate-300'}`}>
                {c.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

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

      {/* Next Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleNext}
        disabled={saving}
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
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
  );
}
