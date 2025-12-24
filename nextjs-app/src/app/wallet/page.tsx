'use client';
export const dynamic = 'force-dynamic';
import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function WalletPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setIsLoading(false), 800); return () => clearTimeout(timer); }, []);
  if (authLoading) return <AppShell breadcrumbs={[{ label: 'المحفظة' }]} title="المحفظة"><SkeletonPage /></AppShell>;
  return (
    <AppShell breadcrumbs={[{ label: 'المحفظة' }]} title="المحفظة" description="إدارة رصيدك ومعاملاتك المالية" user={user ? { name: user.name || 'مستخدم', email: user.email } : null} onLogout={signOut}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="ds-card-stat lg:col-span-1">
          <div className="text-sm text-muted-foreground mb-1">الرصيد الحالي</div>
          <div className="ds-stat-value text-2xl">٠٫٠٠ ر.س</div>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="h-4 w-4 text-success-500" /><span className="text-sm text-muted-foreground">الإيرادات</span></div>
          <div className="ds-stat-value text-success-600">٠٫٠٠ ر.س</div>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1"><ArrowDownLeft className="h-4 w-4 text-error-500" /><span className="text-sm text-muted-foreground">المصروفات</span></div>
          <div className="ds-stat-value text-error-600">٠٫٠٠ ر.س</div>
        </div>
      </div>
      <div className="ds-card"><EmptyState icon={Wallet} title="لا توجد معاملات" description="ستظهر معاملاتك المالية هنا" /></div>
    </AppShell>
  );
}
