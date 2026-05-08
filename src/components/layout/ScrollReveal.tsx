import { ReactNode, useEffect, useRef } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Scroll reveal disabled per user request — content renders statically without
 * any scroll-driven transforms, opacity, or overlap effects. Kept as a no-op
 * wrapper to preserve existing imports across dashboards.
 */
export function ScrollReveal({ children, className }: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
