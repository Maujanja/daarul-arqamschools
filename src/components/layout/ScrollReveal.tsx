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
      ':scope > * > .grid > *',
      ':scope > * > * > .grid > *',
      ':scope > * [data-slot="card"]',
    ].join(',');

    let elements: HTMLElement[] = [];

    const collect = () => {
      const els = new Set<HTMLElement>();
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => els.add(el));
      Array.from(root.children).forEach((el) => {
        if (el instanceof HTMLElement) els.add(el);
      });
      els.forEach((el) => {
        if (el.dataset.revealReady !== '1') {
          el.dataset.revealReady = '1';
          el.classList.add('reveal-card');
          el.style.willChange = 'transform, opacity, filter';
        }
      });
      elements = Array.from(els);
    };

    // Smoothstep easing
    const smooth = (t: number) => {
      const x = Math.max(0, Math.min(1, t));
      return x * x * (3 - 2 * x);
    };

    let rafId = 0;
    const update = () => {
      rafId = 0;
      const vh = window.innerHeight;
      // Reveal zones (in viewport %)
      const enterStart = vh * 0.95; // start animating in when top hits 95%
      const enterEnd = vh * 0.6;    // fully in when top reaches 60%
      const exitStart = vh * 0.25;  // begin folding out when bottom passes 25%
      const exitEnd = 0;            // fully out when bottom hits top edge

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.height === 0) continue;

        // Entering from below
        let enter = 1;
        if (rect.top > enterEnd) {
          enter = 1 - (rect.top - enterEnd) / Math.max(1, enterStart - enterEnd);
          enter = smooth(enter);
        }

        // Exiting to top — overlap/melt effect
        let exit = 1;
        if (rect.bottom < exitStart) {
          exit = (rect.bottom - exitEnd) / Math.max(1, exitStart - exitEnd);
          exit = smooth(exit);
        }

        const progress = Math.max(0, Math.min(1, Math.min(enter, exit)));

        // Translate: come up from 40px when entering; melt up by 60px when exiting
        const translateY =
          rect.top > enterEnd
            ? (1 - enter) * 40
            : rect.bottom < exitStart
              ? -(1 - exit) * 60
              : 0;

        // Scale down a touch on exit (stacking feel)
        const scale =
          rect.bottom < exitStart
            ? 0.92 + 0.08 * exit
            : rect.top > enterEnd
              ? 0.96 + 0.04 * enter
              : 1;

        const opacity = 0.05 + 0.95 * progress;
        const blur = (1 - progress) * 6;

        el.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
      }
    };

    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(update);
    };

    collect();
    update();

    const mo = new MutationObserver(() => {
      collect();
      schedule();
    });
    mo.observe(root, { childList: true, subtree: true });

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      mo.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
