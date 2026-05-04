import { Children, isValidElement, ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay between siblings (seconds) */
  stagger?: number;
}

const variants: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Wraps direct children with a smooth scroll-reveal animation.
 * Each top-level child fades + lifts in as it enters the viewport.
 */
export function ScrollReveal({ children, className, stagger = 0.06 }: ScrollRevealProps) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children).filter((c) => isValidElement(c) || typeof c === 'string');

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      {items.map((child, i) => (
        <motion.div
          key={(isValidElement(child) && child.key) || i}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15, margin: '0px 0px -10% 0px' }}
          variants={variants}
          transition={{ delay: i * stagger }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
