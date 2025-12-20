'use client';

/**
 * Motion Components
 * 
 * Reusable animated components for consistent motion across the app
 */

import { ReactNode, forwardRef } from 'react';
import { motion, AnimatePresence, HTMLMotionProps, MotionProps } from 'framer-motion';
import { 
  fadeIn, 
  fadeInUp, 
  scaleIn, 
  staggerContainer, 
  staggerItem,
  modalOverlay,
  modalContent,
  dropdownMenu,
  pageTransition,
  buttonPress,
  cardHover,
  tableRow,
} from './variants';
import { duration, easing, transition } from './tokens';
import { cn } from '@/lib/utils';

// ============================================
// MOTION WRAPPER - Base component
// ============================================

interface MotionWrapperProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
}

export const MotionDiv = motion.div;
export const MotionSpan = motion.span;
export const MotionUl = motion.ul;
export const MotionLi = motion.li;

// ============================================
// FADE IN - Simple fade animation
// ============================================

interface FadeInProps extends MotionWrapperProps {
  delay?: number;
  direction?: 'up' | 'down' | 'none';
}

export function FadeIn({ 
  children, 
  className, 
  delay = 0, 
  direction = 'up',
  ...props 
}: FadeInProps) {
  const variants = direction === 'up' ? fadeInUp : direction === 'down' ? fadeIn : fadeIn;
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// STAGGER LIST - Animated list with staggered children
// ============================================

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  as?: 'ul' | 'ol' | 'div';
}

export function StaggerList({ children, className, as = 'div' }: StaggerListProps) {
  const Component = as === 'ul' ? motion.ul : as === 'ol' ? motion.ol : motion.div;
  
  return (
    <Component
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </Component>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  as?: 'li' | 'div';
}

export function StaggerItem({ children, className, as = 'div' }: StaggerItemProps) {
  const Component = as === 'li' ? motion.li : motion.div;
  
  return (
    <Component
      variants={staggerItem}
      className={className}
    >
      {children}
    </Component>
  );
}

// ============================================
// MOTION BUTTON - Interactive button with press feedback
// ============================================

interface MotionButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ children, className, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        initial="idle"
        whileHover={disabled ? undefined : "hover"}
        whileTap={disabled ? undefined : "tap"}
        variants={buttonPress}
        transition={transition.fast}
        className={className}
        disabled={disabled}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
MotionButton.displayName = 'MotionButton';

// ============================================
// MOTION CARD - Card with hover lift effect
// ============================================

interface MotionCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export function MotionCard({ 
  children, 
  className, 
  interactive = true,
  ...props 
}: MotionCardProps) {
  return (
    <motion.div
      initial="idle"
      whileHover={interactive ? "hover" : undefined}
      variants={cardHover}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// PAGE TRANSITION - Wrap page content
// ============================================

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// MODAL - Animated modal with overlay
// ============================================

interface MotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
}

export function MotionModal({ 
  isOpen, 
  onClose, 
  children, 
  className,
  overlayClassName 
}: MotionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalOverlay}
            onClick={onClose}
            className={cn(
              "fixed inset-0 bg-black/50 z-50",
              overlayClassName
            )}
          />
          
          {/* Content */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalContent}
            className={cn(
              "fixed inset-0 z-50 flex items-center justify-center p-4",
              className
            )}
          >
            <div onClick={(e) => e.stopPropagation()}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// DROPDOWN - Animated dropdown menu
// ============================================

interface MotionDropdownProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

export function MotionDropdown({ isOpen, children, className }: MotionDropdownProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={dropdownMenu}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// TABLE ROW - Animated table rows
// ============================================

interface MotionTableRowProps extends HTMLMotionProps<'tr'> {
  children: ReactNode;
  className?: string;
  index?: number;
}

export function MotionTableRow({ 
  children, 
  className, 
  index = 0,
  ...props 
}: MotionTableRowProps) {
  return (
    <motion.tr
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      variants={tableRow}
      className={className}
      {...props}
    >
      {children}
    </motion.tr>
  );
}

// ============================================
// PRESENCE - AnimatePresence wrapper
// ============================================

interface PresenceProps {
  children: ReactNode;
  mode?: 'sync' | 'wait' | 'popLayout';
}

export function Presence({ children, mode = 'wait' }: PresenceProps) {
  return (
    <AnimatePresence mode={mode}>
      {children}
    </AnimatePresence>
  );
}

// ============================================
// SCALE IN - Scale animation for modals/popovers
// ============================================

interface ScaleInProps extends MotionWrapperProps {
  delay?: number;
}

export function ScaleIn({ children, className, delay = 0, ...props }: ScaleInProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={scaleIn}
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// HOVER SCALE - Simple hover scale effect
// ============================================

interface HoverScaleProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function HoverScale({ 
  children, 
  className, 
  scale = 1.02,
  ...props 
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={transition.fast}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// COLLAPSE - Height animation for accordions
// ============================================

interface CollapseProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

export function Collapse({ isOpen, children, className }: CollapseProps) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ 
            height: 'auto', 
            opacity: 1,
            transition: { 
              height: { duration: duration.normal, ease: easing.out },
              opacity: { duration: duration.fast, ease: easing.out, delay: 0.05 }
            }
          }}
          exit={{ 
            height: 0, 
            opacity: 0,
            transition: { 
              height: { duration: duration.fast, ease: easing.in },
              opacity: { duration: duration.instant, ease: easing.in }
            }
          }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
