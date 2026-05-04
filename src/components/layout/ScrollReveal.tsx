import { ReactNode, useEffect, useRef } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Smooth scroll reveal: scans descendant elements matching common card/section
 * selectors and animates them in as they enter the viewport. Re-animates on
 * scroll up/down for a polished feel.
 */
export function ScrollReveal({ children, className }: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const root = containerRef.current;
    if (!root) return;

    const selector = [
      '[data-reveal]',
      '.reveal-target',
      // common building blocks across dashboards
      ':scope > * > .grid > *',
      ':scope > * > * > .grid > *',
      ':scope > * [data-slot="card"]',
    ].join(',');

    const collect = () => {
      const els = new Set<HTMLElement>();
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => els.add(el));
      // Also reveal direct children of the root (page sections)
      Array.from(root.children).forEach((el) => {
        if (el instanceof HTMLElement) els.add(el);
      });
      return Array.from(els);
    };

    const prepare = (el: HTMLElement) => {
      if (el.dataset.revealReady === '1') return;
      el.dataset.revealReady = '1';
      el.classList.add('reveal');
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
            el.classList.add('reveal-in');
          } else if (entry.intersectionRatio === 0) {
            // Reset when fully out so re-entry replays smoothly
            el.classList.remove('reveal-in');
          }
        });
      },
      { threshold: [0, 0.08, 0.2], rootMargin: '0px 0px -8% 0px' },
    );

    let rafId = 0;
    const refresh = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const els = collect();
        els.forEach((el) => {
          prepare(el);
          observer.observe(el);
        });
      });
    };

    refresh();

    const mo = new MutationObserver(refresh);
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafId);
      mo.disconnect();
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
