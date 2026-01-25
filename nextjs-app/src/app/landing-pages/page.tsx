'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Layout, Plus } from 'lucide-react';

export default function LandingPagesPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/landing-pages');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <AppShell
        title="صفحات الهبوط"
        description="إنشاء وإدارة صفحات الهبوط"
        breadcrumbs={[{ label: 'صفحات الهبوط', href: '/landing-pages' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="صفحات الهبوط"
      description="إنشاء وإدارة صفحات الهبوط"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'صفحات الهبوط' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
    >
      <EmptyState
        icon={Layout}
        title="لا توجد صفحات هبوط"
        description="أنشئ صفحة هبوط احترافية لمنتجاتك"
        action={
          <button 
            onClick={() => router.push('/ai-pipeline')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            إنشاء صفحة هبوط بالذكاء الاصطناعي
          </button>
        }
      />
    </AppShell>
  );
}
