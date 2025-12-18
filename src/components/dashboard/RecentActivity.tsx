import { ClipboardCheck, MessageSquare, FileText, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'marks' | 'feedback' | 'report' | 'user';
  message: string;
  time: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

const iconMap = {
  marks: ClipboardCheck,
  feedback: MessageSquare,
  report: FileText,
  user: UserPlus,
};

const colorMap = {
  marks: 'bg-primary/10 text-primary',
  feedback: 'bg-accent/10 text-accent',
  report: 'bg-success/10 text-success',
  user: 'bg-warning/10 text-warning',
};

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <div className="card-elevated p-6 animate-fade-in">
      <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const Icon = iconMap[activity.type];
          return (
            <div 
              key={activity.id} 
              className={cn(
                "flex items-start gap-4 animate-slide-up",
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                colorMap[activity.type]
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-card-foreground">{activity.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
