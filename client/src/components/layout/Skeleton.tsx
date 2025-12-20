/**
 * Skeleton Loading Components
 * 
 * Generic skeleton loaders for various content types:
 * - Text lines
 * - Cards
 * - Tables
 * - Stats
 */

import { cn } from '@/lib/utils';

// Base Skeleton
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    />
  );
}

// Text Line Skeleton
interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

// Card Skeleton
interface SkeletonCardProps {
  className?: string;
  showHeader?: boolean;
  showFooter?: boolean;
}

export function SkeletonCard({ className, showHeader = true, showFooter = false }: SkeletonCardProps) {
  return (
    <div className={cn('ds-card', className)}>
      {showHeader && (
        <div className="mb-4">
          <Skeleton className="h-5 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
      <SkeletonText lines={3} />
      {showFooter && (
        <div className="mt-4 pt-4 border-t border-border">
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </div>
  );
}

// Stat Card Skeleton
export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn('ds-card', className)}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

// Table Skeleton
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div className={cn('ds-card overflow-hidden p-0', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="py-3 px-4 text-right">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="py-3 px-4">
                  <Skeleton className={cn('h-4', colIndex === 0 ? 'w-16' : 'w-24')} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Page Skeleton (full page loading)
export function SkeletonPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Table */}
      <SkeletonTable />
    </div>
  );
}

// List Skeleton
interface SkeletonListProps {
  items?: number;
  className?: string;
}

export function SkeletonList({ items = 5, className }: SkeletonListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border">
          <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
