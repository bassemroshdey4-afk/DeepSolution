'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Megaphone, Plus } from 'lucide-react';

export default function CampaignsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/campaigns');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <AppShell
        title="الحملات الإعلانية"
        description="إدارة حملات التسويق"
        breadcrumbs={[{ label: 'الحملات', href: '/campaigns' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="الحملات الإعلانية"
      description="إدارة حملات التسويق"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'الحملات' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
    >
      <EmptyState
        icon={Megaphone}
        title="لا توجد حملات"
        description="أنشئ حملتك الإعلانية الأولى للوصول لعملاء جدد"
        action={
          <button 
            onClick={() => setShowToast(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            إنشاء حملة
          </button>
        }
      />
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-3 rounded-lg shadow-lg animate-fade-in-up">
          <p className="text-sm">هذه الميزة قيد التطوير - ستتوفر قريباً</p>
          <button onClick={() => setShowToast(false)} className="absolute top-1 right-2 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
    </AppShell>
  );
}
