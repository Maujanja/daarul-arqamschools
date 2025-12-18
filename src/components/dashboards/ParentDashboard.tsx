import { StatCard } from '@/components/dashboard/StatCard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { BookOpen, TrendingUp, Award, Download, MessageSquare, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockMarks, mockSubjects } from '@/data/mockData';

const performanceData = [
  { name: 'Math', value: 86 },
  { name: 'Science', value: 77 },
  { name: 'English', value: 72 },
  { name: 'History', value: 68 },
  { name: 'Geography', value: 75 },
];

const studentMarks = [
  { subject: 'Mathematics', test1: 18, test2: 17, assignment: 9, exam: 42, total: 86, grade: 'A' },
  { subject: 'Science', test1: 15, test2: 16, assignment: 8, exam: 38, total: 77, grade: 'A' },
  { subject: 'English', test1: 16, test2: 14, assignment: 7, exam: 35, total: 72, grade: 'B' },
  { subject: 'History', test1: 14, test2: 13, assignment: 7, exam: 34, total: 68, grade: 'B' },
  { subject: 'Geography', test1: 15, test2: 16, assignment: 8, exam: 36, total: 75, grade: 'A' },
];

export function ParentDashboard() {
  // Mock data for the parent's child
  const childName = "Alex Smith";
  const childClass = "10-A";
  const overallAverage = 75.6;
  const classRank = 3;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Parent Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Viewing academic records for <span className="font-semibold text-primary">{childName}</span>
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
            <p className="text-muted-foreground">Class {childClass} • Roll No. 001</p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Academic Year 2024-2025</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-warning" />
                <span className="text-sm text-muted-foreground">Class Rank: <span className="font-semibold text-card-foreground">#{classRank}</span></span>
              </div>
            </div>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm text-muted-foreground">Overall Average</p>
            <p className="text-4xl font-bold font-display gradient-text">{overallAverage.toFixed(1)}%</p>
            <GradeBadge grade="A" size="lg" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Subjects"
          value="5"
          subtitle="Enrolled subjects"
          icon={BookOpen}
          variant="primary"
        />
        <StatCard
          title="Best Subject"
          value="Math"
          subtitle="86% average"
          icon={Award}
          variant="success"
        />
        <StatCard
          title="Class Rank"
          value={`#${classRank}`}
          subtitle="Out of 32 students"
          icon={TrendingUp}
          trend={{ value: 2, isPositive: true }}
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

      {/* Performance Chart and Recent Grades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PerformanceChart 
            data={performanceData} 
            title="Subject-wise Performance" 
          />
        </div>
        
        {/* Quick Stats */}
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Grade Distribution</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Grade A</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: '60%' }} />
                </div>
                <span className="text-sm font-medium text-card-foreground">3</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Grade B</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '40%' }} />
                </div>
                <span className="text-sm font-medium text-card-foreground">2</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Grade C</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-warning rounded-full" style={{ width: '0%' }} />
                </div>
                <span className="text-sm font-medium text-card-foreground">0</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Term Performance</p>
              <p className="text-3xl font-bold font-display text-success">Excellent</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Marks Table */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground">Term 1 - Detailed Marks</h3>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Test 1 (20)</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Test 2 (20)</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Assignment (10)</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Exam (50)</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Total (100)</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Grade</th>
              </tr>
            </thead>
            <tbody>
              {studentMarks.map((mark, index) => (
                <tr key={index} className="border-b border-border/50 table-row-hover">
                  <td className="py-4 px-4 font-medium text-card-foreground">{mark.subject}</td>
                  <td className="py-4 px-4 text-center text-card-foreground">{mark.test1}</td>
                  <td className="py-4 px-4 text-center text-card-foreground">{mark.test2}</td>
                  <td className="py-4 px-4 text-center text-card-foreground">{mark.assignment}</td>
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
                <td colSpan={4}></td>
                <td className="py-4 px-4 text-center font-bold text-xl text-primary">{overallAverage.toFixed(1)}</td>
                <td className="py-4 px-4 text-center">
                  <GradeBadge grade="A" size="lg" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
