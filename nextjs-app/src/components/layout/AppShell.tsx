'use client';

/**
 * AppShell Component
 * 
 * Main application layout wrapper with:
 * - Sidebar navigation
 * - Topbar with breadcrumbs
 * - Content area
 * - RTL/LTR support
 * - Density modes (comfortable/dense)
 */

import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { Topbar, BreadcrumbItem } from './Topbar';
import { PageHeader } from './PageHeader';

type Density = 'comfortable' | 'dense';

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  title?: string;
  description?: string;
  headerActions?: ReactNode;
  density?: Density;
  user?: {
    name: string;
    email?: string;
    avatar?: string;
  } | null;
  onLogout?: () => void;
}

export function AppShell({
  children,
  breadcrumbs = [],
  title,
  description,
  headerActions,
  density = 'comfortable',
  user,
  onLogout,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-background flex"
      dir="rtl"
      data-density={density}
    >
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 lg:hidden">
            <Sidebar onToggle={() => setMobileMenuOpen(false)} />
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          breadcrumbs={breadcrumbs}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          onLogout={onLogout}
        />
        
        <main
          className={cn(
            'flex-1 overflow-auto',
            density === 'comfortable' ? 'p-6' : 'p-4'
          )}
        >
          <div className="max-w-7xl mx-auto">
            {title && (
              <PageHeader
                title={title}
                description={description}
                actions={headerActions}
              />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
