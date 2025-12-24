'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Edit, Trash2, Package, Tag, DollarSign, Layers, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { getProduct, deleteProduct } from '@/lib/actions/products';
import type { Product } from '@/lib/actions/products';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      try {
        const result = await getProduct(params.id as string);
        if (result.success && result.data) {
          setProduct(result.data);
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

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    
    setDeleting(true);
    try {
      const result = await deleteProduct(params.id as string);
      if (result.success) {
        router.push('/products');
      } else {
        setError(result.error || 'فشل حذف المنتج');
      }
    } catch (err) {
      setError('حدث خطأ أثناء حذف المنتج');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !product) {
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
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/products" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowRight className="h-5 w-5" />
            العودة للمنتجات
          </Link>
          <div className="flex gap-2">
            <Link
              href={`/products/${product.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit className="h-4 w-4" />
              تعديل
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'جاري الحذف...' : 'حذف'}
            </button>
          </div>
        </div>

        {/* Product Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Product Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
                <div className="flex items-center gap-4">
                  {product.sku && (
                    <span className="text-sm text-gray-500">
                      <Tag className="h-4 w-4 inline ml-1" />
                      SKU: {product.sku}
                    </span>
                  )}
                  {product.category && (
                    <span className="text-sm text-gray-500">
                      <Layers className="h-4 w-4 inline ml-1" />
                      {product.category}
                    </span>
                  )}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                product.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {product.is_active ? (
                  <><CheckCircle className="h-4 w-4 inline ml-1" /> نشط</>
                ) : (
                  <><XCircle className="h-4 w-4 inline ml-1" /> مسودة</>
                )}
              </span>
            </div>
          </div>

          {/* Product Details */}
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">سعر البيع</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {product.price ? `${product.price.toFixed(2)} ر.س` : '-'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">تكلفة الشراء</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {product.cost ? `${product.cost.toFixed(2)} ر.س` : '-'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Package className="h-5 w-5" />
                <span className="text-sm">الكمية المتاحة</span>
              </div>
              <p className={`text-2xl font-bold ${
                (product.quantity || 0) === 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {product.quantity || 0}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Calendar className="h-5 w-5" />
                <span className="text-sm">تاريخ الإنشاء</span>
              </div>
              <p className="text-lg font-medium text-gray-900">
                {new Date(product.created_at).toLocaleDateString('ar-SA')}
              </p>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="p-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">الوصف</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Profit Margin */}
          {product.price && product.cost && (
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">هامش الربح</h3>
              <div className="flex items-center gap-8">
                <div>
                  <span className="text-sm text-gray-500">الربح لكل وحدة</span>
                  <p className="text-xl font-bold text-green-600">
                    {(product.price - product.cost).toFixed(2)} ر.س
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">نسبة الربح</span>
                  <p className="text-xl font-bold text-green-600">
                    {((product.price - product.cost) / product.price * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
