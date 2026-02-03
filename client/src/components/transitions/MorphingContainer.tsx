import { ReactNode } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';

interface MorphingContainerProps {
  children: ReactNode;
  layoutId?: string;
}

/**
 * MorphingContainer - Wrapper for shared layout animations
 * Use layoutId prop on child elements to enable morphing transitions
 */
export function MorphingContainer({ children, layoutId }: MorphingContainerProps) {
  return (
    <LayoutGroup id={layoutId}>
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </LayoutGroup>
  );
}

interface MorphingItemProps {
  children: ReactNode;
  layoutId: string;
  className?: string;
  onClick?: () => void;
}

/**
 * MorphingItem - Individual item that participates in morphing transitions
 */
export function MorphingItem({
  children,
  layoutId,
  className = '',
  onClick,
}: MorphingItemProps) {
  return (
    <motion.div
      layoutId={layoutId}
      className={className}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
        mass: 1,
      }}
    >
      {children}
    </motion.div>
  );
}

interface SharedElementProps {
  children: ReactNode;
  layoutId: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SharedElement - Element that morphs between states when layoutId matches
 */
export function SharedElement({
  children,
  layoutId,
  className = '',
  style,
}: SharedElementProps) {
  return (
    <motion.div
      layoutId={layoutId}
      className={className}
      style={style}
      layout
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
    >
      {children}
    </motion.div>
  );
}
