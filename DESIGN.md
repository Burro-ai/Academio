# DESIGN.md - Academio Liquid Glass Design System

> **Purpose:** Reference for the Apple Liquid Glass (2026) design language used across all components.
> **Status:** Implemented across all components.

---

## Design Philosophy

The UI uses Apple's 2026 Liquid Glass design language featuring:
- **Translucent glass panels** with backdrop blur effects
- **Dynamic gradient mesh background** with animated floating orbs
- **100/70/40/20 opacity rule** for text hierarchy
- **Cursor-following specular highlights** on interactive elements
- **Morphing transitions** between states using Motion library

---

## Key Files

| File | Purpose |
|------|---------|
| `client/src/styles/liquid-glass-tokens.ts` | Design tokens (opacity, blur, tints, shadows) |
| `client/src/components/layout/DynamicBackground.tsx` | Animated gradient mesh background |
| `client/src/components/effects/LiquidEdgeFilter.tsx` | SVG filters for liquid edge effects |
| `client/src/components/glass/*.tsx` | Reusable glass components |
| `client/src/hooks/useSpecularHighlight.ts` | Cursor-following light effect hook |

---

## Glass Component Library

```
client/src/components/glass/
├── GlassCard.tsx        # Container: variants panel/card/surface/elevated
├── GlassButton.tsx      # Button with specular highlight; size: sm/md/lg
├── GlassInput.tsx       # Form inputs with glass styling
├── SpecularSurface.tsx  # Wrapper for cursor-following light
└── index.ts             # Barrel exports
```

### Using Glass Components

```tsx
import { GlassCard, GlassButton } from '@/components/glass';

<GlassCard variant="card" tint="light" hover>
  <h2 className="text-solid">Title</h2>
  <p className="text-prominent">Supporting text</p>
  <GlassButton variant="primary" size="md">Action</GlassButton>
</GlassCard>
```

---

## CSS Utility Classes

Defined in `client/src/index.css`:

| Class | Usage |
|-------|-------|
| `.glass-panel` | Sidebars, large containers (xl blur, 20% white bg) |
| `.glass-card` | Content cards, modals (lg blur, 25% white bg, rounded-2xl) |
| `.glass-surface` | Subtle glass (md blur, 15% white bg, rounded-xl) |
| `.glass-btn` | Default glass button |
| `.glass-btn-primary` | Primary action button (primary color tint) |
| `.glass-message-user` | User chat bubbles (primary tint) |
| `.glass-message-ai` | AI chat bubbles (white tint) |
| `.glass-stat-card` | Dashboard stat cards with hover effect |

---

## Text Opacity Classes (100/70/40/20 Rule)

| Class | Opacity | Usage |
|-------|---------|-------|
| `.text-solid` | 100% | Critical text, logos, primary CTAs |
| `.text-prominent` | 70% | Supporting text, nav tabs |
| `.text-subtle` | 40% | Decorative dividers, placeholders |
| `.text-muted` | 20% | Atmospheric overlays |

---

## Tailwind Config Extensions

Glass colors available via Tailwind:
- `bg-glass-white-{5,10,15,20,25,30,40,50,60,70}` — White glass tints
- `bg-glass-dark-{5,10,15,20,25,30}` — Dark glass tints
- `bg-glass-primary-{20,30,40}` — Primary color glass tints
- `shadow-glass`, `shadow-glass-lg`, `shadow-glass-inset` — Glass shadows
- `animate-gradient-shift`, `animate-liquid-wobble` — Glass animations

---

## Motion Animations

The `motion` library (imported from `motion/react`) provides:
- `whileHover`, `whileTap` — Interactive feedback on buttons
- `layoutId` — Shared element transitions (used in TopicSelector)
- `LayoutGroup` — Coordinate animations between components
- `AnimatePresence` — Exit animations for unmounting elements

---

## Background Setup

`DynamicBackground` and `LiquidEdgeFilter` are added in `App.tsx`:

```tsx
<>
  <LiquidEdgeFilter />    {/* SVG filter definitions */}
  <DynamicBackground />   {/* Animated gradient mesh */}
  <div className="relative z-10">
    {/* App content */}
  </div>
</>
```

---

## Accessibility

- **Reduced motion:** All animations respect `prefers-reduced-motion` media query
- **Focus states:** Glass elements use `focus:ring-2 focus:ring-white/50`
- **Text contrast:** Critical text uses `.text-solid` with subtle text shadow
- **Keyboard navigation:** All interactive elements are focusable

---

## Specular Highlight Pattern

```tsx
import { useSpecularHighlight } from '@/hooks/useSpecularHighlight';

const { elementRef, specularGradient } = useSpecularHighlight();

<div ref={elementRef} className="relative overflow-hidden">
  {/* Specular overlay */}
  <div
    className="absolute inset-0 pointer-events-none transition-opacity"
    style={{ background: specularGradient, opacity: 0.4 }}
  />
  {/* Content */}
</div>
```
