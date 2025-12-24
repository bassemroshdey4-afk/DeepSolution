'use client';

export const dynamic = 'force-dynamic';

import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, Clock, CheckCircle, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ShippingPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (authLoading) {
    return (
      <AppShell breadcrumbs={[{ label: 'الشحن' }]} title="الشحن">
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[{ label: 'الشحن' }]}
      title="الشحن"
      description="تتبع وإدارة شحنات الطلبات"
      user={user ? { name: user.name || 'مستخدم', email: user.email } : null}
      onLogout={signOut}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-warning-500" />
            <span className="text-sm text-muted-foreground">قيد التجهيز</span>
          </div>
          <div className="ds-stat-value">0</div>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-info-500" />
            <span className="text-sm text-muted-foreground">في الطريق</span>
          </div>
          <div className="ds-stat-value">0</div>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-success-500" />
            <span className="text-sm text-muted-foreground">تم التسليم</span>
          </div>
          <div className="ds-stat-value">0</div>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">شركات الشحن</span>
          </div>
          <div className="ds-stat-value">0</div>
        </div>
      </div>
      <div className="ds-card">
        <EmptyState preset="shipping" action={<button className="ds-btn-primary px-4 py-2 rounded-lg text-sm">إعداد شركات الشحن</button>} />
      </div>
    </AppShell>
  );
}
