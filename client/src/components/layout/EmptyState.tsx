/**
 * EmptyState Component
 * 
 * Displays when there's no data to show.
 * Following I18N_TONE_GUIDE.md for Arabic copy.
 * 
 * Features:
 * - Icon (optional)
 * - Title
 * - Description
 * - Action button (optional)
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Package,
  ShoppingCart,
  FileText,
  Users,
  Search,
  Inbox,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';

// Preset empty state types with Arabic copy
const presets = {
  products: {
    icon: Package,
    title: 'لا توجد منتجات بعد',
    description: 'أضف منتجك الأول لبدء البيع',
  },
  orders: {
    icon: ShoppingCart,
    title: 'لا توجد طلبات',
    description: 'ستظهر الطلبات هنا عند وصولها',
  },
  campaigns: {
    icon: FileText,
    title: 'لا توجد حملات',
    description: 'أنشئ حملتك الأولى للوصول لعملائك',
  },
  customers: {
    icon: Users,
    title: 'لا يوجد عملاء',
    description: 'سيظهر العملاء هنا بعد أول طلب',
  },
  search: {
    icon: Search,
    title: 'لا توجد نتائج',
    description: 'جرب كلمات بحث مختلفة',
  },
  inbox: {
    icon: Inbox,
    title: 'لا توجد رسائل',
    description: 'صندوق الوارد فارغ',
  },
  files: {
    icon: FolderOpen,
    title: 'لا توجد ملفات',
    description: 'ارفع ملفاتك هنا',
  },
  error: {
    icon: AlertCircle,
    title: 'حدث خطأ',
    description: 'تعذر تحميل البيانات، حاول مجدداً',
  },
  generic: {
    icon: Inbox,
    title: 'لا توجد بيانات',
    description: 'لا يوجد محتوى لعرضه حالياً',
  },
} as const;

type PresetType = keyof typeof presets;

interface EmptyStateProps {
  /** Use a preset configuration */
  preset?: PresetType;
  /** Custom icon component */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Action button or element */
  action?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode (smaller spacing) */
  compact?: boolean;
}

export default function EmptyState({
  preset = 'generic',
  icon: CustomIcon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const presetConfig = presets[preset];
  const Icon = CustomIcon || presetConfig.icon;
  const displayTitle = title || presetConfig.title;
  const displayDescription = description || presetConfig.description;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8' : 'py-16',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'rounded-full bg-muted flex items-center justify-center mb-4',
          compact ? 'w-12 h-12' : 'w-16 h-16'
        )}
      >
        <Icon
          size={compact ? 24 : 32}
          className="text-muted-foreground"
        />
      </div>

      {/* Title */}
      <h3
        className={cn(
          'text-foreground font-medium',
          compact ? 'ds-body-sm' : 'ds-subsection'
        )}
      >
        {displayTitle}
      </h3>

      {/* Description */}
      <p
        className={cn(
          'text-muted-foreground mt-1 max-w-sm',
          compact ? 'ds-small' : 'ds-body-sm'
        )}
      >
        {displayDescription}
      </p>

      {/* Action */}
      {action && (
        <div className={cn('mt-4', compact && 'mt-3')}>
          {action}
        </div>
      )}
    </div>
  );
}

// Export presets for reference
export { presets as emptyStatePresets };
export type { PresetType as EmptyStatePreset };
