'use client';
export const dynamic = 'force-dynamic';
import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Plug, Plus, Store, CreditCard, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function IntegrationsPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setIsLoading(false), 800); return () => clearTimeout(timer); }, []);
  if (authLoading) return <AppShell breadcrumbs={[{ label: 'التكاملات' }]} title="التكاملات"><SkeletonPage /></AppShell>;
  return (
    <AppShell breadcrumbs={[{ label: 'التكاملات' }]} title="التكاملات" description="ربط متجرك بالخدمات الخارجية" user={user ? { name: user.name || 'مستخدم', email: user.email } : null} onLogout={signOut}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="ds-card-interactive p-4 cursor-pointer"><div className="flex items-center gap-3 mb-2"><Store className="h-5 w-5 text-primary" /><h3 className="font-medium">المتاجر</h3></div><p className="text-sm text-muted-foreground">Shopify, WooCommerce, Salla</p></div>
        <div className="ds-card-interactive p-4 cursor-pointer"><div className="flex items-center gap-3 mb-2"><CreditCard className="h-5 w-5 text-primary" /><h3 className="font-medium">الدفع</h3></div><p className="text-sm text-muted-foreground">Stripe, PayPal, Moyasar</p></div>
        <div className="ds-card-interactive p-4 cursor-pointer"><div className="flex items-center gap-3 mb-2"><Truck className="h-5 w-5 text-primary" /><h3 className="font-medium">الشحن</h3></div><p className="text-sm text-muted-foreground">Aramex, SMSA, DHL</p></div>
      </div>
      <div className="ds-card"><EmptyState icon={Plug} title="لا توجد تكاملات نشطة" description="اربط متجرك بالخدمات الخارجية لأتمتة عملياتك" action={<button className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" />إضافة تكامل</button>} /></div>
    </AppShell>
  );
}
