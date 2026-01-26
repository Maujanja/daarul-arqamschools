import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import cardBgSilk from '@/assets/card-bg-silk.jpg';
import cardBgCherries from '@/assets/card-bg-cherries.jpg';

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
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
};

const bgImages = {
  silk: cardBgSilk,
  cherries: cardBgCherries,
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', bgStyle }: StatCardProps) {
  const backgroundImage = bgStyle ? bgImages[bgStyle] : undefined;

  return (
    <div 
      className={cn("stat-card animate-fade-in", variantStyles[variant])}
      style={backgroundImage ? {
        backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.45) 100%), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-semibold",
            backgroundImage ? "text-slate-700 drop-shadow-sm" : "text-muted-foreground"
          )}>{title}</p>
          <p className={cn(
            "text-3xl font-bold font-display",
            backgroundImage ? "text-slate-900 drop-shadow-md" : "text-card-foreground"
          )}>{value}</p>
          {subtitle && (
            <p className={cn(
              "text-sm font-medium",
              backgroundImage ? "text-slate-600 drop-shadow-sm" : "text-muted-foreground"
            )}>{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 text-sm font-semibold drop-shadow-sm",
              trend.isPositive ? "text-emerald-700" : "text-red-700"
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className={cn(
                "font-medium",
                backgroundImage ? "text-slate-600" : "text-muted-foreground"
              )}>vs last term</span>
            </div>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          iconVariantStyles[variant]
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
