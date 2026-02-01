'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, ChevronLeft, ChevronRight, Loader2, Upload, Eye } from 'lucide-react';

interface Props {
  data: any;
  user: any;
  onNext: (data: any) => Promise<boolean>;
  onBack: () => void;
  saving: boolean;
}

export default function Step1Company({ data, user, onNext, onBack, saving }: Props) {
  const [companyName, setCompanyName] = useState(data?.company_name || '');
  const [companySlug, setCompanySlug] = useState(data?.company_slug || '');
  const [logoUrl, setLogoUrl] = useState(data?.logo_url || '');
  const [error, setError] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  // Auto-generate slug from company name
  useEffect(() => {
    if (!slugEdited && companyName) {
      const slug = companyName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setCompanySlug(slug);
    }
  }, [companyName, slugEdited]);

  const handleNext = async () => {
    if (!companyName.trim()) {
      setError('يرجى إدخال اسم المتجر');
      return;
    }
    if (!companySlug.trim()) {
      setError('يرجى إدخال رابط المتجر');
      return;
    }
    setError('');
    await onNext({ company_name: companyName, company_slug: companySlug, logo_url: logoUrl });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
      {/* Icon */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center"
        >
          <Building2 className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">معلومات المتجر</h2>
        <p className="text-slate-400">أدخل اسم متجرك ورابطه الفريد</p>
      </div>

      {/* Company Name */}
      <div className="mb-5">
        <label className="block text-slate-300 text-sm mb-2">اسم المتجر *</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="مثال: متجر الأناقة"
          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Company Slug */}
      <div className="mb-5">
        <label className="block text-slate-300 text-sm mb-2">رابط المتجر *</label>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">deepsolution.app/</span>
          <input
            type="text"
            value={companySlug}
            onChange={(e) => {
              setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              setSlugEdited(true);
            }}
            placeholder="my-store"
            className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
            dir="ltr"
          />
        </div>
      </div>

      {/* Logo Upload (Optional) */}
      <div className="mb-6">
        <label className="block text-slate-300 text-sm mb-2">شعار المتجر (اختياري)</label>
        <div className="flex items-center gap-4">
          {/* Logo Preview */}
          <div className="w-20 h-20 rounded-xl bg-slate-700/50 border border-slate-600 flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-slate-500">
                {companyName ? companyName.charAt(0).toUpperCase() : '?'}
              </span>
            )}
          </div>
          
          {/* Upload Button */}
          <div className="flex-1">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="رابط الشعار (URL)"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              dir="ltr"
            />
            <p className="text-slate-500 text-xs mt-1">يمكنك إضافة الشعار لاحقاً من الإعدادات</p>
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400 text-sm">معاينة مباشرة</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">
                {companyName ? companyName.charAt(0).toUpperCase() : 'D'}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-white font-semibold">{companyName || 'اسم المتجر'}</h3>
            <p className="text-slate-400 text-sm" dir="ltr">deepsolution.app/{companySlug || 'my-store'}</p>
          </div>
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
          className="flex-1 py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
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
