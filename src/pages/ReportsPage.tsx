import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { TopStudents } from '@/components/dashboard/TopStudents';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Users, BookOpen, TrendingUp, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const gradeDistribution = [
  { name: 'Grade A', value: 25, color: 'hsl(var(--success))' },
  { name: 'Grade B', value: 35, color: 'hsl(var(--primary))' },
  { name: 'Grade C', value: 20, color: 'hsl(var(--warning))' },
  { name: 'Grade D', value: 12, color: 'hsl(var(--chart-4))' },
  { name: 'Grade F', value: 8, color: 'hsl(var(--destructive))' },
];

const subjectPerformance = [
  { name: 'Math', average: 72, highest: 94, lowest: 38 },
  { name: 'Science', average: 68, highest: 89, lowest: 35 },
  { name: 'English', average: 75, highest: 92, lowest: 42 },
  { name: 'History', average: 70, highest: 88, lowest: 40 },
  { name: 'Geography', average: 73, highest: 90, lowest: 45 },
];

const classComparison = [
  { name: '10-A', value: 76 },
  { name: '10-B', value: 72 },
  { name: '9-A', value: 74 },
  { name: '9-B', value: 70 },
];

const topStudents = [
  { rank: 1, name: 'Emma Davis', class: '10-A', average: 94, grade: 'A' },
  { rank: 2, name: 'Alex Smith', class: '10-A', average: 86, grade: 'A' },
  { rank: 3, name: 'Sophia Brown', class: '10-B', average: 75, grade: 'A' },
  { rank: 4, name: 'James Wilson', class: '10-A', average: 70, grade: 'B' },
  { rank: 5, name: 'Olivia Johnson', class: '9-A', average: 68, grade: 'B' },
];

const bottomStudents = [
  { rank: 1, name: 'Oliver Taylor', class: '10-B', average: 38, grade: 'F' },
  { rank: 2, name: 'Liam Anderson', class: '9-B', average: 42, grade: 'D' },
  { rank: 3, name: 'Mason Garcia', class: '10-A', average: 45, grade: 'D' },
];

export default function ReportsPage() {
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedYear, setSelectedYear] = useState('2024-2025');

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">View comprehensive academic reports and performance analysis</p>
          </div>
          <Button className="btn-gradient">
            <Download className="w-4 h-4 mr-2" />
            Export All Reports
          </Button>
        </div>

        {/* Filters */}
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Filter Reports</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="10-A">Class 10-A</SelectItem>
                  <SelectItem value="10-B">Class 10-B</SelectItem>
                  <SelectItem value="9-A">Class 9-A</SelectItem>
                  <SelectItem value="9-B">Class 9-B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Term</label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Term 1">Term 1</SelectItem>
                  <SelectItem value="Term 2">Term 2</SelectItem>
                  <SelectItem value="Term 3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Academic Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024-2025">2024-2025</SelectItem>
                  <SelectItem value="2023-2024">2023-2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Report Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-card">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="class" className="data-[state=active]:bg-card">
              <Users className="w-4 h-4 mr-2" />
              Class Reports
            </TabsTrigger>
            <TabsTrigger value="subject" className="data-[state=active]:bg-card">
              <BookOpen className="w-4 h-4 mr-2" />
              Subject Analysis
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Grade Distribution */}
              <div className="card-elevated p-6 animate-fade-in">
                <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Grade Distribution</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gradeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {gradeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Class Comparison */}
              <div className="card-elevated p-6 animate-fade-in">
                <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Class Comparison</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Average %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top and Bottom Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopStudents students={topStudents} title="Top Performers" />
              <TopStudents students={bottomStudents.map((s, i) => ({ ...s, rank: i + 1 }))} title="Needs Improvement" />
            </div>
          </TabsContent>

          {/* Class Reports Tab */}
          <TabsContent value="class" className="space-y-6">
            <div className="card-elevated p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-semibold text-lg text-card-foreground">Class Performance Summary</h3>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Class</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Students</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Average</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Highest</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Lowest</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Pass Rate</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { class: '10-A', students: 32, average: 76, highest: 94, lowest: 38, passRate: 94 },
                      { class: '10-B', students: 30, average: 72, highest: 88, lowest: 35, passRate: 90 },
                      { class: '9-A', students: 35, average: 74, highest: 90, lowest: 40, passRate: 92 },
                      { class: '9-B', students: 33, average: 70, highest: 86, lowest: 36, passRate: 88 },
                    ].map((row, index) => (
                      <tr key={index} className="border-b border-border/50 table-row-hover">
                        <td className="py-4 px-4 font-medium text-card-foreground">{row.class}</td>
                        <td className="py-4 px-4 text-center text-card-foreground">{row.students}</td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-semibold text-primary">{row.average}%</span>
                        </td>
                        <td className="py-4 px-4 text-center text-success font-medium">{row.highest}%</td>
                        <td className="py-4 px-4 text-center text-destructive font-medium">{row.lowest}%</td>
                        <td className="py-4 px-4 text-center">
                          <span className={`font-medium ${row.passRate >= 90 ? 'text-success' : 'text-warning'}`}>
                            {row.passRate}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Button variant="ghost" size="sm">
                            <FileText className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Subject Analysis Tab */}
          <TabsContent value="subject" className="space-y-6">
            <PerformanceChart 
              data={subjectPerformance.map(s => ({ name: s.name, value: s.average }))} 
              title="Subject-wise Average Performance"
            />

            <div className="card-elevated p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-semibold text-lg text-card-foreground">Subject Analysis</h3>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Class Average</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Highest Score</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Lowest Score</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Mode Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectPerformance.map((subject, index) => (
                      <tr key={index} className="border-b border-border/50 table-row-hover">
                        <td className="py-4 px-4 font-medium text-card-foreground">{subject.name}</td>
                        <td className="py-4 px-4 text-center font-semibold text-primary">{subject.average}%</td>
                        <td className="py-4 px-4 text-center text-success">{subject.highest}%</td>
                        <td className="py-4 px-4 text-center text-destructive">{subject.lowest}%</td>
                        <td className="py-4 px-4 text-center">
                          <GradeBadge grade={subject.average >= 75 ? 'A' : subject.average >= 65 ? 'B' : 'C'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
