'use client';
export const dynamic = 'force-dynamic';
import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Megaphone, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function CampaignsPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setIsLoading(false), 800); return () => clearTimeout(timer); }, []);
  if (authLoading) return <AppShell breadcrumbs={[{ label: 'الحملات' }]} title="الحملات"><SkeletonPage /></AppShell>;
  return (
    <AppShell breadcrumbs={[{ label: 'الحملات' }]} title="الحملات" description="إدارة الحملات التسويقية" user={user ? { name: user.name || 'مستخدم', email: user.email } : null} onLogout={signOut}>
      <div className="flex justify-end mb-6">
        <button className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" />إنشاء حملة</button>
      </div>
      <div className="ds-card"><EmptyState icon={Megaphone} title="لا توجد حملات" description="أنشئ حملتك التسويقية الأولى للوصول لعملاء جدد" /></div>
    </AppShell>
  );
}
