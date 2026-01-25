'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingBag, Plus } from 'lucide-react';

export default function PurchasingPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/purchasing');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <AppShell
        title="المشتريات"
        description="إدارة طلبات الشراء من الموردين"
        breadcrumbs={[{ label: 'المشتريات', href: '/purchasing' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="المشتريات"
      description="إدارة طلبات الشراء من الموردين"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'المشتريات' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
    >
      <EmptyState
        icon={ShoppingBag}
        title="لا توجد طلبات شراء"
        description="سيظهر هنا سجل طلبات الشراء من الموردين"
        action={
          <button 
            onClick={() => setShowToast(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            طلب شراء جديد
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
