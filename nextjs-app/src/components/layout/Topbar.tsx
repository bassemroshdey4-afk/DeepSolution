'use client';

/**
 * Topbar Component
 * 
 * Top navigation bar with:
 * - Breadcrumb navigation
 * - User menu
 * - Notifications
 * - Search (optional)
 */

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Bell,
  Search,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
} from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopbarProps {
  breadcrumbs?: BreadcrumbItem[];
  onMenuClick?: () => void;
  user?: {
    name: string;
    email?: string;
    avatar?: string;
  } | null;
  onLogout?: () => void;
}

export function Topbar({ breadcrumbs = [], onMenuClick, user, onLogout }: TopbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
      {/* Left: Menu button (mobile) + Breadcrumbs */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="القائمة"
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="hidden sm:block">
          <ol className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((item, index) => (
              <li key={index} className="flex items-center gap-2">
                {index > 0 && (
                  <span className="text-muted-foreground">/</span>
                )}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Right: Search + Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          className="p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="بحث"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Notifications */}
        <button
          className="p-2 rounded-md hover:bg-muted transition-colors relative"
          aria-label="الإشعارات"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {/* Notification badge */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-error-500 rounded-full" />
        </button>

        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-ds-gradient flex items-center justify-center">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full" />
                ) : (
                  <User className="h-4 w-4 text-white" />
                )}
              </div>
              <span className="hidden md:block text-sm font-medium">{user.name}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute left-0 rtl:left-auto rtl:right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium">{user.name}</p>
                    {user.email && (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span>الإعدادات</span>
                  </Link>
                  {onLogout && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted transition-colors text-error-600"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Topbar;
