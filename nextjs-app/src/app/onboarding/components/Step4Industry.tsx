'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react';

interface Props {
  data: any;
  onNext: (data: any) => Promise<boolean>;
  onBack: () => void;
  saving: boolean;
}

const industries = [
  { id: 'fashion', name: 'أزياء وملابس', emoji: '👗' },
  { id: 'electronics', name: 'إلكترونيات', emoji: '📱' },
  { id: 'food', name: 'أغذية ومشروبات', emoji: '🍔' },
  { id: 'beauty', name: 'تجميل وعناية', emoji: '💄' },
  { id: 'home', name: 'أثاث ومنزل', emoji: '🛋️' },
  { id: 'sports', name: 'رياضة ولياقة', emoji: '⚽' },
  { id: 'books', name: 'كتب وقرطاسية', emoji: '📚' },
  { id: 'toys', name: 'ألعاب وأطفال', emoji: '🧸' },
  { id: 'health', name: 'صحة وأدوية', emoji: '💊' },
  { id: 'jewelry', name: 'مجوهرات وإكسسوارات', emoji: '💎' },
  { id: 'automotive', name: 'سيارات وقطع غيار', emoji: '🚗' },
  { id: 'other', name: 'أخرى', emoji: '📦' },
];

const salesChannels = [
  { id: 'website', name: 'موقع إلكتروني', emoji: '🌐' },
  { id: 'instagram', name: 'Instagram', emoji: '📸' },
  { id: 'facebook', name: 'Facebook', emoji: '👍' },
  { id: 'whatsapp', name: 'WhatsApp', emoji: '💬' },
  { id: 'tiktok', name: 'TikTok', emoji: '🎵' },
  { id: 'marketplace', name: 'سوق.كوم / نون', emoji: '🛒' },
  { id: 'physical', name: 'متجر فعلي', emoji: '🏪' },
  { id: 'other', name: 'أخرى', emoji: '📱' },
];

export default function Step4Industry({ data, onNext, onBack, saving }: Props) {
  const [industry, setIndustry] = useState(data?.industry || '');
  const [channels, setChannels] = useState<string[]>(data?.sales_channels || []);
  const [error, setError] = useState('');

  const toggleChannel = (channelId: string) => {
    setChannels(prev => 
      prev.includes(channelId) 
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleNext = async () => {
    if (!industry) {
      setError('يرجى اختيار مجال النشاط');
      return;
    }
    if (channels.length === 0) {
      setError('يرجى اختيار قناة بيع واحدة على الأقل');
      return;
    }
    setError('');
    await onNext({ industry, sales_channels: channels });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
      {/* Icon */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center"
        >
          <Briefcase className="w-10 h-10 text-pink-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">مجال النشاط</h2>
        <p className="text-slate-400">اختر مجال عملك وقنوات البيع</p>
      </div>

      {/* Industry Selection */}
      <div className="mb-6">
        <label className="block text-slate-300 text-sm mb-3">مجال النشاط التجاري *</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {industries.map((ind, index) => (
            <motion.button
              key={ind.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIndustry(ind.id);
                setError('');
              }}
              className={`p-3 rounded-xl border-2 transition-all ${
                industry === ind.id
                  ? 'border-pink-500 bg-pink-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <span className="text-2xl mb-1 block">{ind.emoji}</span>
              <span className={`text-xs font-medium ${industry === ind.id ? 'text-pink-400' : 'text-slate-300'}`}>
                {ind.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Sales Channels */}
      <div className="mb-6">
        <label className="block text-slate-300 text-sm mb-3">قنوات البيع * (اختر واحدة أو أكثر)</label>
        <div className="flex flex-wrap gap-2">
          {salesChannels.map((channel, index) => (
            <motion.button
              key={channel.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleChannel(channel.id)}
              className={`px-4 py-2 rounded-full border-2 transition-all flex items-center gap-2 ${
                channels.includes(channel.id)
                  ? 'border-pink-500 bg-pink-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <span>{channel.emoji}</span>
              <span className={`text-sm ${channels.includes(channel.id) ? 'text-pink-400' : 'text-slate-300'}`}>
                {channel.name}
              </span>
              {channels.includes(channel.id) && (
                <Check className="w-4 h-4 text-pink-400" />
              )}
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
          className="flex-1 py-4 px-6 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
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
