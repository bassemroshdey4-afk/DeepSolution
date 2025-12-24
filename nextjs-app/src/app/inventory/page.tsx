'use client';

export const dynamic = 'force-dynamic';

/**
 * Inventory Page
 * إدارة المخزون
 */

import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Boxes, Plus, Search, Filter, AlertTriangle, TrendingDown, TrendingUp, Package } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function InventoryPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (authLoading) {
    return (
      <AppShell breadcrumbs={[{ label: 'المخزون' }]} title="المخزون">
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[{ label: 'المخزون' }]}
      title="المخزون"
      description="تتبع وإدارة مخزون منتجاتك"
      user={user ? { name: user.name || 'مستخدم', email: user.email } : null}
      onLogout={signOut}
    >
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="البحث في المخزون..."
            className="w-full pr-10 pl-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <button className="ds-btn-secondary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
            <Filter className="h-4 w-4" />
            تصفية
          </button>
          <button className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            تعديل المخزون
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">إجمالي المنتجات</span>
          </div>
          <div className="ds-stat-value">0</div>
          <p className="text-xs text-muted-foreground mt-1">منتج في المخزون</p>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-warning-500" />
            <span className="text-sm text-muted-foreground">مخزون منخفض</span>
          </div>
          <div className="ds-stat-value text-warning-600">0</div>
          <p className="text-xs text-muted-foreground mt-1">يحتاج إعادة طلب</p>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-error-500" />
            <span className="text-sm text-muted-foreground">نفد المخزون</span>
          </div>
          <div className="ds-stat-value text-error-600">0</div>
          <p className="text-xs text-muted-foreground mt-1">منتج غير متوفر</p>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-2 mb-1">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">قيمة المخزون</span>
          </div>
          <div className="ds-stat-value">٠٫٠٠ ر.س</div>
          <p className="text-xs text-muted-foreground mt-1">إجمالي التكلفة</p>
        </div>
      </div>

      {/* Inventory List */}
      <div className="ds-card">
        <EmptyState
          icon={Boxes}
          title="لا يوجد مخزون"
          description="أضف منتجات أولاً لبدء تتبع المخزون وإدارة الكميات"
          action={
            <Link href="/products" className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
              إدارة المنتجات
            </Link>
          }
        />
      </div>
    </AppShell>
  );
}
