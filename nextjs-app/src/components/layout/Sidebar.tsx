'use client';

/**
 * Sidebar Component
 * 
 * Main navigation sidebar with:
 * - Logical grouping (Operations / Marketing / Finance / Settings)
 * - RTL/LTR support
 * - Collapsible mode with smooth animation
 * - Active state indication
 * - Motion System integration
 */

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
  Wallet,
  Settings,
  ChevronRight,
  ChevronLeft,
  BarChart3,
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
      { label: 'Deep Intelligence™', href: '/ai-pipeline', icon: Zap },
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
        'sidebar h-screen bg-card flex flex-col',
        // Motion: smooth width transition
        'transition-[width] duration-[var(--motion-duration-normal)] ease-[var(--motion-ease-in-out)]',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo Header */}
      <div className={cn(
        'h-16 flex items-center border-b border-border',
        // Consistent padding
        collapsed ? 'px-3 justify-center' : 'px-4 justify-between'
      )}>
        <Link 
          href="/dashboard" 
          className={cn(
            'flex items-center gap-3',
            // Motion: hover feedback
            'transition-opacity duration-[var(--motion-duration-fast)] hover:opacity-80'
          )}
        >
          <Image
            src="/ds-logo.png"
            alt="Deep Solution"
            width={36}
            height={36}
            className="rounded-lg flex-shrink-0"
          />
          {/* Brand text with fade transition */}
          <span 
            className={cn(
              'font-semibold text-foreground whitespace-nowrap',
              'transition-[opacity,width] duration-[var(--motion-duration-normal)] ease-[var(--motion-ease-in-out)]',
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            )}
          >
            DeepSolution
          </span>
        </Link>
        
        {/* Toggle button - only show when expanded */}
        {onToggle && !collapsed && (
          <button
            onClick={onToggle}
            className={cn(
              'p-1.5 rounded-md text-muted-foreground',
              // Motion: hover & press feedback
              'transition-all duration-[var(--motion-duration-fast)]',
              'hover:bg-muted hover:text-foreground',
              'active:scale-95'
            )}
            aria-label="طي القائمة"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navigation.map((group, groupIndex) => (
          <div 
            key={group.title} 
            className={cn(
              'mb-6',
              // Stagger animation for groups
              'animate-fade-in-up',
              groupIndex === 0 && 'stagger-1',
              groupIndex === 1 && 'stagger-2',
              groupIndex === 2 && 'stagger-3',
              groupIndex === 3 && 'stagger-4'
            )}
          >
            {/* Group title with fade */}
            <h3 
              className={cn(
                'px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                'transition-[opacity,height] duration-[var(--motion-duration-normal)]',
                collapsed ? 'opacity-0 h-0 overflow-hidden mb-0' : 'opacity-100 h-auto'
              )}
            >
              {group.title}
            </h3>
            
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                const Icon = item.icon;
                
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm',
                        // Motion: smooth transitions
                        'transition-all duration-[var(--motion-duration-fast)]',
                        // Active state
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        // Press feedback
                        'active:scale-[0.98]',
                        // Collapsed mode
                        collapsed && 'justify-center px-2'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon 
                        className={cn(
                          'h-5 w-5 flex-shrink-0',
                          'transition-colors duration-[var(--motion-duration-fast)]',
                          isActive && 'text-primary'
                        )} 
                      />
                      {/* Label with fade */}
                      <span 
                        className={cn(
                          'transition-[opacity,width] duration-[var(--motion-duration-normal)]',
                          collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle (Bottom) - only show when collapsed */}
      {onToggle && collapsed && (
        <div className="p-2 border-t border-border">
          <button
            onClick={onToggle}
            className={cn(
              'w-full p-2.5 rounded-md flex items-center justify-center',
              'text-muted-foreground',
              // Motion: hover & press feedback
              'transition-all duration-[var(--motion-duration-fast)]',
              'hover:bg-muted hover:text-foreground',
              'active:scale-95'
            )}
            aria-label="توسيع القائمة"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
