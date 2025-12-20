/**
 * Topbar Navigation Component
 * 
 * Features:
 * - Breadcrumb navigation
 * - Mobile menu toggle
 * - User menu
 * - Search (placeholder)
 */

import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { useLayout } from './AppShell';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Menu,
  Search,
  Bell,
  ChevronLeft,
  User,
  LogOut,
  Settings,
  HelpCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { trpc } from '@/lib/trpc';

interface TopbarProps {
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function Topbar({ breadcrumbs }: TopbarProps) {
  const { setSidebarOpen, density } = useLayout();
  const { user, logout } = useAuth();

  // Density-based sizing
  const height = density === 'comfortable' ? 'h-16' : 'h-14';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'border-b border-border',
        height
      )}
    >
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Right Side: Mobile Menu + Breadcrumb */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb items={breadcrumbs} />
          )}
        </div>

        {/* Left Side: Search + Notifications + User */}
        <div className="flex items-center gap-2">
          {/* Search (placeholder) */}
          <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hidden sm:flex">
            <Search size={20} />
          </button>

          {/* Notifications */}
          <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground relative">
            <Bell size={20} />
            {/* Notification badge */}
            <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-ds-blue-500 rounded-full" />
          </button>

          {/* User Menu */}
          <UserMenu user={user} onLogout={logout} />
        </div>
      </div>
    </header>
  );
}

// Breadcrumb Component
interface BreadcrumbProps {
  items: Array<{ label: string; href?: string }>;
}

function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <ChevronLeft size={16} className="text-muted-foreground" />
          )}
          {item.href && index < items.length - 1 ? (
            <Link
              href={item.href}
              className="ds-body-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn(
              'ds-body-sm',
              index === items.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

// User Menu Component
interface UserMenuProps {
  user: { name?: string | null; email?: string | null; avatar?: string | null } | null;
  onLogout: () => void;
}

function UserMenu({ user, onLogout }: UserMenuProps) {
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      onLogout();
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors">
          <div className="w-8 h-8 rounded-full bg-ds-gradient-subtle flex items-center justify-center">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User'}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User size={18} className="text-ds-blue-600" />
            )}
          </div>
          <span className="ds-body-sm text-foreground hidden md:block max-w-[120px] truncate">
            {user?.name || 'المستخدم'}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {user && (
          <>
            <div className="px-3 py-2">
              <p className="ds-body-sm font-medium text-foreground">{user.name}</p>
              <p className="ds-tiny text-muted-foreground truncate">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
            <Settings size={16} />
            <span>الإعدادات</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help" className="flex items-center gap-2 cursor-pointer">
            <HelpCircle size={16} />
            <span>المساعدة</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 focus:text-red-600 cursor-pointer"
        >
          <LogOut size={16} className="ml-2" />
          <span>تسجيل الخروج</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Export Breadcrumb for standalone use
export { Breadcrumb };
