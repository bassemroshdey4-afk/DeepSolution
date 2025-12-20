/**
 * PageHeader Component
 * 
 * Consistent page header with:
 * - Title
 * - Description
 * - Action buttons
 * - Breadcrumb integration
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Page description */
  description?: string;
  /** Action buttons or elements */
  actions?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Use dense spacing */
  dense?: boolean;
}

export default function PageHeader({
  title,
  description,
  actions,
  className,
  dense = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
        dense ? 'mb-4' : 'mb-6',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="ds-page-title text-foreground truncate">{title}</h1>
        {description && (
          <p className="ds-body-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
