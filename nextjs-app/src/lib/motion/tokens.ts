/**
 * Motion System Tokens
 * 
 * SaaS-grade motion design inspired by Stripe, Linear, Vercel, Notion
 * 
 * Principles:
 * - Subtle: Never distracting
 * - Fast: 150-250ms duration
 * - Purpose-driven: Every animation has a reason
 * - Accessible: Respects prefers-reduced-motion
 */

// Duration tokens (in seconds for Framer Motion)
export const duration = {
  instant: 0.1,      // 100ms - micro-interactions
  fast: 0.15,        // 150ms - button press, hover
  normal: 0.2,       // 200ms - standard transitions
  smooth: 0.25,      // 250ms - page transitions, modals
  slow: 0.35,        // 350ms - complex animations (rare)
} as const;

// Duration in milliseconds (for CSS)
export const durationMs = {
  instant: 100,
  fast: 150,
  normal: 200,
  smooth: 250,
  slow: 350,
} as const;

// Easing curves - professional, subtle feel
export const easing = {
  // Standard ease - most common
  default: [0.4, 0, 0.2, 1],
  
  // Ease out - for entering elements
  out: [0, 0, 0.2, 1],
  
  // Ease in - for exiting elements
  in: [0.4, 0, 1, 1],
  
  // Ease in-out - for state changes
  inOut: [0.4, 0, 0.2, 1],
  
  // Spring-like - for playful interactions (use sparingly)
  spring: [0.34, 1.56, 0.64, 1],
  
  // Linear - for continuous animations
  linear: [0, 0, 1, 1],
} as const;

// CSS easing strings
export const easingCss = {
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  linear: 'linear',
} as const;

// Spring configurations for Framer Motion
export const spring = {
  // Snappy - quick response
  snappy: { type: 'spring', stiffness: 400, damping: 30 },
  
  // Gentle - smooth, professional
  gentle: { type: 'spring', stiffness: 300, damping: 25 },
  
  // Bouncy - playful (use rarely)
  bouncy: { type: 'spring', stiffness: 500, damping: 20 },
  
  // Slow - for dramatic reveals
  slow: { type: 'spring', stiffness: 200, damping: 30 },
} as const;

// Transition presets
export const transition = {
  // Fast hover/press
  fast: {
    duration: duration.fast,
    ease: easing.default,
  },
  
  // Standard transition
  normal: {
    duration: duration.normal,
    ease: easing.default,
  },
  
  // Smooth page/modal transition
  smooth: {
    duration: duration.smooth,
    ease: easing.out,
  },
  
  // Enter animation
  enter: {
    duration: duration.normal,
    ease: easing.out,
  },
  
  // Exit animation
  exit: {
    duration: duration.fast,
    ease: easing.in,
  },
} as const;

// Stagger configuration for lists
export const stagger = {
  // Fast stagger - for short lists
  fast: 0.03,
  
  // Normal stagger - for medium lists
  normal: 0.05,
  
  // Slow stagger - for emphasis
  slow: 0.08,
} as const;

// CSS custom properties for use in stylesheets
export const cssVariables = `
  --motion-duration-instant: ${durationMs.instant}ms;
  --motion-duration-fast: ${durationMs.fast}ms;
  --motion-duration-normal: ${durationMs.normal}ms;
  --motion-duration-smooth: ${durationMs.smooth}ms;
  --motion-duration-slow: ${durationMs.slow}ms;
  
  --motion-ease-default: ${easingCss.default};
  --motion-ease-out: ${easingCss.out};
  --motion-ease-in: ${easingCss.in};
  --motion-ease-in-out: ${easingCss.inOut};
  --motion-ease-spring: ${easingCss.spring};
`;

// Reduced motion check
export const prefersReducedMotion = 
  typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

// Get safe duration (respects reduced motion)
export function getSafeDuration(d: number): number {
  if (typeof window === 'undefined') return d;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : d;
}

// Get safe transition (respects reduced motion)
export function getSafeTransition(t: typeof transition.normal) {
  if (typeof window === 'undefined') return t;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { duration: 0, ease: t.ease };
  }
  return t;
}
