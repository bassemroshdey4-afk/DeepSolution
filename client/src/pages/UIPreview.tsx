/**
 * UI Preview Page
 * 
 * Demonstrates all layout components:
 * - AppShell with Sidebar and Topbar
 * - PageHeader
 * - Skeleton loaders
 * - Empty states
 * - Density modes
 */

import { useState } from 'react';
import {
  AppShell,
  PageHeader,
  EmptyState,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonList,
} from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Plus, Download, RefreshCw, Package, ShoppingCart, FileText, Search } from 'lucide-react';

export default function UIPreview() {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [emptyPreset, setEmptyPreset] = useState<'products' | 'orders' | 'search' | 'error'>('products');

  return (
    <AppShell
      title="معاينة واجهة المستخدم"
      description="عرض جميع مكونات التصميم والتخطيط"
      breadcrumbs={[
        { label: 'الرئيسية', href: '/' },
        { label: 'معاينة واجهة المستخدم' },
      ]}
      headerActions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="ml-2 h-4 w-4" />
            تصدير
          </Button>
          <Button size="sm" className="ds-btn-primary">
            <Plus className="ml-2 h-4 w-4" />
            إضافة جديد
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Section: Buttons */}
        <section className="ds-card">
          <h2 className="ds-section-title mb-4">الأزرار</h2>
          <div className="flex flex-wrap gap-3">
            <Button className="ds-btn-primary">
              <Plus className="ml-2 h-4 w-4" />
              زر رئيسي
            </Button>
            <Button variant="secondary">
              زر ثانوي
            </Button>
            <Button variant="outline">
              زر محدد
            </Button>
            <Button variant="ghost">
              زر شفاف
            </Button>
            <Button variant="destructive">
              زر خطر
            </Button>
            <Button className="ds-btn-ai">
              <RefreshCw className="ml-2 h-4 w-4" />
              إجراء AI
            </Button>
          </div>
        </section>

        {/* Section: Cards */}
        <section>
          <h2 className="ds-section-title mb-4">البطاقات</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="ds-card">
              <h3 className="ds-subsection mb-2">بطاقة عادية</h3>
              <p className="ds-body-sm text-muted-foreground">
                هذه بطاقة عادية تستخدم للمحتوى العام
              </p>
            </div>
            <div className="ds-card-stat">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-ds-gradient-subtle flex items-center justify-center">
                  <Package className="h-5 w-5 text-ds-blue-600" />
                </div>
                <span className="ds-body-sm text-muted-foreground">إجمالي المنتجات</span>
              </div>
              <div className="ds-stat-value">1,234</div>
              <p className="ds-small text-success-600 mt-1">+12% من الشهر الماضي</p>
            </div>
            <div className="ds-card-interactive">
              <h3 className="ds-subsection mb-2">بطاقة تفاعلية</h3>
              <p className="ds-body-sm text-muted-foreground">
                اضغط على هذه البطاقة للتفاعل
              </p>
            </div>
          </div>
        </section>

        {/* Section: Skeleton Loaders */}
        <section className="ds-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="ds-section-title">هياكل التحميل</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSkeleton(!showSkeleton)}
            >
              {showSkeleton ? 'إخفاء' : 'عرض'}
            </Button>
          </div>
          
          {showSkeleton && (
            <div className="space-y-6">
              {/* Text Skeleton */}
              <div>
                <h3 className="ds-body-sm font-medium mb-2">نص</h3>
                <SkeletonText lines={3} />
              </div>

              {/* Card Skeletons */}
              <div>
                <h3 className="ds-body-sm font-medium mb-2">بطاقات</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                </div>
              </div>

              {/* Table Skeleton */}
              <div>
                <h3 className="ds-body-sm font-medium mb-2">جدول</h3>
                <SkeletonTable rows={3} columns={4} />
              </div>

              {/* List Skeleton */}
              <div>
                <h3 className="ds-body-sm font-medium mb-2">قائمة</h3>
                <SkeletonList items={3} />
              </div>
            </div>
          )}
        </section>

        {/* Section: Empty States */}
        <section className="ds-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="ds-section-title">حالات الفراغ</h2>
            <div className="flex gap-2">
              <Button
                variant={emptyPreset === 'products' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmptyPreset('products')}
              >
                <Package className="ml-1 h-4 w-4" />
                منتجات
              </Button>
              <Button
                variant={emptyPreset === 'orders' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmptyPreset('orders')}
              >
                <ShoppingCart className="ml-1 h-4 w-4" />
                طلبات
              </Button>
              <Button
                variant={emptyPreset === 'search' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmptyPreset('search')}
              >
                <Search className="ml-1 h-4 w-4" />
                بحث
              </Button>
              <Button
                variant={emptyPreset === 'error' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmptyPreset('error')}
              >
                خطأ
              </Button>
            </div>
          </div>
          
          <div className="border border-border rounded-lg">
            <EmptyState
              preset={emptyPreset}
              action={
                emptyPreset !== 'error' ? (
                  <Button className="ds-btn-primary" size="sm">
                    <Plus className="ml-2 h-4 w-4" />
                    {emptyPreset === 'products' && 'أضف منتج'}
                    {emptyPreset === 'orders' && 'استيراد طلبات'}
                    {emptyPreset === 'search' && 'مسح البحث'}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm">
                    <RefreshCw className="ml-2 h-4 w-4" />
                    إعادة المحاولة
                  </Button>
                )
              }
            />
          </div>
        </section>

        {/* Section: Typography */}
        <section className="ds-card">
          <h2 className="ds-section-title mb-4">الطباعة</h2>
          <div className="space-y-4">
            <div>
              <span className="ds-tiny text-muted-foreground block mb-1">عنوان الصفحة</span>
              <h1 className="ds-page-title">إدارة المنتجات</h1>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground block mb-1">عنوان القسم</span>
              <h2 className="ds-section-title">المنتجات النشطة</h2>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground block mb-1">عنوان فرعي</span>
              <h3 className="ds-subsection">تفاصيل المنتج</h3>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground block mb-1">نص عادي</span>
              <p className="ds-body">هذا نص عادي يستخدم في المحتوى الرئيسي للصفحات</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground block mb-1">نص صغير</span>
              <p className="ds-body-sm text-muted-foreground">هذا نص صغير يستخدم للوصف والتفاصيل الثانوية</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground block mb-1">نص مساعد</span>
              <p className="ds-small text-muted-foreground">هذا نص مساعد صغير جداً</p>
            </div>
          </div>
        </section>

        {/* Section: Colors */}
        <section className="ds-card">
          <h2 className="ds-section-title mb-4">الألوان</h2>
          
          {/* Brand Colors */}
          <div className="mb-6">
            <h3 className="ds-body-sm font-medium mb-3">ألوان العلامة التجارية</h3>
            <div className="flex gap-2">
              <div className="w-16 h-16 rounded-lg bg-ds-blue-500" title="ds-blue-500" />
              <div className="w-16 h-16 rounded-lg bg-ds-blue-600" title="ds-blue-600" />
              <div className="w-16 h-16 rounded-lg bg-ds-teal-500" title="ds-teal-500" />
              <div className="w-16 h-16 rounded-lg bg-ds-teal-600" title="ds-teal-600" />
              <div className="w-16 h-16 rounded-lg bg-ds-gradient" title="ds-gradient" />
            </div>
          </div>

          {/* Status Colors */}
          <div>
            <h3 className="ds-body-sm font-medium mb-3">ألوان الحالة</h3>
            <div className="flex gap-2">
              <div className="w-16 h-16 rounded-lg bg-success-500" title="success" />
              <div className="w-16 h-16 rounded-lg bg-warning-500" title="warning" />
              <div className="w-16 h-16 rounded-lg bg-error-500" title="error" />
              <div className="w-16 h-16 rounded-lg bg-info-500" title="info" />
            </div>
          </div>
        </section>

        {/* Section: Layout Info */}
        <section className="ds-card">
          <h2 className="ds-section-title mb-4">معلومات التخطيط</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="ds-body-sm font-medium mb-2">قرارات التصميم</h3>
              <ul className="ds-body-sm text-muted-foreground space-y-2">
                <li>• الشريط الجانبي: 256px (عادي) / 64px (مطوي)</li>
                <li>• الشريط العلوي: 64px (مريح) / 56px (مكثف)</li>
                <li>• الحد الأقصى للمحتوى: 1280px</li>
                <li>• الهوامش: 24px (مريح) / 16px (مكثف)</li>
                <li>• نصف قطر الزوايا: 8px للبطاقات، 6px للأزرار</li>
              </ul>
            </div>
            <div>
              <h3 className="ds-body-sm font-medium mb-2">دعم RTL</h3>
              <ul className="ds-body-sm text-muted-foreground space-y-2">
                <li>• الشريط الجانبي على اليمين</li>
                <li>• اتجاه النص من اليمين لليسار</li>
                <li>• الأيقونات تتبع اتجاه النص</li>
                <li>• المسافات متناظرة</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
