# Motion System

نظام حركة احترافي على مستوى SaaS مستوحى من Stripe و Linear و Vercel و Notion.

## المبادئ الأساسية

| المبدأ | الوصف |
|--------|-------|
| **Subtle** | الحركة غير ملفتة للانتباه |
| **Fast** | مدة 150-250ms |
| **Purpose-driven** | كل حركة لها سبب |
| **Accessible** | تحترم prefers-reduced-motion |

## Motion Tokens

### Duration (المدة)

```css
--motion-duration-instant: 100ms;  /* micro-interactions */
--motion-duration-fast: 150ms;     /* hover, press */
--motion-duration-normal: 200ms;   /* standard transitions */
--motion-duration-smooth: 250ms;   /* page transitions, modals */
--motion-duration-slow: 350ms;     /* complex animations (rare) */
```

### Easing (منحنيات التسارع)

```css
--motion-ease-default: cubic-bezier(0.4, 0, 0.2, 1);  /* most common */
--motion-ease-out: cubic-bezier(0, 0, 0.2, 1);        /* entering elements */
--motion-ease-in: cubic-bezier(0.4, 0, 1, 1);         /* exiting elements */
--motion-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);   /* state changes */
```

## CSS Classes

### Transition Classes

```html
<!-- Fast transition (150ms) -->
<div class="transition-fast">...</div>

<!-- Normal transition (200ms) -->
<div class="transition-normal">...</div>

<!-- Smooth transition (250ms) -->
<div class="transition-smooth">...</div>
```

### Interactive Effects

```html
<!-- Hover lift effect -->
<div class="hover-lift">Card with lift on hover</div>

<!-- Press scale effect -->
<button class="press-scale">Button with press feedback</button>
```

### Animation Classes

```html
<!-- Fade animations -->
<div class="animate-fade-in">...</div>
<div class="animate-fade-in-up">...</div>
<div class="animate-fade-in-down">...</div>

<!-- Scale animation -->
<div class="animate-scale-in">...</div>

<!-- Slide animations -->
<div class="animate-slide-in-right">...</div>
<div class="animate-slide-in-left">...</div>
```

### Stagger Delays

```html
<!-- Staggered list items -->
<div class="animate-fade-in-up stagger-1">Item 1</div>
<div class="animate-fade-in-up stagger-2">Item 2</div>
<div class="animate-fade-in-up stagger-3">Item 3</div>
<div class="animate-fade-in-up stagger-4">Item 4</div>
<div class="animate-fade-in-up stagger-5">Item 5</div>
```

## Framer Motion Components

الملفات موجودة في `/src/lib/motion/`:

### tokens.ts
قيم الـ duration و easing و spring configurations.

### variants.ts
أنماط جاهزة للاستخدام مع Framer Motion:
- `fadeIn`, `fadeInUp`, `fadeInDown`
- `scaleIn`, `scaleInCenter`
- `slideInFromRight`, `slideInFromLeft`
- `staggerContainer`, `staggerItem`
- `buttonPress`, `cardHover`
- `modalOverlay`, `modalContent`
- `dropdownMenu`, `dropdownItem`
- `sidebarExpand`, `sidebarLabel`
- `pageTransition`, `pageSlide`
- `tableRow`

### components.tsx
مكونات جاهزة للاستخدام:
- `FadeIn` - fade animation wrapper
- `StaggerList`, `StaggerItem` - animated lists
- `MotionButton` - button with press feedback
- `MotionCard` - card with hover lift
- `PageTransition` - page wrapper
- `MotionModal` - animated modal
- `MotionDropdown` - animated dropdown
- `MotionTableRow` - animated table row
- `Collapse` - height animation
- `HoverScale` - hover scale effect

## الاستخدام

### CSS فقط (مفضل للحالات البسيطة)

```tsx
// Button with press feedback
<button className="transition-fast hover:bg-muted active:scale-95">
  Click me
</button>

// Card with hover lift
<div className="ds-card hover-lift">
  Card content
</div>

// Animated list
<div className="animate-fade-in-up stagger-1">Item 1</div>
<div className="animate-fade-in-up stagger-2">Item 2</div>
```

### Framer Motion (للحالات المعقدة)

```tsx
import { FadeIn, StaggerList, StaggerItem, MotionModal } from '@/lib/motion';

// Fade in content
<FadeIn direction="up">
  <h1>Welcome</h1>
</FadeIn>

// Staggered list
<StaggerList>
  {items.map(item => (
    <StaggerItem key={item.id}>
      {item.name}
    </StaggerItem>
  ))}
</StaggerList>

// Modal
<MotionModal isOpen={isOpen} onClose={onClose}>
  <div className="bg-card p-6 rounded-lg">
    Modal content
  </div>
</MotionModal>
```

## Reduced Motion Support

النظام يحترم تفضيلات المستخدم تلقائياً:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-instant: 0ms;
    --motion-duration-fast: 0ms;
    --motion-duration-normal: 0ms;
    --motion-duration-smooth: 0ms;
    --motion-duration-slow: 0ms;
  }
}
```

## RTL Support

جميع الحركات متوافقة مع RTL:
- `slideInFromRight` و `slideInFromLeft` تعمل بشكل صحيح
- لا حاجة لتعديلات إضافية

## ما يجب تجنبه

| ❌ لا تفعل | ✅ افعل |
|-----------|--------|
| حركات طويلة (> 350ms) | حركات سريعة (150-250ms) |
| تأثيرات flashy | تأثيرات subtle |
| حركات بدون سبب | حركات تخدم UX |
| تجاهل reduced-motion | دعم reduced-motion |
| spinners للتحميل | skeleton loaders |

## الملفات

```
nextjs-app/
├── src/
│   ├── app/
│   │   └── globals.css          # Motion CSS variables & classes
│   └── lib/
│       └── motion/
│           ├── index.ts         # Main export
│           ├── tokens.ts        # Duration, easing values
│           ├── variants.ts      # Framer Motion variants
│           └── components.tsx   # Reusable components
```
