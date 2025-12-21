import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TopStudents } from '@/components/dashboard/TopStudents';
import { Users, GraduationCap, BookOpen, TrendingUp, MessageSquare, FileText } from 'lucide-react';

const performanceData = [
  { name: 'Sep', value: 0, average: 0 },
  { name: 'Oct', value: 0, average: 0 },
  { name: 'Nov', value: 0, average: 0 },
  { name: 'Dec', value: 0, average: 0 },
];

const recentActivities: { id: string; type: 'marks' | 'feedback' | 'report' | 'user'; message: string; time: string }[] = [];

const topStudents: { rank: number; name: string; class: string; average: number; grade: string }[] = [];

export function AdminDashboard() {
  const navigate = useNavigate();

  const { data: studentsCount = 0 } = useQuery({
    queryKey: ['students-count'],
    queryFn: async () => {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: teachersCount = 0 } = useQuery({
    queryKey: ['teachers-count'],
    queryFn: async () => {
      const { count } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: subjectsCount = 0 } = useQuery({
    queryKey: ['subjects-count'],
    queryFn: async () => {
      const { count } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: feedbackCount = 0 } = useQuery({
    queryKey: ['feedback-pending-count'],
    queryFn: async () => {
      const { count } = await supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      return count || 0;
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's an overview of your school.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Students" value={studentsCount.toLocaleString()} subtitle="All classes" icon={GraduationCap} variant="primary" />
        <StatCard title="Teachers" value={teachersCount.toLocaleString()} subtitle="All teachers" icon={Users} variant="accent" />
        <StatCard title="Subjects" value={subjectsCount.toLocaleString()} subtitle="All subjects" icon={BookOpen} variant="success" />
        <StatCard title="Feedback" value={feedbackCount.toLocaleString()} subtitle="Pending response" icon={TrendingUp} variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PerformanceChart data={performanceData} title="School Performance Trend" />
        </div>
        <TopStudents students={topStudents} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity activities={recentActivities} />
        </div>
        
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Quick Actions</h3>
          <div className="space-y-3">
            <button onClick={() => navigate('/reports')} className="w-full flex items-center gap-3 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
              <div><p className="font-medium text-card-foreground">Generate Reports</p><p className="text-xs text-muted-foreground">Create academic reports</p></div>
            </button>
            <button onClick={() => navigate('/users')} className="w-full flex items-center gap-3 p-4 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center"><Users className="w-5 h-5 text-accent" /></div>
              <div><p className="font-medium text-card-foreground">Manage Users</p><p className="text-xs text-muted-foreground">Add or edit user accounts</p></div>
            </button>
            <button onClick={() => navigate('/feedback')} className="w-full flex items-center gap-3 p-4 rounded-lg bg-success/5 hover:bg-success/10 transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><MessageSquare className="w-5 h-5 text-success" /></div>
              <div><p className="font-medium text-card-foreground">View Feedback</p><p className="text-xs text-muted-foreground">3 pending reviews</p></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
