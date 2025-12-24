'use client';
export const dynamic = 'force-dynamic';
import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Plus, Shield, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function PaymentSettingsPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setIsLoading(false), 800); return () => clearTimeout(timer); }, []);
  if (authLoading) return <AppShell breadcrumbs={[{ label: 'إعدادات الدفع' }]} title="إعدادات الدفع"><SkeletonPage /></AppShell>;
  return (
    <AppShell breadcrumbs={[{ label: 'إعدادات الدفع' }]} title="إعدادات الدفع" description="إدارة طرق الدفع والفواتير" user={user ? { name: user.name || 'مستخدم', email: user.email } : null} onLogout={signOut}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="ds-card p-4"><div className="flex items-center gap-3 mb-3"><Shield className="h-5 w-5 text-success-500" /><h3 className="font-medium">الأمان</h3></div><p className="text-sm text-muted-foreground">جميع المعاملات مشفرة ومحمية</p></div>
        <div className="ds-card p-4"><div className="flex items-center gap-3 mb-3"><CheckCircle className="h-5 w-5 text-info-500" /><h3 className="font-medium">التوافق</h3></div><p className="text-sm text-muted-foreground">متوافق مع PCI DSS</p></div>
      </div>
      <div className="ds-card"><EmptyState icon={CreditCard} title="لا توجد طرق دفع" description="أضف طريقة دفع لاستقبال المدفوعات" action={<button className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" />إضافة طريقة دفع</button>} /></div>
    </AppShell>
  );
}
