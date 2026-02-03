import { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

type GlassVariant = 'panel' | 'card' | 'surface' | 'elevated';
type GlassTint = 'light' | 'dark' | 'primary' | 'success' | 'warning' | 'danger';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: GlassVariant;
  tint?: GlassTint;
  blur?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  hover?: boolean;
  children?: React.ReactNode;
}

const variantStyles: Record<GlassVariant, string> = {
  panel: 'backdrop-blur-xl bg-white/20 border border-white/20 shadow-glass',
  card: 'backdrop-blur-lg bg-white/25 border border-white/25 rounded-2xl shadow-glass',
  surface: 'backdrop-blur-md bg-white/15 border border-white/15 rounded-xl',
  elevated: 'backdrop-blur-xl bg-white/30 border border-white/30 rounded-2xl shadow-glass-lg',
};

const tintStyles: Record<GlassTint, string> = {
  light: '',
  dark: 'bg-black/10 border-black/10',
  primary: 'bg-primary-500/20 border-primary-400/30',
  success: 'bg-green-500/20 border-green-400/30',
  warning: 'bg-amber-500/20 border-amber-400/30',
  danger: 'bg-red-500/20 border-red-400/30',
};

const blurStyles = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
  xl: 'backdrop-blur-xl',
  '2xl': 'backdrop-blur-2xl',
};

/**
 * GlassCard - Container component with glass morphism effect
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = 'card',
      tint = 'light',
      blur,
      hover = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const hoverClasses = hover
      ? 'transition-all duration-300 hover:bg-white/30 hover:shadow-glass-lg hover:scale-[1.02]'
      : '';

    const blurClass = blur ? blurStyles[blur] : '';

    return (
      <motion.div
        ref={ref}
        className={`
          ${variantStyles[variant]}
          ${tint !== 'light' ? tintStyles[tint] : ''}
          ${blurClass}
          ${hoverClasses}
          ${className}
        `.trim()}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        {...props}
      >
        {/* Top reflection highlight */}
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
          aria-hidden="true"
        />
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
