import { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { TopStudents } from '@/components/dashboard/TopStudents';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { ClipboardList, Users, TrendingUp, CheckCircle, Clock, BookOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { mockStudents, mockSubjects } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';

const performanceData = [
  { name: 'Test 1', value: 72, average: 68 },
  { name: 'Test 2', value: 78, average: 71 },
  { name: 'Assignment', value: 85, average: 76 },
  { name: 'Exam', value: 74, average: 70 },
];

const topStudents = [
  { rank: 1, name: 'Emma Davis', class: '10-A', average: 94, grade: 'A' },
  { rank: 2, name: 'Alex Smith', class: '10-A', average: 86, grade: 'A' },
  { rank: 3, name: 'Sophia Brown', class: '10-B', average: 75, grade: 'A' },
];

const pendingClasses = [
  { class: '10-A', subject: 'Mathematics', students: 32, status: 'pending' },
  { class: '10-B', subject: 'Mathematics', students: 30, status: 'completed' },
  { class: '9-A', subject: 'Mathematics', students: 35, status: 'pending' },
];

export function TeacherDashboard() {
  const [selectedClass, setSelectedClass] = useState('10-A');
  const navigate = useNavigate();

  const assignedClasses = ['10-A', '10-B', '9-A'];
  const studentsInClass = mockStudents.filter(s => s.class === selectedClass);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, Sarah! Here's your class overview.</p>
        </div>
        <Button 
          className="btn-gradient"
          onClick={() => navigate('/marks-entry')}
        >
          <ClipboardList className="w-4 h-4 mr-2" />
          Enter Marks
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="My Classes"
          value="3"
          subtitle="Assigned classes"
          icon={BookOpen}
          variant="primary"
        />
        <StatCard
          title="Total Students"
          value="97"
          subtitle="Across all classes"
          icon={Users}
          variant="accent"
        />
        <StatCard
          title="Marks Submitted"
          value="1"
          subtitle="Out of 3 classes"
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Pending"
          value="2"
          subtitle="Classes remaining"
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Class Selector and Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PerformanceChart 
            data={performanceData} 
            title={`Class ${selectedClass} Performance - Mathematics`}
          />
        </div>
        
        <div className="space-y-6">
          {/* Class Selector */}
          <div className="card-elevated p-6 animate-fade-in">
            <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Select Class</h3>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {assignedClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-4 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Students in class</p>
              <p className="text-2xl font-bold text-card-foreground">{studentsInClass.length}</p>
            </div>
          </div>

          <TopStudents 
            students={topStudents} 
            title={`Top Students - ${selectedClass}`}
          />
        </div>
      </div>

      {/* Marks Entry Status */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Marks Entry Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Class</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Students</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingClasses.map((item, index) => (
                <tr key={index} className="border-b border-border/50 table-row-hover">
                  <td className="py-4 px-4 font-medium text-card-foreground">{item.class}</td>
                  <td className="py-4 px-4 text-card-foreground">{item.subject}</td>
                  <td className="py-4 px-4 text-card-foreground">{item.students}</td>
                  <td className="py-4 px-4">
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        <CheckCircle className="w-3 h-3" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Button 
                      variant={item.status === 'completed' ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => navigate('/marks-entry')}
                    >
                      {item.status === 'completed' ? 'View' : 'Enter Marks'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
