import { ReactNode } from 'react';
import { motion } from 'motion/react';

interface LiquidBorderProps {
  children: ReactNode;
  animated?: boolean;
  className?: string;
  borderColor?: string;
  borderWidth?: number;
}

/**
 * LiquidBorder - Wrapper that applies liquid edge effect to children
 */
export function LiquidBorder({
  children,
  animated = false,
  className = '',
  borderColor = 'rgba(255, 255, 255, 0.3)',
  borderWidth = 1,
}: LiquidBorderProps) {
  const filterClass = animated ? 'liquid-border-animated' : 'liquid-border';

  return (
    <motion.div
      className={`relative ${filterClass} ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        border: `${borderWidth}px solid ${borderColor}`,
      }}
    >
      {children}
    </motion.div>
  );
}

interface LiquidBlobProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * LiquidBlob - Animated blob shape for decorative purposes
 */
export function LiquidBlob({
  size = 100,
  color = 'rgba(14, 165, 233, 0.3)',
  className = '',
}: LiquidBlobProps) {
  return (
    <motion.div
      className={`animate-liquid-wobble ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
        filter: 'blur(20px)',
      }}
      animate={{
        scale: [1, 1.05, 0.95, 1],
        rotate: [0, 5, -5, 0],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
