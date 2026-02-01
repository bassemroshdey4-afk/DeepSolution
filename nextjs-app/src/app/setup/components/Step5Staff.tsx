'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Trash2, 
  Mail,
  Phone,
  Shield,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCircle
} from 'lucide-react';

interface StaffMember {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'manager' | 'agent' | 'warehouse' | 'support';
}

interface SetupData {
  staff_count: number;
  [key: string]: any;
}

interface Props {
  data: SetupData;
  onUpdate: (data: Partial<SetupData>) => void;
  onNext: (data?: Partial<SetupData>) => void;
  onBack: () => void;
  saving: boolean;
}

const ROLES = [
  { id: 'admin', label: 'مدير', color: 'red' },
  { id: 'manager', label: 'مدير عمليات', color: 'orange' },
  { id: 'agent', label: 'موظف مبيعات', color: 'blue' },
  { id: 'warehouse', label: 'موظف مخزن', color: 'green' },
  { id: 'support', label: 'دعم عملاء', color: 'purple' },
];

const roleColors: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  manager: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  agent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warehouse: 'bg-green-500/20 text-green-400 border-green-500/30',
  support: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export default function Step5Staff({ data, onUpdate, onNext, onBack, saving }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newStaff, setNewStaff] = useState<StaffMember>({ name: '', role: 'agent' });
  const [savingStaff, setSavingStaff] = useState(false);

  // Fetch staff
  useEffect(() => {
    async function fetchStaff() {
      try {
        const res = await fetch('/api/setup/staff');
        const data = await res.json();
        if (res.ok) {
          setStaff(data.staff || []);
        }
      } catch (err) {
        console.error('Error fetching staff:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStaff();
  }, []);

  // Add staff
  async function addStaff() {
    if (!newStaff.name) return;

    setSavingStaff(true);
    try {
      const res = await fetch('/api/setup/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff),
      });

      const data = await res.json();
      if (res.ok) {
        setStaff(prev => [...prev, data.staff]);
        setNewStaff({ name: '', role: 'agent' });
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error adding staff:', err);
    } finally {
      setSavingStaff(false);
    }
  }

  // Delete staff
  async function deleteStaff(id: string) {
    try {
      const res = await fetch(`/api/setup/staff?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setStaff(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Error deleting staff:', err);
    }
  }

  const handleNext = () => {
    onNext({ staff_count: staff.length });
  };

  const getRoleLabel = (roleId: string) => {
    return ROLES.find(r => r.id === roleId)?.label || roleId;
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
          <Users className="w-8 h-8 text-orange-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">فريق العمل</h2>
        <p className="text-slate-400">أضف أعضاء فريقك وحدد أدوارهم</p>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Staff List */}
          <div className="space-y-3 mb-6">
            <AnimatePresence>
              {staff.map((member, index) => (
                <motion.div
                  key={member.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between p-4 bg-slate-700/50 border border-slate-600 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{member.name}</p>
                      <div className="flex items-center gap-2 text-sm">
                        {member.email && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {member.email}
                          </span>
                        )}
                        {member.phone && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {member.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full border ${roleColors[member.role]}`}>
                      {getRoleLabel(member.role)}
                    </span>
                    <button
                      onClick={() => member.id && deleteStaff(member.id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty State */}
            {staff.length === 0 && !showForm && (
              <div className="text-center py-8 border-2 border-dashed border-slate-600 rounded-xl">
                <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400">لم تضف أي موظف بعد</p>
                <p className="text-slate-500 text-sm">يمكنك إضافة الموظفين لاحقاً</p>
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
                <h3 className="text-white font-medium mb-4">إضافة موظف جديد</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-slate-300 text-sm mb-2">الاسم *</label>
                    <input
                      type="text"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="اسم الموظف"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm mb-2">الدور *</label>
                    <select
                      value={newStaff.role}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, role: e.target.value as StaffMember['role'] }))}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {ROLES.map(role => (
                        <option key={role.id} value={role.id}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm mb-2">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={newStaff.email || ''}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm mb-2">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={newStaff.phone || ''}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+966 5x xxx xxxx"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    onClick={addStaff}
                    disabled={savingStaff || !newStaff.name}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    {savingStaff ? (
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
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-600 hover:border-orange-500 rounded-xl text-slate-400 hover:text-orange-400 transition-colors mb-6"
            >
              <Plus className="w-5 h-5" />
              إضافة موظف
            </button>
          )}

          {/* Info */}
          <div className="p-4 bg-slate-700/30 border border-slate-600 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-slate-300 text-sm">
                  يمكنك إضافة الموظفين لاحقاً من لوحة التحكم. كل موظف سيحصل على دعوة للانضمام.
                </p>
              </div>
            </div>
          </div>
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
