import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning';
  /** Kept for compatibility with existing pages; the new design uses clean white cards. */
  bgStyle?: 'silk' | 'cherries';
}

const iconVariantStyles = {
  default: 'bg-slate-100 text-slate-600',
  primary: 'bg-blue-100 text-blue-600',
  accent: 'bg-teal-100 text-teal-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
};

const accentBarStyles = {
  default: 'from-slate-300 to-slate-200',
  primary: 'from-blue-400 to-blue-200',
  accent: 'from-teal-500 to-teal-200',
  success: 'from-emerald-500 to-emerald-200',
  warning: 'from-[hsl(var(--gold))] to-amber-100',
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className="stat-card animate-fade-in">
      <div
        aria-hidden
        className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', accentBarStyles[variant])}
      />
      <div className="relative flex flex-col gap-3">
        <div className={cn('w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center', iconVariantStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground pt-1">{title}</p>
          {subtitle && <p className="text-xs font-medium text-muted-foreground/80">{subtitle}</p>}
        </div>
        {trend && (
          <div
            className={cn(
              'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
              trend.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600',
            )}
          >
            <span>{trend.isPositive ? '▲' : '▼'}</span>
            <span>{Math.abs(trend.value)}%</span>
            <span className="font-medium opacity-70">vs last term</span>
          </div>
        )}
      </div>
    </div>
  );
}
