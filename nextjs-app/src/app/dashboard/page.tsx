'use client';

export const dynamic = 'force-dynamic';

/**
 * Smart Dashboard v1
 * 
 * Adaptive Dashboard مبني على بيانات profiles و tenant_setup:
 * - Sections تظهر/تختفي حسب support_type و channels
 * - KPI Widgets ديناميكية
 * - Empty states ذكية
 * - Next Steps cards
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
  Bot,
  Users,
  MessageCircle,
  Instagram,
  Globe,
  Warehouse,
  Settings,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// Types
interface DashboardData {
  profile: {
    name: string | null;
    company_name: string | null;
    country: string | null;
    language: string | null;
    currency: string | null;
    monthly_order_volume: string | null;
    recommended_plan: string | null;
  };
  setup: {
    setup_completed: boolean;
    current_step: number;
    website_option: string | null;
    order_sources: string[];
    warehouse_count: number;
    support_mode: string | null;
    support_channels: string[];
    employee_count: number;
    employee_roles: string[];
  } | null;
  stats: {
    total_orders: number;
    pending_orders: number;
    total_products: number;
    low_stock_products: number;
    total_revenue: number;
    monthly_revenue: number;
  };
  features: {
    has_ai_bots: boolean;
    has_human_support: boolean;
    has_hybrid_support: boolean;
    has_whatsapp: boolean;
    has_instagram: boolean;
    has_website: boolean;
    has_multi_warehouse: boolean;
  };
  next_steps: {
    id: string;
    title: string;
    description: string;
    href: string;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
  }[];
}

// Components
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  loading, 
  color = 'primary',
  alert,
}: { 
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; isPositive: boolean };
  loading?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'error';
  alert?: string;
}) {
  const colorClasses = {
    primary: 'bg-ds-blue-500/10 text-ds-blue-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    info: 'bg-info-100 text-info-600',
    error: 'bg-error-100 text-error-600',
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
    <div className="ds-card-stat hover:border-primary/30 transition-colors relative">
      {alert && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-warning-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-3 h-3 text-white" />
        </div>
      )}
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
      {alert && (
        <p className="text-xs text-warning-600 mt-2">{alert}</p>
      )}
    </div>
  );
}

function NextStepCard({ 
  step, 
  index 
}: { 
  step: DashboardData['next_steps'][0];
  index: number;
}) {
  const priorityColors = {
    high: 'border-error-500/50 bg-error-50/50',
    medium: 'border-warning-500/50 bg-warning-50/50',
    low: 'border-info-500/50 bg-info-50/50',
  };

  const priorityLabels = {
    high: 'مهم جداً',
    medium: 'مهم',
    low: 'اختياري',
  };

  return (
    <Link
      href={step.href}
      className={cn(
        'block p-4 rounded-xl border-2 transition-all hover:scale-[1.02] hover:shadow-lg',
        priorityColors[step.priority]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/80">
              {priorityLabels[step.priority]}
            </span>
            <span className="text-xs text-muted-foreground">خطوة {index + 1}</span>
          </div>
          <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}

function FeatureStatusCard({
  title,
  description,
  icon: Icon,
  enabled,
  href,
  channels,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  href: string;
  channels?: string[];
}) {
  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all',
      enabled ? 'border-success-500/30 bg-success-50/30' : 'border-border bg-muted/30'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          enabled ? 'bg-success-100 text-success-600' : 'bg-muted text-muted-foreground'
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{title}</h4>
            {enabled ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-success-100 text-success-700">مفعّل</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">غير مفعّل</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">{description}</p>
          {channels && channels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {channels.map(ch => (
                <span key={ch} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {ch}
                </span>
              ))}
            </div>
          )}
          {!enabled && (
            <Link href={href} className="text-xs text-primary hover:underline mt-2 inline-block">
              تفعيل الآن ←
            </Link>
          )}
        </div>
      </div>
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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SECURITY: Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login?redirect=/dashboard';
    }
  }, [authLoading, isAuthenticated]);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const data = await res.json();
        setDashboardData(data);
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchDashboard();
    }
  }, [isAuthenticated]);

  // Format currency
  const formatCurrency = (amount: number) => {
    const currency = dashboardData?.profile?.currency || 'SAR';
    const currencySymbols: Record<string, string> = {
      SAR: 'ر.س',
      USD: '$',
      EUR: '€',
      EGP: 'ج.م',
      AED: 'د.إ',
    };
    return new Intl.NumberFormat('ar-SA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ' + (currencySymbols[currency] || currency);
  };

  // SECURITY: Show loading while checking auth
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

  const stats = dashboardData?.stats || {
    total_orders: 0,
    pending_orders: 0,
    total_products: 0,
    low_stock_products: 0,
    total_revenue: 0,
    monthly_revenue: 0,
  };

  const features = dashboardData?.features || {
    has_ai_bots: false,
    has_human_support: false,
    has_hybrid_support: false,
    has_whatsapp: false,
    has_instagram: false,
    has_website: false,
    has_multi_warehouse: false,
  };

  const next_steps = dashboardData?.next_steps || [];
  const setup = dashboardData?.setup;
  const profile = dashboardData?.profile;

  return (
    <AppShell
      breadcrumbs={[{ label: 'لوحة التحكم' }]}
      title="لوحة التحكم"
      description={`مرحباً ${profile?.name || user?.name || ''}${profile?.company_name ? ` - ${profile.company_name}` : ''}`}
      user={user ? { name: user.name, email: user.email } : null}
      onLogout={logout}
    >
      {/* Next Steps - Show if there are pending steps */}
      {next_steps.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">الخطوات التالية</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {next_steps.length} خطوات
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {next_steps.slice(0, 3).map((step, index) => (
              <NextStepCard key={step.id} step={step} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="إجمالي المنتجات"
          value={stats.total_products}
          icon={Package}
          loading={isLoading}
        />
        <StatCard
          title="إجمالي الطلبات"
          value={stats.total_orders}
          icon={ShoppingCart}
          loading={isLoading}
          color="info"
          alert={stats.pending_orders > 0 ? `${stats.pending_orders} طلبات معلقة` : undefined}
        />
        <StatCard
          title="الإيرادات (الشهر)"
          value={formatCurrency(stats.monthly_revenue)}
          icon={TrendingUp}
          loading={isLoading}
          color="success"
        />
        <StatCard
          title="المخزون المنخفض"
          value={stats.low_stock_products}
          icon={Warehouse}
          loading={isLoading}
          color={stats.low_stock_products > 0 ? 'warning' : 'primary'}
          alert={stats.low_stock_products > 5 ? 'يحتاج تحديث عاجل' : undefined}
        />
      </div>

      {/* Feature Status Section - Based on setup choices */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">حالة الميزات</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Support Mode */}
          <FeatureStatusCard
            title="خدمة العملاء"
            description={
              features.has_hybrid_support 
                ? 'دعم مختلط (AI + بشري)' 
                : features.has_ai_bots 
                  ? 'دعم آلي بالذكاء الاصطناعي'
                  : features.has_human_support
                    ? 'دعم بشري'
                    : 'غير محدد'
            }
            icon={features.has_ai_bots ? Bot : Users}
            enabled={features.has_ai_bots || features.has_human_support}
            href="/settings"
            channels={setup?.support_channels}
          />

          {/* Channels */}
          <FeatureStatusCard
            title="قنوات التواصل"
            description={
              [
                features.has_whatsapp && 'واتساب',
                features.has_instagram && 'انستجرام',
                features.has_website && 'الموقع',
              ].filter(Boolean).join(' • ') || 'لم يتم تفعيل قنوات'
            }
            icon={MessageCircle}
            enabled={features.has_whatsapp || features.has_instagram || features.has_website}
            href="/integrations"
          />

          {/* Multi-warehouse */}
          <FeatureStatusCard
            title="إدارة المخازن"
            description={
              features.has_multi_warehouse 
                ? `${setup?.warehouse_count || 1} مخازن` 
                : 'مخزن واحد'
            }
            icon={Warehouse}
            enabled={features.has_multi_warehouse}
            href="/inventory"
          />
        </div>
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

      {/* Empty State for new users */}
      {stats.total_products === 0 && stats.total_orders === 0 && setup?.setup_completed && (
        <div className="mt-8">
          <EmptyState
            preset="products"
            title="ابدأ رحلتك التجارية"
            description="أضف منتجاتك الأولى لبدء استقبال الطلبات وتتبع أدائك"
            action={
              <Link href="/products/new" className="ds-btn-primary px-6 py-3 rounded-lg inline-flex items-center gap-2">
                <Plus className="h-5 w-5" />
                إضافة أول منتج
              </Link>
            }
          />
        </div>
      )}

      {/* Production Proof: Build ID */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-800">
        <p className="text-xs text-gray-400 text-center">
          Build: {process.env.NEXT_PUBLIC_BUILD_ID || 'dev-local'} | 
          Version: v5-prod-2026-02-02
        </p>
      </div>
    </AppShell>
  );
}
