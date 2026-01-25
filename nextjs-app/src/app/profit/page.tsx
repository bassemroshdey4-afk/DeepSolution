'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3 } from 'lucide-react';

export default function ProfitPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login?redirect=/profit');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <AppShell
        title="تحليلات الربحية"
        description="تتبع أداء متجرك المالي"
        breadcrumbs={[{ label: 'تحليلات الربحية', href: '/profit' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  if (!user) return null;

  return (
    <AppShell
      title="تحليلات الربحية"
      description="تتبع أداء متجرك المالي"
      breadcrumbs={[{ label: 'تحليلات الربحية', href: '/profit' }]}
      user={{ name: user.name, email: user.email, avatar: user.avatarUrl }}
      onLogout={() => router.push('/login')}
    >
      <EmptyState
        icon={BarChart3}
        title="لا توجد بيانات كافية"
        description="ستظهر تحليلات الربحية بعد إتمام بعض الطلبات"
      />
    </AppShell>
  );
}
