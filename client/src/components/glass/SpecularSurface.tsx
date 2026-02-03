import { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { useSpecularHighlight } from '@/hooks/useSpecularHighlight';

interface SpecularSurfaceProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  intensity?: 'low' | 'medium' | 'high';
  disabled?: boolean;
  children?: React.ReactNode;
}

const intensitySettings = {
  low: {
    gradient: (x: number, y: number) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)`,
  },
  medium: {
    gradient: (x: number, y: number) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 40%, transparent 70%)`,
  },
  high: {
    gradient: (x: number, y: number) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.1) 30%, transparent 60%)`,
  },
};

/**
 * SpecularSurface - Container with cursor-following light reflection effect
 */
export const SpecularSurface = forwardRef<HTMLDivElement, SpecularSurfaceProps>(
  ({ intensity = 'medium', disabled = false, className = '', children, ...props }, ref) => {
    const { elementRef, position, specularStyle } = useSpecularHighlight<HTMLDivElement>({
      disabled,
    });

    // Combine refs
    const combinedRef = (node: HTMLDivElement | null) => {
      (elementRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const gradient = intensitySettings[intensity].gradient(position.x, position.y);

    return (
      <motion.div
        ref={combinedRef}
        className={`relative overflow-hidden ${className}`}
        style={specularStyle}
        {...props}
      >
        {/* Specular highlight layer */}
        {!disabled && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: gradient }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            aria-hidden="true"
          />
        )}

        {/* Content */}
        {children}
      </motion.div>
    );
  }
);

SpecularSurface.displayName = 'SpecularSurface';
