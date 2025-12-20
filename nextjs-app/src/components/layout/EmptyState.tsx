'use client';

/**
 * EmptyState Component
 * 
 * Displays empty state with:
 * - Icon
 * - Title
 * - Description
 * - Optional action
 * 
 * Arabic copy follows I18N_TONE_GUIDE.md
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Package,
  ShoppingCart,
  Search,
  AlertCircle,
  FileText,
  Users,
  Truck,
  BarChart3,
} from 'lucide-react';

type EmptyStatePreset = 
  | 'products'
  | 'orders'
  | 'search'
  | 'error'
  | 'documents'
  | 'customers'
  | 'shipping'
  | 'analytics';

interface PresetConfig {
  icon: React.ElementType;
  title: string;
  description: string;
}

const presets: Record<EmptyStatePreset, PresetConfig> = {
  products: {
    icon: Package,
    title: 'لا توجد منتجات',
    description: 'أضف منتجك الأول لبدء البيع',
  },
  orders: {
    icon: ShoppingCart,
    title: 'لا توجد طلبات',
    description: 'ستظهر الطلبات هنا عند استلامها',
  },
  search: {
    icon: Search,
    title: 'لا توجد نتائج',
    description: 'جرّب كلمات بحث مختلفة',
  },
  error: {
    icon: AlertCircle,
    title: 'حدث خطأ',
    description: 'لم نتمكن من تحميل البيانات. حاول مرة أخرى.',
  },
  documents: {
    icon: FileText,
    title: 'لا توجد مستندات',
    description: 'ارفع مستندك الأول للبدء',
  },
  customers: {
    icon: Users,
    title: 'لا يوجد عملاء',
    description: 'سيظهر العملاء هنا بعد أول طلب',
  },
  shipping: {
    icon: Truck,
    title: 'لا توجد شحنات',
    description: 'ستظهر الشحنات هنا عند إنشائها',
  },
  analytics: {
    icon: BarChart3,
    title: 'لا توجد بيانات',
    description: 'ستظهر التحليلات بعد تسجيل النشاط',
  },
};

interface EmptyStateProps {
  preset?: EmptyStatePreset;
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  preset,
  icon: CustomIcon,
  title: customTitle,
  description: customDescription,
  action,
  className,
}: EmptyStateProps) {
  const config = preset ? presets[preset] : null;
  const Icon = CustomIcon || config?.icon || Package;
  const title = customTitle || config?.title || 'لا توجد بيانات';
  const description = customDescription || config?.description || '';

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="ds-subsection mb-2">{title}</h3>
      {description && (
        <p className="ds-body-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
