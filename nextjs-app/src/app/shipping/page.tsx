'use client';
export const dynamic = 'force-dynamic';

/**
 * Shipping Page
 * 
 * Shipment management with:
 * - Real API integration
 * - Shipment list with status tracking
 * - Create shipment modal
 * - Status updates
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage, SkeletonTable } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useShipments, useOrders, shippingApi, Shipment } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import {
  Truck,
  Plus,
  Package,
  CheckCircle,
  Clock,
  MapPin,
  AlertTriangle,
  X,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

// Shipment status configuration
const shipmentStatuses = {
  pending: { label: 'قيد الانتظار', color: 'warning', icon: Clock },
  picked_up: { label: 'تم الاستلام', color: 'info', icon: Package },
  in_transit: { label: 'في الطريق', color: 'primary', icon: Truck },
  out_for_delivery: { label: 'جاري التوصيل', color: 'info', icon: MapPin },
  delivered: { label: 'تم التسليم', color: 'success', icon: CheckCircle },
  failed: { label: 'فشل التسليم', color: 'error', icon: AlertTriangle },
  returned: { label: 'مرتجع', color: 'neutral', icon: Package },
} as const;

type ShipmentStatus = keyof typeof shipmentStatuses;

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const config = shipmentStatuses[status] || shipmentStatuses.pending;
  const Icon = config.icon;
  
  return (
    <span className={cn('ds-badge-' + config.color, 'flex items-center gap-1')}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// Create Shipment Modal
function CreateShipmentModal({
  orders,
  onClose,
  onSave,
}: {
  orders: { id: string; order_number: string; customer_name: string }[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    order_id: '',
    carrier: 'aramex',
    tracking_number: '',
    estimated_delivery: '',
    shipping_cost: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carriers = [
    { id: 'aramex', name: 'أرامكس' },
    { id: 'smsa', name: 'SMSA' },
    { id: 'dhl', name: 'DHL' },
    { id: 'fedex', name: 'FedEx' },
    { id: 'other', name: 'شركة أخرى' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await shippingApi.create({
        order_id: formData.order_id,
        carrier: formData.carrier,
        tracking_number: formData.tracking_number || undefined,
        estimated_delivery: formData.estimated_delivery || undefined,
        shipping_cost: formData.shipping_cost ? parseFloat(formData.shipping_cost) : undefined,
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
      <div className="bg-background rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">إنشاء شحنة جديدة</h2>
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
            <label className="block text-sm font-medium mb-1">الطلب *</label>
            <select
              value={formData.order_id}
              onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            >
              <option value="">اختر الطلب</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.order_number} - {order.customer_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">شركة الشحن *</label>
            <select
              value={formData.carrier}
              onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">رقم التتبع</label>
            <input
              type="text"
              value={formData.tracking_number}
              onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="سيتم إنشاؤه تلقائياً إذا تُرك فارغاً"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ التسليم المتوقع</label>
              <input
                type="date"
                value={formData.estimated_delivery}
                onChange={(e) => setFormData({ ...formData, estimated_delivery: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تكلفة الشحن</label>
              <input
                type="number"
                step="0.01"
                value={formData.shipping_cost}
                onChange={(e) => setFormData({ ...formData, shipping_cost: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
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
              {loading ? 'جاري الإنشاء...' : 'إنشاء الشحنة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ShippingPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  // Use real APIs
  const { shipments, stats, loading, error, refetch } = useShipments();
  const { orders } = useOrders({ status: 'confirmed' }); // Only confirmed orders can be shipped

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/shipping');
    }
  }, [authLoading, isAuthenticated, router]);

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  };

  if (authLoading || !isAuthenticated) {
    return (
      <AppShell
        title="الشحن"
        description="إدارة شحنات الطلبات"
        breadcrumbs={[{ label: 'الشحن', href: '/shipping' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="الشحن"
      description="إدارة شحنات الطلبات"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'الشحن' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
      headerActions={
        <button 
          onClick={() => setShowModal(true)}
          className="ds-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
        >
          <Plus className="h-4 w-4" />
          إنشاء شحنة
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="ds-card-stat">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">إجمالي الشحنات</span>
          </div>
          <div className="text-2xl font-bold">{stats.total || 0}</div>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning-600" />
            </div>
            <span className="text-sm text-muted-foreground">قيد الانتظار</span>
          </div>
          <div className="text-2xl font-bold">{stats.pending || 0}</div>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-info-100 flex items-center justify-center">
              <Truck className="h-5 w-5 text-info-600" />
            </div>
            <span className="text-sm text-muted-foreground">في الطريق</span>
          </div>
          <div className="text-2xl font-bold">{stats.in_transit || 0}</div>
        </div>
        <div className="ds-card-stat">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-success-600" />
            </div>
            <span className="text-sm text-muted-foreground">تم التسليم</span>
          </div>
          <div className="text-2xl font-bold">{stats.delivered || 0}</div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-error-100 text-error-600 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
          <button onClick={refetch} className="mr-auto text-sm underline">إعادة المحاولة</button>
        </div>
      )}

      {/* Shipments Table */}
      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="لا توجد شحنات"
          description="سيظهر هنا سجل الشحنات"
          action={
            <button 
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              إنشاء شحنة
            </button>
          }
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">رقم التتبع</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الطلب</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">شركة الشحن</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التسليم المتوقع</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment, index) => (
                  <tr
                    key={shipment.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      'transition-colors hover:bg-muted/30',
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{shipment.tracking_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{shipment.orders?.order_number || '-'}</p>
                        <p className="text-xs text-muted-foreground">{shipment.orders?.customer_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize">{shipment.carrier}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={shipment.status as ShipmentStatus} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(shipment.estimated_delivery)}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        className="p-1.5 hover:bg-muted rounded-md transition-colors"
                        title="تتبع الشحنة"
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Shipment Modal */}
      {showModal && (
        <CreateShipmentModal
          orders={orders.map(o => ({ id: o.id, order_number: o.order_number, customer_name: o.customer_name }))}
          onClose={() => setShowModal(false)}
          onSave={refetch}
        />
      )}
    </AppShell>
  );
}
