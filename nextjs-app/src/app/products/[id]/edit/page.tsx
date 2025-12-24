'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Save, X } from 'lucide-react';
import { getProduct, updateProduct } from '@/lib/actions/products';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    price: '',
    cost: '',
    quantity: '',
    is_active: true,
    barcode: '',
    low_stock_threshold: '',
    weight: '',
    weight_unit: 'kg',
  });

  useEffect(() => {
    async function loadProduct() {
      try {
        const result = await getProduct(params.id as string);
        if (result.success && result.data) {
          const p = result.data;
          setFormData({
            name: p.name || '',
            sku: p.sku || '',
            category: p.category || '',
            description: p.description || '',
            price: p.price?.toString() || '',
            cost: p.cost?.toString() || '',
            quantity: p.quantity?.toString() || '',
            is_active: p.is_active ?? true,
            barcode: p.barcode || '',
            low_stock_threshold: p.low_stock_threshold?.toString() || '',
            weight: p.weight?.toString() || '',
            weight_unit: p.weight_unit || 'kg',
          });
        } else {
          setError(result.error || 'المنتج غير موجود');
        }
      } catch (err) {
        setError('حدث خطأ أثناء تحميل المنتج');
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await updateProduct(params.id as string, {
        name: formData.name,
        sku: formData.sku || undefined,
        category: formData.category || undefined,
        description: formData.description || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
        is_active: formData.is_active,
        barcode: formData.barcode || undefined,
        low_stock_threshold: formData.low_stock_threshold ? parseInt(formData.low_stock_threshold) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        weight_unit: formData.weight_unit || undefined,
      });

      if (result.success) {
        router.push(`/products/${params.id}`);
      } else {
        setError(result.error || 'فشل تحديث المنتج');
      }
    } catch (err) {
      setError('حدث خطأ أثناء تحديث المنتج');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !formData.name) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">المنتج غير موجود</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/products" className="text-blue-600 hover:underline">
            العودة للمنتجات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href={`/products/${params.id}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
              <ArrowRight className="h-5 w-5" />
              العودة للمنتج
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">تعديل المنتج</h1>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* اسم المنتج */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اسم المنتج <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="أدخل اسم المنتج"
              />
            </div>

            {/* رمز المنتج */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رمز المنتج (SKU)
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="مثال: PROD-001"
              />
            </div>

            {/* التصنيف */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                التصنيف
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">اختر التصنيف</option>
                <option value="ملابس">ملابس</option>
                <option value="إلكترونيات">إلكترونيات</option>
                <option value="أثاث">أثاث</option>
                <option value="طعام">طعام</option>
                <option value="مستحضرات تجميل">مستحضرات تجميل</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            {/* الوصف */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                وصف المنتج
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="أدخل وصف المنتج"
              />
            </div>

            {/* سعر البيع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سعر البيع (ر.س)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            {/* تكلفة الشراء */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تكلفة الشراء (ر.س)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            {/* الكمية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الكمية المتاحة
              </label>
              <input
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>

            {/* الحالة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحالة
              </label>
              <select
                value={formData.is_active ? 'active' : 'draft'}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">نشط</option>
                <option value="draft">مسودة</option>
              </select>
            </div>

            {/* الباركود */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الباركود
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="أدخل الباركود"
              />
            </div>

            {/* حد التنبيه للمخزون */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حد التنبيه للمخزون
              </label>
              <input
                type="number"
                min="0"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
            <Link
              href={`/products/${params.id}`}
              className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
