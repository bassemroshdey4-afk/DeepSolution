'use client';

// Force dynamic rendering to prevent prerendering errors with useContext
export const dynamic = 'force-dynamic';

/**
 * Dashboard Page
 * 
 * Main dashboard with:
 * - Stats overview
 * - Recent orders
 * - Quick actions
 * - Enterprise-grade UI polish
 * 
 * Arabic copy follows I18N_TONE_GUIDE.md
 */

import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
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
  Plus,
  BarChart3,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; isPositive: boolean };
  loading?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'info';
}

function StatCard({ title, value, icon: Icon, trend, loading, color = 'primary' }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-ds-blue-500/10 text-ds-blue-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    info: 'bg-info-100 text-info-600',
  };

  if (loading) {
    return (
      <div className="ds-card-stat animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-muted rounded-lg" />
          <div className="h-4 w-20 bg-muted rounded" />
        </div>
        <div className="h-8 w-24 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="ds-card-stat hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <div className="ds-stat-value">{value}</div>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          {trend.isPositive ? (
            <ArrowUp className="h-4 w-4 text-success-600" />
          ) : (
            <ArrowDown className="h-4 w-4 text-error-600" />
          )}
          <span className={trend.isPositive ? 'text-success-600 text-sm' : 'text-error-600 text-sm'}>
            {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground text-xs">من الشهر الماضي</span>
        </div>
      )}
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
  const statusConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    pending: { label: 'قيد الانتظار', icon: Clock, className: 'ds-badge-warning' },
    confirmed: { label: 'مؤكد', icon: CheckCircle, className: 'ds-badge-info' },
    shipped: { label: 'تم الشحن', icon: Truck, className: 'ds-badge-info' },
    delivered: { label: 'تم التسليم', icon: CheckCircle, className: 'ds-badge-success' },
    cancelled: { label: 'ملغي', icon: AlertCircle, className: 'ds-badge-error' },
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        preset="orders"
        action={
          <Link href="/orders/new" className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            إنشاء طلب جديد
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              رقم الطلب
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              العميل
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              المبلغ
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              الحالة
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-primary">{order.orderNumber}</span>
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{order.customerName}</td>
                <td className="py-3 px-4 text-sm font-medium">{order.total.toFixed(2)} ر.س</td>
                <td className="py-3 px-4">
                  <span className={cn(status.className, 'flex items-center gap-1 w-fit')}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QuickActionCard({ 
  href, 
  icon: Icon, 
  title, 
  description 
}: { 
  href: string; 
  icon: React.ComponentType<{ className?: string }>; 
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="ds-card-interactive flex flex-col items-center text-center py-6"
    >
      <div className="w-12 h-12 rounded-xl bg-ds-gradient flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <span className="text-sm font-medium mb-1">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  // SECURITY: Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login?redirect=/dashboard';
    }
  }, [authLoading, isAuthenticated]);

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Placeholder data - will be replaced with real API calls
  const stats = {
    products: 0,
    orders: 0,
    walletBalance: 0,
    netProfit: 0,
    profitGrowth: 0,
  };

  const recentOrders: RecentOrder[] = [];

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ر.س';
  };

  // SECURITY: Show loading while checking auth, or if not authenticated
  if (authLoading || !isAuthenticated) {
    return (
      <AppShell
        breadcrumbs={[{ label: 'لوحة التحكم' }]}
        title="لوحة التحكم"
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[{ label: 'لوحة التحكم' }]}
      title="لوحة التحكم"
      description={`نظرة عامة على أداء متجرك${user?.tenantName ? ` - ${user.tenantName}` : ''}`}
      user={user ? { name: user.name, email: user.email } : null}
      onLogout={logout}
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="إجمالي المنتجات"
          value={stats.products}
          icon={Package}
          loading={isLoading}
        />
        <StatCard
          title="إجمالي الطلبات"
          value={stats.orders}
          icon={ShoppingCart}
          loading={isLoading}
          color="info"
        />
        <StatCard
          title="رصيد المحفظة"
          value={formatCurrency(stats.walletBalance)}
          icon={Wallet}
          loading={isLoading}
          color="warning"
        />
        <StatCard
          title="صافي الربح (الشهر)"
          value={formatCurrency(stats.netProfit)}
          icon={TrendingUp}
          trend={
            stats.profitGrowth
              ? { value: stats.profitGrowth, isPositive: stats.profitGrowth > 0 }
              : undefined
          }
          loading={isLoading}
          color="success"
        />
      </div>

      {/* Recent Orders */}
      <div className="ds-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">الطلبات الأخيرة</h2>
          <Link 
            href="/orders" 
            className="text-sm text-primary hover:underline"
          >
            عرض الكل
          </Link>
        </div>
        <RecentOrdersTable orders={recentOrders} loading={isLoading} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">إجراءات سريعة</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <QuickActionCard
            href="/products/new"
            icon={Package}
            title="إضافة منتج"
            description="أضف منتج جديد للمتجر"
          />
          <QuickActionCard
            href="/orders/new"
            icon={ShoppingCart}
            title="إنشاء طلب"
            description="أنشئ طلب يدوي"
          />
          <QuickActionCard
            href="/ai-pipeline"
            icon={Zap}
            title="Deep Intelligence™"
            description="تحليل ذكي لمنتجاتك"
          />
          <QuickActionCard
            href="/profit"
            icon={BarChart3}
            title="تقارير الربحية"
            description="راجع أداءك المالي"
          />
        </div>
      </div>
    </AppShell>
  );
}
