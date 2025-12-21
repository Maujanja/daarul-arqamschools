import { useState, useEffect } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { BookOpen, TrendingUp, Award, Download, MessageSquare, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StudentMark {
  subject: string;
  exam: number;
  total: number;
  grade: string;
}

export function ParentDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [childName, setChildName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [overallAverage, setOverallAverage] = useState(0);

  useEffect(() => {
    const fetchChildData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      // For parent login, user.id is the parent_id or student_id
      // Try to get student directly by parent_id first
      let studentData = null;
      
      const { data: studentByParent } = await supabase
        .from('students')
        .select('*')
        .eq('parent_id', user.id)
        .maybeSingle();
      
      if (studentByParent) {
        studentData = studentByParent;
      } else {
        // If not found, try finding by student id (when parent logged in with child info)
        const { data: studentById } = await supabase
          .from('students')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        studentData = studentById;
      }
      
      if (!studentData) {
        // Try to find any student linked to any parent with matching name
        const { data: parentRecord } = await supabase
          .from('parents')
          .select('id')
          .ilike('full_name', `%${user.name}%`)
          .maybeSingle();
        
        if (parentRecord) {
          const { data: studentByParentRecord } = await supabase
            .from('students')
            .select('*')
            .eq('parent_id', parentRecord.id)
            .maybeSingle();
          
          studentData = studentByParentRecord;
        }
      }
      
      if (!studentData) {
        setIsLoading(false);
        return;
      }
      
      setChildName(studentData.full_name);
      setChildClass(studentData.class);
      
      // Get marks for this student
      const { data: marksData } = await supabase
        .from('marks')
        .select(`
          exam,
          total,
          grade,
          subjects (name)
        `)
        .eq('student_id', studentData.id);
      
      if (marksData) {
        const formattedMarks = marksData.map((m: any) => ({
          subject: m.subjects?.name || 'Unknown',
          exam: m.exam,
          total: m.total,
          grade: m.grade,
        }));
        setStudentMarks(formattedMarks);
        
        if (formattedMarks.length > 0) {
          const avg = formattedMarks.reduce((sum, m) => sum + m.total, 0) / formattedMarks.length;
          setOverallAverage(avg);
        }
      }
      
      setIsLoading(false);
    };
    
    fetchChildData();
  }, [user]);

  const performanceData = studentMarks.map(m => ({
    name: m.subject.slice(0, 4),
    value: m.total,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!childName) {
    return (
      <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Parent Dashboard</h1>
        <p className="text-muted-foreground mt-1">No student is linked to your account.</p>
      </div>
      </div>
    );
  }

  const classRank = 3; // This would be calculated from actual data

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Parent Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Viewing records for <span className="font-semibold text-primary">{childName}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <MessageSquare className="w-4 h-4 mr-2" />
            Send Feedback
          </Button>
          <Button className="btn-gradient">
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Student Info Card */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-2xl font-bold">
            {childName.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-display font-bold text-card-foreground">{childName}</h2>
            <p className="text-muted-foreground">Class {childClass}</p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Year 2024-2025</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-warning" />
                <span className="text-sm text-muted-foreground">Rank: <span className="font-semibold text-card-foreground">#{classRank}</span></span>
              </div>
            </div>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm text-muted-foreground">Overall Average</p>
            <p className="text-4xl font-bold font-display gradient-text">{overallAverage.toFixed(1)}%</p>
            <GradeBadge grade={overallAverage >= 75 ? 'A' : overallAverage >= 65 ? 'B' : overallAverage >= 50 ? 'C' : overallAverage >= 40 ? 'D' : 'F'} size="lg" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Subjects"
          value={studentMarks.length.toString()}
          subtitle="Registered subjects"
          icon={BookOpen}
          variant="primary"
        />
        <StatCard
          title="Best Subject"
          value={studentMarks.length > 0 ? studentMarks.reduce((best, m) => m.total > best.total ? m : best, studentMarks[0]).subject : '-'}
          subtitle={studentMarks.length > 0 ? `${Math.max(...studentMarks.map(m => m.total))}%` : '-'}
          icon={Award}
          variant="success"
        />
        <StatCard
          title="Class Rank"
          value={`#${classRank}`}
          subtitle="Among all students"
          icon={TrendingUp}
          variant="accent"
        />
        <StatCard
          title="Attendance"
          value="94%"
          subtitle="This term"
          icon={Calendar}
          variant="warning"
        />
      </div>

      {/* Performance Chart */}
      {performanceData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PerformanceChart 
              data={performanceData} 
              title="Performance by Subject" 
            />
          </div>
          
          {/* Grade Distribution */}
          <div className="card-elevated p-6 animate-fade-in">
            <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Grade Distribution</h3>
            <div className="space-y-4">
              {['A', 'B', 'C', 'D', 'F'].map(grade => {
                const count = studentMarks.filter(m => m.grade === grade).length;
                const percentage = studentMarks.length > 0 ? (count / studentMarks.length) * 100 : 0;
                return (
                  <div key={grade} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Grade {grade}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${grade === 'A' ? 'bg-success' : grade === 'B' ? 'bg-primary' : grade === 'C' ? 'bg-warning' : grade === 'D' ? 'bg-orange-500' : 'bg-destructive'}`} 
                          style={{ width: `${percentage}%` }} 
                        />
                      </div>
                      <span className="text-sm font-medium text-card-foreground">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Marks Table */}
      {studentMarks.length > 0 && (
        <div className="card-elevated p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-lg text-card-foreground">Detailed Marks - Term 1</h3>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Exam (100)</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Grade</th>
                </tr>
              </thead>
              <tbody>
                {studentMarks.map((mark, index) => (
                  <tr key={index} className="border-b border-border/50 table-row-hover">
                    <td className="py-4 px-4 font-medium text-card-foreground">{mark.subject}</td>
                    <td className="py-4 px-4 text-center text-card-foreground">{mark.exam}</td>
                    <td className="py-4 px-4 text-center font-semibold text-card-foreground">{mark.total}</td>
                    <td className="py-4 px-4 text-center">
                      <GradeBadge grade={mark.grade} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50">
                  <td className="py-4 px-4 font-semibold text-card-foreground">Overall Average</td>
                  <td></td>
                  <td className="py-4 px-4 text-center font-bold text-xl text-primary">{overallAverage.toFixed(1)}</td>
                  <td className="py-4 px-4 text-center">
                    <GradeBadge grade={overallAverage >= 75 ? 'A' : overallAverage >= 65 ? 'B' : overallAverage >= 50 ? 'C' : overallAverage >= 40 ? 'D' : 'F'} size="lg" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}