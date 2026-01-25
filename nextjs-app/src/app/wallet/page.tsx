'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Wallet, Plus, CreditCard } from 'lucide-react';

export default function WalletPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/wallet');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <AppShell
        title="المحفظة"
        description="إدارة رصيد المحفظة"
        breadcrumbs={[{ label: 'المحفظة', href: '/wallet' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="المحفظة"
      description="إدارة رصيد المحفظة"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'المحفظة' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
    >
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm opacity-80">الرصيد الحالي</p>
            <p className="text-3xl font-bold">0.00 ر.س</p>
          </div>
        </div>
        <button 
          onClick={() => setShowToast(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          إيداع رصيد
        </button>
      </div>

      <EmptyState
        icon={CreditCard}
        title="لا توجد معاملات"
        description="سيظهر هنا سجل معاملات المحفظة"
      />

      {showToast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-3 rounded-lg shadow-lg animate-fade-in-up">
          <p className="text-sm">ميزة الإيداع قيد التطوير - ستتوفر قريباً</p>
          <button onClick={() => setShowToast(false)} className="absolute top-1 right-2 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
    </AppShell>
  );
}
