'use client';
export const dynamic = 'force-dynamic';

/**
 * Inventory Page
 * 
 * Full inventory management with:
 * - Real API integration
 * - Movement history
 * - Low stock alerts
 * - Stock adjustments
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage, SkeletonTable } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory, useProducts, inventoryApi, Product } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import {
  Boxes,
  Plus,
  Minus,
  ArrowUpDown,
  AlertTriangle,
  Package,
  TrendingUp,
  TrendingDown,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// Movement type configuration
const movementTypes = {
  in: { label: 'إدخال', color: 'success', icon: TrendingUp },
  out: { label: 'إخراج', color: 'error', icon: TrendingDown },
  adjustment: { label: 'تعديل', color: 'warning', icon: ArrowUpDown },
  sale: { label: 'بيع', color: 'primary', icon: Package },
  return: { label: 'مرتجع', color: 'info', icon: RefreshCw },
} as const;

type MovementType = keyof typeof movementTypes;

function MovementBadge({ type }: { type: MovementType }) {
  const config = movementTypes[type] || movementTypes.adjustment;
  const Icon = config.icon;
  
  return (
    <span className={cn('ds-badge-' + config.color, 'flex items-center gap-1')}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// Adjustment Modal
function AdjustmentModal({
  products,
  onClose,
  onSave,
}: {
  products: Product[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    movement_type: 'adjustment' as 'in' | 'out' | 'adjustment',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await inventoryApi.adjust({
        product_id: formData.product_id,
        quantity: parseInt(formData.quantity) || 0,
        movement_type: formData.movement_type,
        notes: formData.notes || undefined,
      });
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">تعديل المخزون</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-error-100 text-error-600 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">المنتج *</label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            >
              <option value="">اختر المنتج</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (المخزون: {product.stock_quantity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">نوع الحركة *</label>
            <select
              value={formData.movement_type}
              onChange={(e) => setFormData({ ...formData, movement_type: e.target.value as 'in' | 'out' | 'adjustment' })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="in">إدخال (زيادة)</option>
              <option value="out">إخراج (نقص)</option>
              <option value="adjustment">تعديل</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">الكمية *</label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  // Use real APIs
  const { movements, lowStockProducts, loading, error, refetch } = useInventory();
  const { products } = useProducts();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/inventory');
    }
  }, [authLoading, isAuthenticated, router]);

  // Format date
  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  if (authLoading || !isAuthenticated) {
    return (
      <AppShell
        title="المخزون"
        description="إدارة مخزون المنتجات"
        breadcrumbs={[{ label: 'المخزون', href: '/inventory' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="المخزون"
      description="إدارة مخزون المنتجات"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'المخزون' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
      headerActions={
        <button 
          onClick={() => setShowModal(true)}
          className="ds-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
        >
          <Plus className="h-4 w-4" />
          تعديل المخزون
        </button>
      }
    >
      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="mb-6 p-4 bg-warning-100 border border-warning-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-warning-600" />
            <h3 className="font-semibold text-warning-800">تنبيه: منتجات منخفضة المخزون</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map((product) => (
              <span key={product.id} className="px-2 py-1 bg-warning-200 text-warning-800 rounded text-sm">
                {product.name} ({product.stock_quantity} متبقي)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-error-100 text-error-600 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
          <button onClick={refetch} className="mr-auto text-sm underline">إعادة المحاولة</button>
        </div>
      )}

      {/* Movements Table */}
      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : movements.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="لا توجد حركات مخزون"
          description="سيظهر هنا سجل حركات المخزون"
          action={
            <button 
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              تعديل المخزون
            </button>
          }
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المنتج</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">نوع الحركة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الكمية</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المخزون السابق</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المخزون الجديد</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement, index) => (
                  <tr
                    key={movement.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      'transition-colors duration-[var(--motion-duration-fast)]',
                      'hover:bg-muted/30',
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{movement.products?.name || 'منتج محذوف'}</p>
                        <p className="text-xs text-muted-foreground">{movement.products?.sku || '-'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MovementBadge type={movement.movement_type as MovementType} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'font-semibold',
                        movement.movement_type === 'in' || movement.movement_type === 'return' ? 'text-success-600' : 'text-error-600'
                      )}>
                        {movement.movement_type === 'in' || movement.movement_type === 'return' ? '+' : '-'}
                        {movement.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {movement.previous_stock}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {movement.new_stock}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(movement.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showModal && (
        <AdjustmentModal
          products={products}
          onClose={() => setShowModal(false)}
          onSave={refetch}
        />
      )}
    </AppShell>
  );
}
