'use client';
export const dynamic = 'force-dynamic';
import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, TrendingUp, DollarSign, Percent } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ProfitPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setIsLoading(false), 800); return () => clearTimeout(timer); }, []);
  if (authLoading) return <AppShell breadcrumbs={[{ label: 'تحليلات الربحية' }]} title="تحليلات الربحية"><SkeletonPage /></AppShell>;
  return (
    <AppShell breadcrumbs={[{ label: 'تحليلات الربحية' }]} title="تحليلات الربحية" description="تحليل أداء متجرك المالي" user={user ? { name: user.name || 'مستخدم', email: user.email } : null} onLogout={signOut}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="ds-card-stat"><div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-success-500" /><span className="text-sm text-muted-foreground">إجمالي الإيرادات</span></div><div className="ds-stat-value">٠٫٠٠ ر.س</div></div>
        <div className="ds-card-stat"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-info-500" /><span className="text-sm text-muted-foreground">صافي الربح</span></div><div className="ds-stat-value">٠٫٠٠ ر.س</div></div>
        <div className="ds-card-stat"><div className="flex items-center gap-2 mb-1"><Percent className="h-4 w-4 text-warning-500" /><span className="text-sm text-muted-foreground">هامش الربح</span></div><div className="ds-stat-value">٠٪</div></div>
        <div className="ds-card-stat"><div className="flex items-center gap-2 mb-1"><BarChart3 className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">معدل النمو</span></div><div className="ds-stat-value">٠٪</div></div>
      </div>
      <div className="ds-card"><EmptyState preset="analytics" /></div>
    </AppShell>
  );
}
