'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';

const paymentMethods = [
  { id: 'cod', name: 'الدفع عند الاستلام', description: 'استلام المبلغ من العميل عند التسليم', enabled: true, icon: '💵' },
  { id: 'bank', name: 'تحويل بنكي', description: 'استلام المبلغ عبر التحويل البنكي', enabled: false, icon: '🏦' },
  { id: 'mada', name: 'مدى', description: 'الدفع ببطاقة مدى', enabled: false, icon: '💳' },
  { id: 'visa', name: 'Visa / Mastercard', description: 'الدفع ببطاقة ائتمان', enabled: false, icon: '💳' },
  { id: 'apple', name: 'Apple Pay', description: 'الدفع عبر Apple Pay', enabled: false, icon: '🍎' },
  { id: 'stc', name: 'STC Pay', description: 'الدفع عبر STC Pay', enabled: false, icon: '📱' },
];

export default function PaymentSettingsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [methods] = useState(paymentMethods);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/payment-settings');
    }
  }, [isLoading, isAuthenticated, router]);

  const toggleMethod = (id: string) => {
    if (id === 'cod') return; // COD is always enabled
    setShowToast(true);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <AppShell
        title="إعدادات الدفع"
        description="إدارة طرق الدفع المتاحة"
        breadcrumbs={[{ label: 'إعدادات الدفع', href: '/payment-settings' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="إعدادات الدفع"
      description="إدارة طرق الدفع المتاحة"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'إعدادات الدفع' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
    >
      <div className="space-y-4">
        {methods.map((method) => (
          <div key={method.id} className="flex items-center justify-between border border-border rounded-xl p-4">
            <div className="flex items-center gap-4">
              <span className="text-2xl">{method.icon}</span>
              <div>
                <h3 className="font-semibold">{method.name}</h3>
                <p className="text-sm text-muted-foreground">{method.description}</p>
              </div>
            </div>
            <button
              onClick={() => toggleMethod(method.id)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                method.enabled ? 'bg-green-500' : 'bg-muted'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                method.enabled ? 'right-1' : 'left-1'
              }`} />
            </button>
          </div>
        ))}
      </div>

      {showToast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-3 rounded-lg shadow-lg z-50">
          <p className="text-sm">تفعيل طرق الدفع الإلكتروني يتطلب ربط بوابة دفع - قريباً</p>
          <button onClick={() => setShowToast(false)} className="absolute top-1 right-2 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
    </AppShell>
  );
}
