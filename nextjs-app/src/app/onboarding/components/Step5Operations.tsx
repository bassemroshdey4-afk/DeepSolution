'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Warehouse, ChevronLeft, ChevronRight, Loader2, Users, Truck, Building } from 'lucide-react';

interface Props {
  data: any;
  onNext: (data: any) => Promise<boolean>;
  onBack: () => void;
  saving: boolean;
}

const teamSizes = [
  { id: '1', label: 'أنا فقط', description: 'عمل فردي' },
  { id: '2-5', label: '2-5', description: 'فريق صغير' },
  { id: '6-15', label: '6-15', description: 'فريق متوسط' },
  { id: '16-50', label: '16-50', description: 'فريق كبير' },
  { id: '50+', label: '+50', description: 'مؤسسة' },
];

export default function Step5Operations({ data, onNext, onBack, saving }: Props) {
  const [multiWarehouse, setMultiWarehouse] = useState(data?.multi_warehouse ?? false);
  const [codEnabled, setCodEnabled] = useState(data?.cod_enabled ?? true);
  const [teamSize, setTeamSize] = useState(data?.team_size || '1');
  const [error, setError] = useState('');

  const handleNext = async () => {
    if (!teamSize) {
      setError('يرجى اختيار حجم الفريق');
      return;
    }
    setError('');
    await onNext({ multi_warehouse: multiWarehouse, cod_enabled: codEnabled, team_size: teamSize });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
      {/* Icon */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center"
        >
          <Warehouse className="w-10 h-10 text-cyan-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">العمليات الأساسية</h2>
        <p className="text-slate-400">حدد طريقة إدارة عملياتك</p>
      </div>

      {/* Multi-Warehouse */}
      <div className="mb-5">
        <label className="block text-slate-300 text-sm mb-3">إدارة المخازن</label>
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMultiWarehouse(false)}
            className={`p-4 rounded-xl border-2 transition-all ${
              !multiWarehouse
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
            }`}
          >
            <Building className={`w-8 h-8 mx-auto mb-2 ${!multiWarehouse ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className={`font-medium block ${!multiWarehouse ? 'text-cyan-400' : 'text-white'}`}>
              مخزن واحد
            </span>
            <span className="text-slate-400 text-xs">إدارة مبسطة</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMultiWarehouse(true)}
            className={`p-4 rounded-xl border-2 transition-all ${
              multiWarehouse
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
            }`}
          >
            <Warehouse className={`w-8 h-8 mx-auto mb-2 ${multiWarehouse ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className={`font-medium block ${multiWarehouse ? 'text-cyan-400' : 'text-white'}`}>
              مخازن متعددة
            </span>
            <span className="text-slate-400 text-xs">إدارة متقدمة</span>
          </motion.button>
        </div>
      </div>

      {/* COD */}
      <div className="mb-5">
        <label className="block text-slate-300 text-sm mb-3">الدفع عند الاستلام (COD)</label>
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCodEnabled(true)}
            className={`p-4 rounded-xl border-2 transition-all ${
              codEnabled
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
            }`}
          >
            <Truck className={`w-8 h-8 mx-auto mb-2 ${codEnabled ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className={`font-medium block ${codEnabled ? 'text-cyan-400' : 'text-white'}`}>
              مفعّل
            </span>
            <span className="text-slate-400 text-xs">قبول الدفع نقداً</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCodEnabled(false)}
            className={`p-4 rounded-xl border-2 transition-all ${
              !codEnabled
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
            }`}
          >
            <Truck className={`w-8 h-8 mx-auto mb-2 opacity-50 ${!codEnabled ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className={`font-medium block ${!codEnabled ? 'text-cyan-400' : 'text-white'}`}>
              معطّل
            </span>
            <span className="text-slate-400 text-xs">دفع إلكتروني فقط</span>
          </motion.button>
        </div>
      </div>

      {/* Team Size */}
      <div className="mb-6">
        <label className="block text-slate-300 text-sm mb-3">حجم الفريق</label>
        <div className="flex flex-wrap gap-2">
          {teamSizes.map((size, index) => (
            <motion.button
              key={size.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTeamSize(size.id)}
              className={`px-4 py-3 rounded-xl border-2 transition-all ${
                teamSize === size.id
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className={`w-4 h-4 ${teamSize === size.id ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span className={`font-medium ${teamSize === size.id ? 'text-cyan-400' : 'text-white'}`}>
                  {size.label}
                </span>
              </div>
              <span className="text-slate-400 text-xs">{size.description}</span>
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
          className="flex-1 py-4 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              إنهاء الإعداد
              <ChevronLeft className="w-5 h-5" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
