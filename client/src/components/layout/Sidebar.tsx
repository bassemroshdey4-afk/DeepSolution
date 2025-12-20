/**
 * Sidebar Navigation Component
 * 
 * Features:
 * - RTL/LTR aware positioning
 * - Collapsible mode
 * - Logical grouping (Operations / Marketing / Finance / Settings)
 * - Clear active state
 * - Subtle icons
 */

import { useLocation, Link } from 'wouter';
import { cn } from '@/lib/utils';
import { useLayout } from './AppShell';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Megaphone,
  FileText,
  Bot,
  CreditCard,
  Wallet,
  Zap,
  PenTool,
  GitBranch,
  Link2,
  TrendingUp,
  Boxes,
  ShoppingBag,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';

// Navigation structure with logical grouping
const navigationGroups = [
  {
    id: 'overview',
    label: 'نظرة عامة',
    items: [
      { id: 'dashboard', label: 'لوحة التحكم', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    id: 'operations',
    label: 'العمليات',
    items: [
      { id: 'products', label: 'المنتجات', href: '/products', icon: Package },
      { id: 'orders', label: 'الطلبات', href: '/orders', icon: ShoppingCart },
      { id: 'inventory', label: 'المخزون', href: '/inventory', icon: Boxes },
      { id: 'purchasing', label: 'المشتريات', href: '/purchasing', icon: ShoppingBag },
    ],
  },
  {
    id: 'marketing',
    label: 'التسويق',
    items: [
      { id: 'campaigns', label: 'الحملات', href: '/campaigns', icon: Megaphone },
      { id: 'landing-pages', label: 'صفحات الهبوط', href: '/landing-pages', icon: FileText },
      { id: 'ai-assistant', label: 'المساعد الذكي', href: '/ai-assistant', icon: Bot },
      { id: 'content-writer', label: 'كاتب المحتوى', href: '/content-writer', icon: PenTool },
      { id: 'ai-pipeline', label: 'خط أنابيب AI', href: '/ai-pipeline', icon: GitBranch },
    ],
  },
  {
    id: 'finance',
    label: 'المالية',
    items: [
      { id: 'wallet', label: 'المحفظة', href: '/wallet', icon: Wallet },
      { id: 'profit', label: 'تحليلات الربحية', href: '/profit', icon: TrendingUp },
      { id: 'audit-log', label: 'سجل المراجعة', href: '/audit-log', icon: ClipboardList },
    ],
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    items: [
      { id: 'payments', label: 'إعدادات الدفع', href: '/settings/payments', icon: CreditCard },
      { id: 'ai-addons', label: 'إضافات AI', href: '/ai-addons', icon: Zap },
      { id: 'integrations', label: 'التكاملات', href: '/integrations', icon: Link2 },
    ],
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed, sidebarOpen, setSidebarOpen } = useLayout();

  // Check if a path is active
  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    return location.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full bg-card border-l border-border z-50',
          'hidden lg:flex flex-col transition-all duration-200 ease-out',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-16 flex items-center border-b border-border px-4',
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        )}>
          {!sidebarCollapsed && (
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-ds-gradient flex items-center justify-center">
                <span className="text-white font-bold text-sm">DS</span>
              </div>
              <span className="font-semibold text-foreground">DeepSolution</span>
            </Link>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-ds-gradient flex items-center justify-center">
              <span className="text-white font-bold text-sm">DS</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navigationGroups.map((group) => (
            <div key={group.id} className="mb-4">
              {/* Group Label */}
              {!sidebarCollapsed && (
                <div className="px-4 mb-2">
                  <span className="ds-tiny text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
              )}

              {/* Group Items */}
              <ul className="space-y-1 px-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg transition-colors',
                          sidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2.5',
                          active
                            ? 'bg-ds-gradient-subtle text-ds-blue-600 font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon className={cn('flex-shrink-0', active ? 'text-ds-blue-600' : '')} size={20} />
                        {!sidebarCollapsed && (
                          <span className="ds-body-sm">{item.label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="border-t border-border p-2">
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
              sidebarCollapsed && 'justify-center'
            )}
          >
            {sidebarCollapsed ? (
              <ChevronLeft size={20} />
            ) : (
              <>
                <ChevronRight size={20} />
                <span className="ds-body-sm">طي القائمة</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full w-64 bg-card border-l border-border z-50',
          'lg:hidden flex flex-col transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
            <div className="w-8 h-8 rounded-lg bg-ds-gradient flex items-center justify-center">
              <span className="text-white font-bold text-sm">DS</span>
            </div>
            <span className="font-semibold text-foreground">DeepSolution</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navigationGroups.map((group) => (
            <div key={group.id} className="mb-4">
              <div className="px-4 mb-2">
                <span className="ds-tiny text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
              <ul className="space-y-1 px-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                          active
                            ? 'bg-ds-gradient-subtle text-ds-blue-600 font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Icon className={cn('flex-shrink-0', active ? 'text-ds-blue-600' : '')} size={20} />
                        <span className="ds-body-sm">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
