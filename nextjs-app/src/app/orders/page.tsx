'use client';

// Force dynamic rendering to prevent prerendering errors with useContext
export const dynamic = 'force-dynamic';

/**
 * Orders Page
 * 
 * Standard model page for the platform with:
 * - Stats overview
 * - Filters and search
 * - Orders table
 * - Status badges
 * - Actions
 * 
 * Arabic copy follows I18N_TONE_GUIDE.md
 */

import { useState } from 'react';
import { AppShell, EmptyState, SkeletonPage, SkeletonTable } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
// trpc removed - using mock data for now
import { cn } from '@/lib/utils';
import {
  ShoppingCart,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  Plus,
  ChevronDown,
  Eye,
  MoreHorizontal,
  RefreshCw,
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

// Mock data for demonstration
const mockOrders = [
  {
    id: 'ORD-001',
    customerName: 'أحمد محمد',
    customerPhone: '0501234567',
    total: 450.00,
    status: 'pending' as OrderStatus,
    items: 3,
    createdAt: new Date('2024-12-20T10:30:00'),
    city: 'الرياض',
  },
  {
    id: 'ORD-002',
    customerName: 'سارة علي',
    customerPhone: '0559876543',
    total: 1250.00,
    status: 'shipped' as OrderStatus,
    items: 5,
    createdAt: new Date('2024-12-19T14:20:00'),
    city: 'جدة',
  },
  {
    id: 'ORD-003',
    customerName: 'محمد خالد',
    customerPhone: '0541112233',
    total: 89.00,
    status: 'delivered' as OrderStatus,
    items: 1,
    createdAt: new Date('2024-12-18T09:15:00'),
    city: 'الدمام',
  },
  {
    id: 'ORD-004',
    customerName: 'فاطمة أحمد',
    customerPhone: '0567778899',
    total: 320.00,
    status: 'processing' as OrderStatus,
    items: 2,
    createdAt: new Date('2024-12-20T08:45:00'),
    city: 'مكة',
  },
  {
    id: 'ORD-005',
    customerName: 'عبدالله سعد',
    customerPhone: '0533334444',
    total: 175.00,
    status: 'cancelled' as OrderStatus,
    items: 1,
    createdAt: new Date('2024-12-17T16:00:00'),
    city: 'المدينة',
  },
];

// Stats data
const mockStats = {
  total: 156,
  pending: 23,
  shipped: 45,
  delivered: 78,
  revenue: 45680,
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatuses[status];
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
        // Stagger animation
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

export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Filter orders
  const filteredOrders = mockOrders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.includes(searchQuery) ||
      order.customerPhone.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (authLoading) {
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
          <button className="ds-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg">
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
          value={mockStats.total}
          icon={ShoppingCart}
          trend="هذا الشهر"
          index={0}
        />
        <StatCard
          title="قيد الانتظار"
          value={mockStats.pending}
          icon={Clock}
          color="warning"
          index={1}
        />
        <StatCard
          title="تم الشحن"
          value={mockStats.shipped}
          icon={Truck}
          color="primary"
          index={2}
        />
        <StatCard
          title="الإيرادات"
          value={formatCurrency(mockStats.revenue)}
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

      {/* Orders Table */}
      {isLoading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : filteredOrders.length === 0 ? (
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
            ) : undefined
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المنتجات</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المبلغ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      // Motion: smooth hover transition
                      'transition-colors duration-[var(--motion-duration-fast)]',
                      'hover:bg-muted/30',
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                      // Stagger animation for rows
                      'animate-fade-in-up',
                      `[animation-delay:${index * 30}ms]`
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-primary">{order.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{order.customerPhone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{order.city}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{order.items} منتج</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium">{formatCurrency(order.total)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1.5 rounded-md transition-all duration-[var(--motion-duration-fast)] hover:bg-muted active:scale-95"
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          className="p-1.5 rounded-md transition-all duration-[var(--motion-duration-fast)] hover:bg-muted active:scale-95"
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
          
          {/* Pagination */}
          <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              عرض {filteredOrders.length} من {mockOrders.length} طلب
            </p>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm border border-border rounded-md transition-all duration-[var(--motion-duration-fast)] hover:bg-muted active:scale-95 disabled:opacity-50" disabled>
                السابق
              </button>
              <button className="px-3 py-1.5 text-sm border border-border rounded-md transition-all duration-[var(--motion-duration-fast)] hover:bg-muted active:scale-95 disabled:opacity-50" disabled>
                التالي
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
