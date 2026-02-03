import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const baseInputStyles = `
  w-full
  backdrop-blur-md bg-white/20 border border-white/20
  rounded-xl px-4 py-3
  text-surface-800 placeholder:text-surface-500/70
  focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40
  transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
`;

const errorStyles = 'border-red-400/50 focus:ring-red-400/40 focus:border-red-400/50';

/**
 * GlassInput - Input component with glass morphism effect
 */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, leftIcon, rightIcon, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-solid">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500/70">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              ${baseInputStyles}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${error ? errorStyles : ''}
              ${className}
            `.trim()}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500/70">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';

/**
 * GlassTextarea - Textarea component with glass morphism effect
 */
export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-solid">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            ${baseInputStyles}
            resize-none
            ${error ? errorStyles : ''}
            ${className}
          `.trim()}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

GlassTextarea.displayName = 'GlassTextarea';
