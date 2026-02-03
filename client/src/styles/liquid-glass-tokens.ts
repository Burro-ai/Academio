/**
 * Liquid Glass Design System - Design Tokens
 * Apple 2026 Inspired Glass Effects
 */

// Opacity levels following 100/70/40/20 rule
export const OPACITY_LEVELS = {
  solid: 1.0,      // 100% - Critical text, logos, primary CTAs
  prominent: 0.7,  // 70% - Supporting text, nav tabs
  subtle: 0.4,     // 40% - Decorative dividers
  muted: 0.2,      // 20% - Atmospheric overlays
} as const;

// Blur intensity levels
export const BLUR_LEVELS = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '64px',
} as const;

// Glass tint colors
export const GLASS_TINTS = {
  light: {
    bg: 'rgba(255, 255, 255, 0.20)',
    border: 'rgba(255, 255, 255, 0.20)',
    hover: 'rgba(255, 255, 255, 0.30)',
  },
  dark: {
    bg: 'rgba(0, 0, 0, 0.10)',
    border: 'rgba(0, 0, 0, 0.15)',
    hover: 'rgba(0, 0, 0, 0.20)',
  },
  primary: {
    bg: 'rgba(14, 165, 233, 0.40)',
    border: 'rgba(14, 165, 233, 0.30)',
    hover: 'rgba(14, 165, 233, 0.50)',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.40)',
    border: 'rgba(34, 197, 94, 0.30)',
    hover: 'rgba(34, 197, 94, 0.50)',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.40)',
    border: 'rgba(245, 158, 11, 0.30)',
    hover: 'rgba(245, 158, 11, 0.50)',
  },
  danger: {
    bg: 'rgba(239, 68, 68, 0.40)',
    border: 'rgba(239, 68, 68, 0.30)',
    hover: 'rgba(239, 68, 68, 0.50)',
  },
} as const;

// Glass variants configuration
export const GLASS_VARIANTS = {
  panel: {
    blur: BLUR_LEVELS.xl,
    bg: GLASS_TINTS.light.bg,
    border: GLASS_TINTS.light.border,
  },
  card: {
    blur: BLUR_LEVELS.lg,
    bg: 'rgba(255, 255, 255, 0.25)',
    border: 'rgba(255, 255, 255, 0.25)',
    borderRadius: '16px',
  },
  surface: {
    blur: BLUR_LEVELS.md,
    bg: 'rgba(255, 255, 255, 0.15)',
    border: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
  },
  input: {
    blur: BLUR_LEVELS.md,
    bg: 'rgba(255, 255, 255, 0.20)',
    border: 'rgba(255, 255, 255, 0.20)',
    borderRadius: '12px',
  },
} as const;

// Shadow presets
export const GLASS_SHADOWS = {
  default: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  lg: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
  inset: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
  specular: '0 0 40px rgba(255, 255, 255, 0.3)',
} as const;

// Animation durations
export const ANIMATION_DURATIONS = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

// Type exports
export type OpacityLevel = keyof typeof OPACITY_LEVELS;
export type BlurLevel = keyof typeof BLUR_LEVELS;
export type GlassTint = keyof typeof GLASS_TINTS;
export type GlassVariant = keyof typeof GLASS_VARIANTS;
