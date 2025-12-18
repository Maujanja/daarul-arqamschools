import { cn } from '@/lib/utils';
import { Grade, getGradeColor } from '@/types';

interface GradeBadgeProps {
  grade: Grade | string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function GradeBadge({ grade, size = 'md' }: GradeBadgeProps) {
  const colorClass = getGradeColor(grade as Grade);
  
  return (
    <span className={cn(
      "grade-badge font-semibold inline-flex items-center justify-center",
      colorClass,
      sizeStyles[size]
    )}>
      {grade}
    </span>
  );
}
