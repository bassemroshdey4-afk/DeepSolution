'use client';

import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; isPositive: boolean };
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, trend, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
          <div className="w-12 h-12 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.isPositive ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
              <span
                className={trend.isPositive ? 'text-green-500' : 'text-red-500'}
              >
                {Math.abs(trend.value)}%
              </span>
              <span className="text-muted-foreground text-sm">من الشهر الماضي</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  );
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

function RecentOrdersTable({ orders, loading }: { orders: RecentOrder[]; loading: boolean }) {
  const statusConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
    pending: { label: 'قيد الانتظار', icon: Clock, color: 'text-yellow-500' },
    confirmed: { label: 'مؤكد', icon: CheckCircle, color: 'text-blue-500' },
    shipped: { label: 'تم الشحن', icon: Truck, color: 'text-purple-500' },
    delivered: { label: 'تم التسليم', icon: CheckCircle, color: 'text-green-500' },
    cancelled: { label: 'ملغي', icon: AlertCircle, color: 'text-red-500' },
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>لا توجد طلبات حتى الآن</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
              رقم الطلب
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
              العميل
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
              المبلغ
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
              الحالة
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                <td className="py-3 px-4 font-medium">{order.orderNumber}</td>
                <td className="py-3 px-4 text-muted-foreground">{order.customerName}</td>
                <td className="py-3 px-4">{order.total.toFixed(2)} ر.س</td>
                <td className="py-3 px-4">
                  <div className={`flex items-center gap-2 ${status.color}`}>
                    <StatusIcon className="h-4 w-4" />
                    <span className="text-sm">{status.label}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  // Fetch dashboard stats using existing backend APIs
  const { data: stats, isLoading: statsLoading } = trpc.products.list.useQuery(
    { page: 1, limit: 1 },
    { enabled: !!user?.tenantId }
  );

  const { data: orders, isLoading: ordersLoading } = trpc.orders.list.useQuery(
    { page: 1, limit: 5 },
    { enabled: !!user?.tenantId }
  );

  const { data: walletData, isLoading: walletLoading } = trpc.wallet.getBalance.useQuery(
    undefined,
    { enabled: !!user?.tenantId }
  );

  const { data: profitData, isLoading: profitLoading } = trpc.profit.getSummary.useQuery(
    { period: 'month' },
    { enabled: !!user?.tenantId }
  );

  const isLoading = statsLoading || ordersLoading || walletLoading || profitLoading;

  // Transform orders data for display
  const recentOrders: RecentOrder[] = (orders?.items || []).map((order: any) => ({
    id: order.id,
    orderNumber: order.orderNumber || `#${order.id.slice(0, 8)}`,
    customerName: order.customerName || 'عميل',
    total: order.total || 0,
    status: order.status || 'pending',
    createdAt: order.createdAt,
  }));

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">لوحة التحكم</h1>
        <p className="text-muted-foreground">
          نظرة عامة على أداء متجرك
          {user?.tenantName && ` - ${user.tenantName}`}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="إجمالي المنتجات"
          value={stats?.total || 0}
          icon={Package}
          loading={isLoading}
        />
        <StatCard
          title="إجمالي الطلبات"
          value={orders?.total || 0}
          icon={ShoppingCart}
          loading={isLoading}
        />
        <StatCard
          title="رصيد المحفظة"
          value={`${(walletData?.balance || 0).toFixed(2)} ر.س`}
          icon={Wallet}
          loading={isLoading}
        />
        <StatCard
          title="صافي الربح (الشهر)"
          value={`${(profitData?.netProfit || 0).toFixed(2)} ر.س`}
          icon={TrendingUp}
          trend={
            profitData?.growth
              ? { value: profitData.growth, isPositive: profitData.growth > 0 }
              : undefined
          }
          loading={isLoading}
        />
      </div>

      {/* Recent Orders */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">الطلبات الأخيرة</h2>
        </div>
        <div className="p-6">
          <RecentOrdersTable orders={recentOrders} loading={isLoading} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href="/dashboard/products"
          className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-center"
        >
          <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
          <span className="text-sm font-medium">إضافة منتج</span>
        </a>
        <a
          href="/dashboard/orders"
          className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-center"
        >
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-primary" />
          <span className="text-sm font-medium">إنشاء طلب</span>
        </a>
        <a
          href="/dashboard/shipping"
          className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-center"
        >
          <Truck className="h-8 w-8 mx-auto mb-2 text-primary" />
          <span className="text-sm font-medium">تتبع الشحنات</span>
        </a>
        <a
          href="/dashboard/profit"
          className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-center"
        >
          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
          <span className="text-sm font-medium">تقارير الربحية</span>
        </a>
      </div>
    </div>
  );
}
