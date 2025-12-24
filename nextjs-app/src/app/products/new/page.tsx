'use client';

export const dynamic = 'force-dynamic';

/**
 * Add New Product Page
 * صفحة إضافة منتج جديد - متصلة بـ Supabase
 */

import { AppShell, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Package, Upload, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createProduct, type ProductInput } from '@/lib/actions/products';

export default function NewProductPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    price: '',
    cost: '',
    quantity: '',
    category: '',
    status: 'active',
    barcode: '',
    low_stock_threshold: '5',
    weight: '',
    weight_unit: 'kg',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error('اسم المنتج مطلوب');
      }
      if (!formData.price || parseFloat(formData.price) <= 0) {
        throw new Error('السعر يجب أن يكون أكبر من صفر');
      }

      // Prepare product input
      const productInput: ProductInput = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        price: parseFloat(formData.price) || 0,
        cost: parseFloat(formData.cost) || 0,
        quantity: parseInt(formData.quantity) || 0,
        is_active: formData.status === 'active',
        category: formData.category || undefined,
        barcode: formData.barcode.trim() || undefined,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 5,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        weight_unit: formData.weight_unit || 'kg',
      };

      // Call server action
      const result = await createProduct(productInput);

      if (!result.success) {
        throw new Error(result.error || 'حدث خطأ أثناء إنشاء المنتج');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/products');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء المنتج');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <AppShell
        breadcrumbs={[
          { label: 'المنتجات', href: '/products' },
          { label: 'إضافة منتج' },
        ]}
        title="إضافة منتج جديد"
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: 'المنتجات', href: '/products' },
        { label: 'إضافة منتج' },
      ]}
      title="إضافة منتج جديد"
      description="أضف منتجاً جديداً إلى متجرك"
      user={user ? { name: user.name || 'مستخدم', email: user.email } : null}
      onLogout={signOut}
    >
      {/* Back Link */}
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للمنتجات
      </Link>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">تم إنشاء المنتج بنجاح!</p>
            <p className="text-sm">جاري التحويل لقائمة المنتجات...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">خطأ</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="ds-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            المعلومات الأساسية
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                اسم المنتج <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="مثال: قميص قطني أبيض"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">رمز المنتج (SKU)</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="مثال: SHIRT-WHT-001"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">الباركود</label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="مثال: 6281000000000"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">التصنيف</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">اختر التصنيف</option>
                <option value="clothing">ملابس</option>
                <option value="electronics">إلكترونيات</option>
                <option value="accessories">إكسسوارات</option>
                <option value="home">منزل ومطبخ</option>
                <option value="beauty">جمال وعناية</option>
                <option value="sports">رياضة</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">حد التنبيه للمخزون</label>
              <input
                type="number"
                name="low_stock_threshold"
                value={formData.low_stock_threshold}
                onChange={handleChange}
                placeholder="5"
                min="0"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">وصف المنتج</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="أدخل وصفاً تفصيلياً للمنتج..."
                rows={4}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="ds-card p-6">
          <h2 className="text-lg font-semibold mb-4">التسعير والمخزون</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                سعر البيع <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pl-12"
                  required
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ر.س
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">تكلفة الشراء</label>
              <div className="relative">
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pl-12"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ر.س
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">الكمية المتاحة</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Weight */}
        <div className="ds-card p-6">
          <h2 className="text-lg font-semibold mb-4">الوزن والشحن</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">الوزن</label>
              <input
                type="number"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">وحدة الوزن</label>
              <select
                name="weight_unit"
                value={formData.weight_unit}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="kg">كيلوغرام (kg)</option>
                <option value="g">غرام (g)</option>
                <option value="lb">رطل (lb)</option>
                <option value="oz">أونصة (oz)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="ds-card p-6">
          <h2 className="text-lg font-semibold mb-4">الحالة</h2>
          
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="active"
                checked={formData.status === 'active'}
                onChange={handleChange}
                className="w-4 h-4 text-primary accent-primary"
              />
              <span className="text-sm">نشط</span>
              <span className="text-xs text-muted-foreground">(سيظهر في المتجر)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="draft"
                checked={formData.status === 'draft'}
                onChange={handleChange}
                className="w-4 h-4 text-primary accent-primary"
              />
              <span className="text-sm">مسودة</span>
              <span className="text-xs text-muted-foreground">(لن يظهر في المتجر)</span>
            </label>
          </div>
        </div>

        {/* Image Upload (Placeholder) */}
        <div className="ds-card p-6">
          <h2 className="text-lg font-semibold mb-4">صور المنتج</h2>
          
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              اسحب الصور هنا أو انقر للاختيار
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP حتى 5MB
            </p>
            <button
              type="button"
              className="mt-4 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted/50 transition-colors"
              title="قريباً - رفع الصور"
              disabled
            >
              اختيار الصور (قريباً)
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <Link
            href="/products"
            className="px-6 py-2 border border-border rounded-lg text-sm inline-flex items-center gap-2 hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || success}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm inline-flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                حفظ المنتج
              </>
            )}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
