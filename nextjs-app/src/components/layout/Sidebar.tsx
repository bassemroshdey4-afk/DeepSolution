'use client';

/**
 * Sidebar Component
 * 
 * Main navigation sidebar with:
 * - Logical grouping (Operations / Marketing / Finance / Settings)
 * - RTL/LTR support
 * - Collapsible mode
 * - Active state indication
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Megaphone,
  FileText,
  Wallet,
  Settings,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Users,
  Boxes,
  ShoppingBag,
  Globe,
  Zap,
  PenTool,
  Link as LinkIcon,
  ClipboardList,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    title: 'العمليات',
    items: [
      { label: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
      { label: 'الطلبات', href: '/orders', icon: ShoppingCart },
      { label: 'المنتجات', href: '/products', icon: Package },
      { label: 'المخزون', href: '/inventory', icon: Boxes },
      { label: 'المشتريات', href: '/purchasing', icon: ShoppingBag },
      { label: 'الشحن', href: '/shipping', icon: Truck },
    ],
  },
  {
    title: 'التسويق',
    items: [
      { label: 'الحملات', href: '/campaigns', icon: Megaphone },
      { label: 'صفحات الهبوط', href: '/landing-pages', icon: Globe },
      { label: 'كاتب المحتوى', href: '/content-writer', icon: PenTool },
      { label: 'خط أنابيب AI', href: '/ai-pipeline', icon: Zap },
    ],
  },
  {
    title: 'المالية',
    items: [
      { label: 'المحفظة', href: '/wallet', icon: Wallet },
      { label: 'تحليلات الربحية', href: '/profit', icon: BarChart3 },
      { label: 'سجل المراجعة', href: '/audit-log', icon: ClipboardList },
    ],
  },
  {
    title: 'الإعدادات',
    items: [
      { label: 'التكاملات', href: '/integrations', icon: LinkIcon },
      { label: 'إعدادات الدفع', href: '/payment-settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'sidebar h-screen bg-card flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'h-16 flex items-center border-b border-border px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/ds-logo.png"
              alt="Deep Solution"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-semibold text-foreground">DeepSolution</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard">
            <Image
              src="/ds-logo.png"
              alt="DS"
              width={32}
              height={32}
              className="rounded-lg"
            />
          </Link>
        )}
        {onToggle && !collapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="طي القائمة"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navigation.map((group) => (
          <div key={group.title} className="mb-6">
            {!collapsed && (
              <h3 className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h3>
            )}
            <ul className="space-y-1 px-2">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                const Icon = item.icon;
                
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        collapsed && 'justify-center px-2'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle (Bottom) */}
      {onToggle && collapsed && (
        <div className="p-2 border-t border-border">
          <button
            onClick={onToggle}
            className="w-full p-2 rounded-md hover:bg-muted transition-colors flex items-center justify-center"
            aria-label="توسيع القائمة"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
