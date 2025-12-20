/**
 * AppShell - Main Application Layout
 * 
 * The core layout wrapper that provides:
 * - Sidebar navigation (collapsible, RTL-aware)
 * - Top navigation bar
 * - Content area with proper spacing
 * - Density mode support (comfortable/dense)
 */

import { useState, createContext, useContext, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// Layout Context for density and sidebar state
interface LayoutContextType {
  density: 'comfortable' | 'dense';
  setDensity: (density: 'comfortable' | 'dense') => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarOpen: boolean; // For mobile
  setSidebarOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within AppShell');
  }
  return context;
}

interface AppShellProps {
  children: ReactNode;
  /** Page title shown in header */
  title?: string;
  /** Page description shown below title */
  description?: string;
  /** Actions to show in page header (buttons, etc.) */
  headerActions?: ReactNode;
  /** Breadcrumb items */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  /** Hide the page header */
  hideHeader?: boolean;
  /** Full width content (no max-width constraint) */
  fullWidth?: boolean;
}

export default function AppShell({
  children,
  title,
  description,
  headerActions,
  breadcrumbs,
  hideHeader = false,
  fullWidth = false,
}: AppShellProps) {
  const [density, setDensity] = useState<'comfortable' | 'dense'>('comfortable');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Density-based spacing
  const contentPadding = density === 'comfortable' ? 'p-6' : 'p-4';
  const headerSpacing = density === 'comfortable' ? 'mb-6' : 'mb-4';

  return (
    <LayoutContext.Provider
      value={{
        density,
        setDensity,
        sidebarCollapsed,
        setSidebarCollapsed,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      <div className="min-h-screen bg-background" dir="rtl">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div
          className={cn(
            'transition-all duration-200 ease-out',
            sidebarCollapsed ? 'mr-16' : 'mr-64',
            'lg:mr-64', // Always expanded on large screens
            sidebarCollapsed && 'lg:mr-16'
          )}
        >
          {/* Top Navigation */}
          <Topbar breadcrumbs={breadcrumbs} />

          {/* Page Content */}
          <main className={cn(contentPadding, 'min-h-[calc(100vh-4rem)]')}>
            <div className={cn(!fullWidth && 'max-w-7xl mx-auto')}>
              {/* Page Header */}
              {!hideHeader && (title || description || headerActions) && (
                <header className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4', headerSpacing)}>
                  <div>
                    {title && (
                      <h1 className="ds-page-title text-foreground">{title}</h1>
                    )}
                    {description && (
                      <p className="ds-body-sm text-muted-foreground mt-1">{description}</p>
                    )}
                  </div>
                  {headerActions && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {headerActions}
                    </div>
                  )}
                </header>
              )}

              {/* Main Content */}
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </LayoutContext.Provider>
  );
}

// Re-export for convenience
export { LayoutContext };
