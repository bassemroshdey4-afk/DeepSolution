'use client';

/**
 * Products Page
 * إدارة المنتجات
 */

import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Plus, Search, Filter, ArrowRight, Edit, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getProducts, getProductStats, deleteProduct } from '@/lib/actions/products';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  cost: number | null;
  quantity: number | null;
  is_active: boolean;
  category: string | null;
  created_at: string;
}

interface ProductStats {
  total: number;
  active: number;
  outOfStock: number;
  draft: number;
}

export default function ProductsPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<ProductStats>({ total: 0, active: 0, outOfStock: 0, draft: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [productsResult, statsResult] = await Promise.all([
          getProducts(),
          getProductStats()
        ]);
        
        if (productsResult.success && productsResult.data) {
          setProducts(productsResult.data);
        }
        
        if (statsResult.success && statsResult.data) {
          setStats(statsResult.data);
        }
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    
    const result = await deleteProduct(id);
    if (result.success) {
      setProducts(products.filter(p => p.id !== id));
      // Refresh stats
      const statsResult = await getProductStats();
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } else {
      alert(result.error || 'حدث خطأ أثناء حذف المنتج');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authLoading || isLoading) {
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
          <div className="ds-stat-value">{stats.total}</div>
        </div>
        <div className="ds-card-stat">
          <div className="text-sm text-muted-foreground mb-1">نشط</div>
          <div className="ds-stat-value text-success-600">{stats.active}</div>
        </div>
        <div className="ds-card-stat">
          <div className="text-sm text-muted-foreground mb-1">نفد المخزون</div>
          <div className="ds-stat-value text-error-600">{stats.outOfStock}</div>
        </div>
        <div className="ds-card-stat">
          <div className="text-sm text-muted-foreground mb-1">مسودة</div>
          <div className="ds-stat-value text-warning-600">{stats.draft}</div>
        </div>
      </div>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
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
      ) : (
        <div className="ds-card mb-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">المنتج</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">SKU</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">السعر</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">الكمية</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">الحالة</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{product.name}</div>
                          {product.category && (
                            <div className="text-xs text-muted-foreground">{product.category}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {product.sku || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {product.price ? `${product.price.toFixed(2)} ر.س` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={product.quantity === 0 ? 'text-error-600' : ''}>
                        {product.quantity ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        product.is_active 
                          ? 'bg-success-100 text-success-700' 
                          : 'bg-warning-100 text-warning-700'
                      }`}>
                        {product.is_active ? 'نشط' : 'مسودة'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/products/${product.id}`}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                          title="عرض"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Link>
                        <Link 
                          href={`/products/${product.id}/edit`}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Link>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 hover:bg-error-100 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4 text-error-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
