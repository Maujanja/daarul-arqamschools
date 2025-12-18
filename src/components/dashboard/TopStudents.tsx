import { Trophy, Medal } from 'lucide-react';
import { GradeBadge } from './GradeBadge';
import { cn } from '@/lib/utils';

interface TopStudent {
  rank: number;
  name: string;
  class: string;
  average: number;
  grade: string;
}

interface TopStudentsProps {
  students: TopStudent[];
  title?: string;
}

export function TopStudents({ students, title = "Top Performers" }: TopStudentsProps) {
  return (
    <div className="card-elevated p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-5 h-5 text-warning" />
        <h3 className="font-display font-semibold text-lg text-card-foreground">{title}</h3>
      </div>
      <div className="space-y-3">
        {students.map((student, index) => (
          <div 
            key={student.rank}
            className={cn(
              "flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-muted/50 animate-slide-up",
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
              student.rank === 1 && "bg-warning/20 text-warning",
              student.rank === 2 && "bg-muted text-muted-foreground",
              student.rank === 3 && "bg-orange-500/20 text-orange-600",
              student.rank > 3 && "bg-muted text-muted-foreground"
            )}>
              {student.rank <= 3 ? (
                <Medal className="w-4 h-4" />
              ) : (
                student.rank
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-card-foreground truncate">{student.name}</p>
              <p className="text-xs text-muted-foreground">Class {student.class}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-card-foreground">{student.average}%</p>
              <GradeBadge grade={student.grade} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
