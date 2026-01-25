'use client';

// Force dynamic rendering to prevent prerendering errors with useContext
export const dynamic = 'force-dynamic';

/**
 * Orders Page
 * 
 * Full CRUD for orders with:
 * - Real API integration
 * - Stats overview
 * - Filters and search
 * - Orders table
 * - Status badges
 * - Actions
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage, SkeletonTable } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, orderApi, Order } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import {
  ShoppingCart,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Download,
  Plus,
  ChevronDown,
  Eye,
  MoreHorizontal,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';

// Order status configuration
const orderStatuses = {
  pending: { label: 'قيد الانتظار', color: 'warning', icon: Clock },
  confirmed: { label: 'مؤكد', color: 'info', icon: Package },
  processing: { label: 'قيد التجهيز', color: 'info', icon: Package },
  shipped: { label: 'تم الشحن', color: 'primary', icon: Truck },
  delivered: { label: 'تم التسليم', color: 'success', icon: CheckCircle },
  cancelled: { label: 'ملغي', color: 'error', icon: XCircle },
  returned: { label: 'مرتجع', color: 'neutral', icon: RefreshCw },
} as const;

type OrderStatus = keyof typeof orderStatuses;

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatuses[status] || orderStatuses.pending;
  const Icon = config.icon;
  
  return (
    <span className={cn('ds-badge-' + config.color, 'flex items-center gap-1')}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  color = 'primary',
  index = 0
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
  index?: number;
}) {
  const colorClasses = {
    primary: 'bg-ds-blue-500/10 text-ds-blue-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    error: 'bg-error-100 text-error-600',
  };

  return (
    <div 
      className={cn(
        'ds-card-stat hover-lift',
        'animate-fade-in-up',
        index === 0 && 'stagger-1',
        index === 1 && 'stagger-2',
        index === 2 && 'stagger-3',
        index === 3 && 'stagger-4'
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-[var(--motion-duration-fast)]', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <div className="ds-stat-value">{value}</div>
      {trend && (
        <p className="text-xs text-muted-foreground mt-1">{trend}</p>
      )}
    </div>
  );
}

// Order Modal for Create/Edit
function OrderModal({
  order,
  onClose,
  onSave,
}: {
  order?: Order | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    customer_name: order?.customer_name || '',
    customer_phone: order?.customer_phone || '',
    customer_email: order?.customer_email || '',
    shipping_address: order?.shipping_address || '',
    city: order?.city || '',
    notes: order?.notes || '',
    status: order?.status || 'pending',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (order) {
        await orderApi.update(order.id, formData);
      } else {
        await orderApi.create({
          ...formData,
          items: [], // For new orders, items would be added separately
        });
      }
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
      <div className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {order ? 'تعديل الطلب' : 'طلب جديد'}
          </h2>
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
            <label className="block text-sm font-medium mb-1">اسم العميل *</label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">رقم الهاتف *</label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">عنوان الشحن *</label>
            <textarea
              value={formData.shipping_address}
              onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              rows={2}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">المدينة *</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>

          {order && (
            <div>
              <label className="block text-sm font-medium mb-1">الحالة</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as OrderStatus })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {Object.entries(orderStatuses).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          )}

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

export default function OrdersPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Use real API
  const { orders, stats, loading, error, refetch } = useOrders({
    search: searchQuery || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/orders');
    }
  }, [authLoading, isAuthenticated, router]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  // Show loading while checking auth
  if (authLoading || !isAuthenticated) {
    return (
      <AppShell
        breadcrumbs={[{ label: 'الطلبات' }]}
        title="الطلبات"
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'الطلبات' },
      ]}
      title="الطلبات"
      description="إدارة ومتابعة جميع الطلبات"
      user={user ? { name: user.name, email: user.email } : null}
      headerActions={
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">تصدير</span>
          </button>
          <button 
            onClick={() => {
              setEditingOrder(null);
              setShowModal(true);
            }}
            className="ds-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
          >
            <Plus className="h-4 w-4" />
            <span>طلب جديد</span>
          </button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="إجمالي الطلبات"
          value={stats.total || 0}
          icon={ShoppingCart}
          trend="هذا الشهر"
          index={0}
        />
        <StatCard
          title="قيد الانتظار"
          value={stats.pending || 0}
          icon={Clock}
          color="warning"
          index={1}
        />
        <StatCard
          title="تم الشحن"
          value={stats.shipped || 0}
          icon={Truck}
          color="primary"
          index={2}
        />
        <StatCard
          title="الإيرادات"
          value={formatCurrency(stats.revenue || 0)}
          icon={CheckCircle}
          color="success"
          trend="+12% عن الشهر الماضي"
          index={3}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث برقم الطلب أو اسم العميل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
            className="appearance-none px-4 py-2 pr-10 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
          >
            <option value="all">جميع الحالات</option>
            {Object.entries(orderStatuses).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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

      {/* Orders Table */}
      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : orders.length === 0 ? (
        <EmptyState
          preset={searchQuery || statusFilter !== 'all' ? 'search' : 'orders'}
          action={
            searchQuery || statusFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="text-sm text-primary hover:underline"
              >
                مسح الفلاتر
              </button>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                className="ds-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
              >
                <Plus className="h-4 w-4" />
                إضافة طلب جديد
              </button>
            )
          }
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">رقم الطلب</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">العميل</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المدينة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المبلغ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr
                    key={order.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      'transition-colors duration-[var(--motion-duration-fast)]',
                      'hover:bg-muted/30',
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                      'animate-fade-in-up'
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{order.order_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{order.city}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-sm">{formatCurrency(order.total_amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button 
                          className="p-1.5 hover:bg-muted rounded-md transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingOrder(order);
                            setShowModal(true);
                          }}
                          className="p-1.5 hover:bg-muted rounded-md transition-colors"
                          title="المزيد"
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
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

      {/* Order Modal */}
      {showModal && (
        <OrderModal
          order={editingOrder}
          onClose={() => {
            setShowModal(false);
            setEditingOrder(null);
          }}
          onSave={refetch}
        />
      )}
    </AppShell>
  );
}
