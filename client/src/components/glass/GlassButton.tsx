import { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { useSpecularHighlight } from '@/hooks/useSpecularHighlight';

type ButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    'backdrop-blur-md bg-white/20 border border-white/25 text-surface-800 hover:bg-white/30 hover:border-white/35',
  primary:
    'backdrop-blur-md bg-primary-500/40 border border-primary-400/30 text-white hover:bg-primary-500/50 hover:border-primary-400/40',
  secondary:
    'backdrop-blur-md bg-surface-500/20 border border-surface-400/25 text-surface-800 hover:bg-surface-500/30',
  ghost:
    'backdrop-blur-sm bg-transparent border border-transparent text-surface-700 hover:bg-white/20 hover:border-white/20',
  danger:
    'backdrop-blur-md bg-red-500/40 border border-red-400/30 text-white hover:bg-red-500/50 hover:border-red-400/40',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
};

/**
 * GlassButton - Button component with glass morphism and specular highlight
 */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const { elementRef, specularStyle, specularGradient } =
      useSpecularHighlight<HTMLButtonElement>({
        disabled: disabled || isLoading,
      });

    // Combine refs
    const combinedRef = (node: HTMLButtonElement | null) => {
      (elementRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <motion.button
        ref={combinedRef}
        disabled={disabled || isLoading}
        className={`
          relative overflow-hidden
          inline-flex items-center justify-center font-medium
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          active:scale-[0.98]
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
          focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent
          ${className}
        `.trim()}
        style={specularStyle}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        {...props}
      >
        {/* Specular highlight overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{ background: specularGradient }}
          aria-hidden="true"
        />

        {/* Top edge highlight */}
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          aria-hidden="true"
        />

        {/* Content */}
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';
