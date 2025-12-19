import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/dashboard/StatCard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TopStudents } from '@/components/dashboard/TopStudents';
import { Users, GraduationCap, BookOpen, TrendingUp, MessageSquare, FileText } from 'lucide-react';

const performanceData = [
  { name: 'Sep', value: 72, average: 68 },
  { name: 'Oct', value: 75, average: 70 },
  { name: 'Nov', value: 78, average: 72 },
  { name: 'Dec', value: 82, average: 74 },
];

const recentActivities = [
  { id: '1', type: 'marks' as const, message: 'Sarah Johnson submitted marks for Class 10-A Mathematics', time: '5 minutes ago' },
  { id: '2', type: 'feedback' as const, message: 'New feedback received from Robert Smith', time: '1 hour ago' },
  { id: '3', type: 'report' as const, message: 'Term 1 reports generated for Class 10-B', time: '2 hours ago' },
  { id: '4', type: 'user' as const, message: 'New teacher account created for David Lee', time: '3 hours ago' },
  { id: '5', type: 'marks' as const, message: 'Michael Chen submitted marks for Class 9-A Science', time: '4 hours ago' },
];

const topStudents = [
  { rank: 1, name: 'Emma Davis', class: '10-A', average: 94, grade: 'A' },
  { rank: 2, name: 'Alex Smith', class: '10-A', average: 86, grade: 'A' },
  { rank: 3, name: 'Sophia Brown', class: '10-B', average: 75, grade: 'A' },
  { rank: 4, name: 'James Wilson', class: '10-A', average: 66, grade: 'B' },
  { rank: 5, name: 'Oliver Taylor', class: '10-B', average: 48, grade: 'D' },
];

export function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's an overview of your school.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Students"
          value="1,284"
          subtitle="Across all classes"
          icon={GraduationCap}
          trend={{ value: 12, isPositive: true }}
          variant="primary"
        />
        <StatCard
          title="Total Teachers"
          value="48"
          subtitle="Active staff members"
          icon={Users}
          variant="accent"
        />
        <StatCard
          title="Subjects"
          value="12"
          subtitle="Active subjects"
          icon={BookOpen}
          variant="success"
        />
        <StatCard
          title="Avg. Performance"
          value="74%"
          subtitle="School-wide average"
          icon={TrendingUp}
          trend={{ value: 5, isPositive: true }}
          variant="warning"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PerformanceChart 
            data={performanceData} 
            title="School Performance Trend" 
          />
        </div>
        <TopStudents students={topStudents} />
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity activities={recentActivities} />
        </div>
        
        {/* Quick Actions */}
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/reports')}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">Generate Reports</p>
                <p className="text-xs text-muted-foreground">Create academic reports</p>
              </div>
            </button>
            <button 
              onClick={() => navigate('/users')}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">Manage Users</p>
                <p className="text-xs text-muted-foreground">Add or edit user accounts</p>
              </div>
            </button>
            <button 
              onClick={() => navigate('/feedback')}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-success/5 hover:bg-success/10 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">View Feedback</p>
                <p className="text-xs text-muted-foreground">3 pending reviews</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
