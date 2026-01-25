'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardList } from 'lucide-react';

export default function AuditLogPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login?redirect=/audit-log');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <AppShell
        title="سجل المراجعة"
        description="تتبع جميع العمليات في النظام"
        breadcrumbs={[{ label: 'سجل المراجعة', href: '/audit-log' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  if (!user) return null;

  return (
    <AppShell
      title="سجل المراجعة"
      description="تتبع جميع العمليات في النظام"
      breadcrumbs={[{ label: 'سجل المراجعة', href: '/audit-log' }]}
      user={{ name: user.name, email: user.email, avatar: user.avatarUrl }}
      onLogout={() => router.push('/login')}
    >
      <EmptyState
        icon={ClipboardList}
        title="لا توجد سجلات"
        description="ستظهر هنا جميع العمليات المسجلة في النظام"
      />
    </AppShell>
  );
}
