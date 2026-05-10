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
  bgStyle?: 'silk' | 'cherries';
}

const variantStyles = {
  default: 'before:from-muted-foreground before:to-muted-foreground/50',
  primary: 'before:from-primary before:to-primary/50',
  accent: 'before:from-accent before:to-accent/50',
  success: 'before:from-success before:to-success/50',
  warning: 'before:from-warning before:to-warning/50',
};

const iconVariantStyles = {
  default: 'bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-lg',
  primary: 'bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-blue-500/30',
  accent: 'bg-gradient-to-br from-teal-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30',
  success: 'bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-lg shadow-green-500/30',
  warning: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30',
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn("stat-card animate-fade-in", variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-semibold",
            "text-foreground/80"
          )}>{title}</p>
          <p className={cn(
            "text-3xl font-bold font-display",
            "text-foreground drop-shadow-sm"
          )}>{value}</p>
          {subtitle && (
            <p className={cn(
              "text-sm font-medium",
              "text-foreground/70"
            )}>{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 text-sm font-semibold drop-shadow-sm",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="font-medium text-foreground/70">vs last term</span>
            </div>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl hover:animate-pulse cursor-pointer",
          iconVariantStyles[variant]
        )}>
          <Icon className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" />
        </div>
      </div>
    </div>
  );
}
