import { useCallback, useEffect, useRef, useState } from 'react';

interface SpecularPosition {
  x: number;
  y: number;
  angle: number;
}

interface UseSpecularHighlightOptions {
  throttleMs?: number;
  disabled?: boolean;
}

/**
 * useSpecularHighlight - Hook for cursor-following specular highlight effects
 * Tracks mouse position relative to an element and calculates gradient angle
 */
export function useSpecularHighlight<T extends HTMLElement = HTMLDivElement>(
  options: UseSpecularHighlightOptions = {}
) {
  const { throttleMs = 16, disabled = false } = options;
  const elementRef = useRef<T>(null);
  const [position, setPosition] = useState<SpecularPosition>({
    x: 50,
    y: 50,
    angle: 45,
  });
  const lastUpdateRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || !elementRef.current) return;

      const now = Date.now();
      if (now - lastUpdateRef.current < throttleMs) return;
      lastUpdateRef.current = now;

      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        if (!elementRef.current) return;

        const rect = elementRef.current.getBoundingClientRect();

        // Calculate position as percentage
        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;

        // Calculate angle from center for gradient direction
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);

        setPosition({
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
          angle: angle + 90, // Offset to make gradient perpendicular to mouse direction
        });
      });
    },
    [disabled, throttleMs]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    },
    [updatePosition]
  );

  const handleMouseLeave = useCallback(() => {
    // Reset to center when mouse leaves
    setPosition({ x: 50, y: 50, angle: 45 });
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || disabled) return;

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleMouseMove, handleMouseLeave, disabled]);

  // CSS custom properties style object
  const specularStyle = {
    '--mouse-x': `${position.x}%`,
    '--mouse-y': `${position.y}%`,
    '--specular-angle': `${position.angle}deg`,
  } as React.CSSProperties;

  // Generate radial gradient for specular effect
  const specularGradient = `radial-gradient(
    circle at ${position.x}% ${position.y}%,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.05) 40%,
    transparent 70%
  )`;

  return {
    elementRef,
    position,
    specularStyle,
    specularGradient,
  };
}
