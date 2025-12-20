/**
 * Animation Variants
 * 
 * Pre-built animation patterns for common UI elements
 * Use with Framer Motion's variants prop
 */

import { Variants } from 'framer-motion';
import { duration, easing, stagger } from './tokens';

// ============================================
// FADE ANIMATIONS
// ============================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    y: -4,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    y: 4,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

// ============================================
// SCALE ANIMATIONS
// ============================================

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

export const scaleInCenter: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: duration.smooth, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

// ============================================
// SLIDE ANIMATIONS (RTL-safe)
// ============================================

export const slideInFromRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    x: 16,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

export const slideInFromLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    x: -16,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

// ============================================
// LIST/STAGGER ANIMATIONS
// ============================================

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger.normal,
      delayChildren: 0.05,
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: stagger.fast,
      staggerDirection: -1,
    }
  }
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    y: -4,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

// ============================================
// INTERACTIVE ELEMENTS
// ============================================

export const buttonPress: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 }
};

export const cardHover: Variants = {
  idle: { 
    y: 0, 
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
  },
  hover: { 
    y: -2, 
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    transition: { duration: duration.fast, ease: easing.out }
  }
};

export const linkHover: Variants = {
  idle: { opacity: 1 },
  hover: { opacity: 0.8 }
};

// ============================================
// MODAL/OVERLAY ANIMATIONS
// ============================================

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: duration.smooth, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    scale: 0.98, 
    y: 4,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

// ============================================
// DROPDOWN/POPOVER ANIMATIONS
// ============================================

export const dropdownMenu: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95, 
    y: -4,
  },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: duration.fast, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: -4,
    transition: { duration: duration.instant, ease: easing.in }
  }
};

export const dropdownItem: Variants = {
  hidden: { opacity: 0, x: -4 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: duration.fast, ease: easing.out }
  }
};

// ============================================
// SIDEBAR ANIMATIONS
// ============================================

export const sidebarExpand: Variants = {
  collapsed: { 
    width: 72,
    transition: { duration: duration.normal, ease: easing.inOut }
  },
  expanded: { 
    width: 256,
    transition: { duration: duration.normal, ease: easing.inOut }
  }
};

export const sidebarLabel: Variants = {
  collapsed: { 
    opacity: 0, 
    width: 0,
    transition: { duration: duration.fast, ease: easing.in }
  },
  expanded: { 
    opacity: 1, 
    width: 'auto',
    transition: { duration: duration.normal, ease: easing.out, delay: 0.05 }
  }
};

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: duration.normal, ease: easing.out }
  },
  exit: { 
    opacity: 0,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

export const pageSlide: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: duration.smooth, ease: easing.out }
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: { duration: duration.fast, ease: easing.in }
  }
};

// ============================================
// SKELETON/LOADING ANIMATIONS
// ============================================

export const skeletonPulse: Variants = {
  initial: { opacity: 0.4 },
  animate: { 
    opacity: [0.4, 0.7, 0.4],
    transition: { 
      duration: 1.5, 
      ease: easing.inOut, 
      repeat: Infinity 
    }
  }
};

// ============================================
// TABLE ROW ANIMATIONS
// ============================================

export const tableRow: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: (i: number) => ({ 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: duration.normal, 
      ease: easing.out,
      delay: i * stagger.fast
    }
  }),
  exit: { 
    opacity: 0,
    transition: { duration: duration.fast, ease: easing.in }
  }
};
