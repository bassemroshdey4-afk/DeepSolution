'use client';

export const dynamic = 'force-dynamic';

import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingBag, Plus, Search } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function PurchasingPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (authLoading) {
    return (
      <AppShell breadcrumbs={[{ label: 'المشتريات' }]} title="المشتريات">
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[{ label: 'المشتريات' }]}
      title="المشتريات"
      description="إدارة طلبات الشراء والموردين"
      user={user ? { name: user.name || 'مستخدم', email: user.email } : null}
      onLogout={signOut}
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="البحث في المشتريات..." className="w-full pr-10 pl-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
        <button className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          طلب شراء جديد
        </button>
      </div>
      <div className="ds-card">
        <EmptyState icon={ShoppingBag} title="لا توجد طلبات شراء" description="أنشئ طلب شراء جديد لإدارة مشترياتك من الموردين" />
      </div>
    </AppShell>
  );
}
