'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Warehouse, 
  Plus, 
  Trash2, 
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2
} from 'lucide-react';

interface WarehouseItem {
  id?: string;
  name: string;
  city: string;
  address?: string;
  is_default?: boolean;
}

interface SetupData {
  multi_warehouse: boolean;
  [key: string]: any;
}

interface Props {
  data: SetupData;
  onUpdate: (data: Partial<SetupData>) => void;
  onNext: (data?: Partial<SetupData>) => void;
  onBack: () => void;
  saving: boolean;
}

export default function Step2Warehouses({ data, onUpdate, onNext, onBack, saving }: Props) {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState<WarehouseItem>({ name: '', city: '' });
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  // Fetch warehouses
  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const res = await fetch('/api/setup/warehouses');
        const data = await res.json();
        if (res.ok) {
          setWarehouses(data.warehouses || []);
        }
      } catch (err) {
        console.error('Error fetching warehouses:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchWarehouses();
  }, []);

  // Add warehouse
  async function addWarehouse() {
    if (!newWarehouse.name || !newWarehouse.city) return;

    setSavingWarehouse(true);
    try {
      const res = await fetch('/api/setup/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarehouse),
      });

      const data = await res.json();
      if (res.ok) {
        setWarehouses(prev => [...prev, data.warehouse]);
        setNewWarehouse({ name: '', city: '' });
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error adding warehouse:', err);
    } finally {
      setSavingWarehouse(false);
    }
  }

  // Delete warehouse
  async function deleteWarehouse(id: string) {
    try {
      const res = await fetch(`/api/setup/warehouses?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setWarehouses(prev => prev.filter(w => w.id !== id));
      }
    } catch (err) {
      console.error('Error deleting warehouse:', err);
    }
  }

  const handleNext = () => {
    onNext({ multi_warehouse: warehouses.length > 1 });
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Warehouse className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">مخازنك</h2>
        <p className="text-slate-400">أضف مخزن واحد على الأقل لإدارة مخزونك</p>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Warehouses List */}
          <div className="space-y-3 mb-6">
            <AnimatePresence>
              {warehouses.map((warehouse, index) => (
                <motion.div
                  key={warehouse.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between p-4 bg-slate-700/50 border border-slate-600 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{warehouse.name}</p>
                      <p className="text-slate-400 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {warehouse.city}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {warehouse.is_default && (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        افتراضي
                      </span>
                    )}
                    <button
                      onClick={() => warehouse.id && deleteWarehouse(warehouse.id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty State */}
            {warehouses.length === 0 && !showForm && (
              <div className="text-center py-8 border-2 border-dashed border-slate-600 rounded-xl">
                <Warehouse className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400">لم تضف أي مخزن بعد</p>
              </div>
            )}
          </div>

          {/* Add Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-slate-700/30 border border-slate-600 rounded-xl"
              >
                <h3 className="text-white font-medium mb-4">إضافة مخزن جديد</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-slate-300 text-sm mb-2">اسم المخزن *</label>
                    <input
                      type="text"
                      value={newWarehouse.name}
                      onChange={(e) => setNewWarehouse(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="مثال: المخزن الرئيسي"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm mb-2">المدينة *</label>
                    <input
                      type="text"
                      value={newWarehouse.city}
                      onChange={(e) => setNewWarehouse(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="مثال: الرياض"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={addWarehouse}
                    disabled={savingWarehouse || !newWarehouse.name || !newWarehouse.city}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    {savingWarehouse ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    إضافة
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl text-slate-400 hover:text-blue-400 transition-colors mb-6"
            >
              <Plus className="w-5 h-5" />
              إضافة مخزن
            </button>
          )}
        </>
      )}

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
          disabled={saving || warehouses.length === 0}
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
