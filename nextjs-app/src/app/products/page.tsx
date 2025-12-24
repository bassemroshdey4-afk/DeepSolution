'use client';

export const dynamic = 'force-dynamic';

/**
 * Products Page
 * إدارة المنتجات
 */

import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Plus, Search, Filter, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function ProductsPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (authLoading) {
    return (
      <AppShell breadcrumbs={[{ label: 'المنتجات' }]} title="المنتجات">
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[{ label: 'المنتجات' }]}
      title="المنتجات"
      description="إدارة منتجات متجرك"
      user={user ? { name: user.name || 'مستخدم', email: user.email } : null}
      onLogout={signOut}
    >
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="البحث في المنتجات..."
            className="w-full pr-10 pl-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <button className="ds-btn-secondary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
            <Filter className="h-4 w-4" />
            تصفية
          </button>
          <Link href="/products/new" className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            إضافة منتج
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="ds-card-stat">
          <div className="text-sm text-muted-foreground mb-1">إجمالي المنتجات</div>
          <div className="ds-stat-value">0</div>
        </div>
        <div className="ds-card-stat">
          <div className="text-sm text-muted-foreground mb-1">نشط</div>
          <div className="ds-stat-value text-success-600">0</div>
        </div>
        <div className="ds-card-stat">
          <div className="text-sm text-muted-foreground mb-1">نفد المخزون</div>
          <div className="ds-stat-value text-error-600">0</div>
        </div>
        <div className="ds-card-stat">
          <div className="text-sm text-muted-foreground mb-1">مسودة</div>
          <div className="ds-stat-value text-warning-600">0</div>
        </div>
      </div>

      {/* Products List */}
      <div className="ds-card mb-6">
        <EmptyState
          preset="products"
          action={
            <Link href="/products/new" className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              إضافة منتج جديد
            </Link>
          }
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">إجراءات سريعة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="ds-card-interactive p-4 cursor-pointer">
            <h3 className="font-medium mb-1">استيراد المنتجات</h3>
            <p className="text-sm text-muted-foreground">استورد منتجاتك من ملف Excel أو CSV</p>
          </div>
          <div className="ds-card-interactive p-4 cursor-pointer">
            <h3 className="font-medium mb-1">ربط المتجر</h3>
            <p className="text-sm text-muted-foreground">اربط متجرك الإلكتروني لمزامنة المنتجات</p>
          </div>
          <Link href="/ai-pipeline" className="ds-card-interactive p-4">
            <h3 className="font-medium mb-1 flex items-center gap-2">
              Deep Intelligence™
              <ArrowRight className="h-4 w-4" />
            </h3>
            <p className="text-sm text-muted-foreground">حلل منتجاتك بالذكاء الاصطناعي</p>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
