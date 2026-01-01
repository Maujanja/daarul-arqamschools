import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { TopStudents } from '@/components/dashboard/TopStudents';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Users, BookOpen, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { generateClassReportPDF, generateAllStudentsReportPDF } from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import { calculateGrade } from '@/types';
import { terms } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { isSubjectForClass } from '@/utils/classSubjects';
import { useAcademicYears } from '@/hooks/useAcademicYears';

export default function ReportsPage() {
  const { user } = useAuth();
  const { academicYears, currentYear } = useAcademicYears();
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState(terms[0] || 'Series 1');
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Update selectedYear when currentYear is loaded
  useEffect(() => {
    if (currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);
  
  const [loading, setLoading] = useState(false);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [classStats, setClassStats] = useState<any[]>([]);
  const [subjectsData, setSubjectsData] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  
  const isTeacher = user?.role === 'teacher';

  // Computed data from studentsData
  const gradeDistribution = useMemo(() => {
    if (studentsData.length === 0) return [];
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    studentsData.forEach(s => {
      if (s.grade in grades) grades[s.grade as keyof typeof grades]++;
    });
    return [
      { name: 'Grade A', value: grades.A, color: 'hsl(var(--success))' },
      { name: 'Grade B', value: grades.B, color: 'hsl(var(--primary))' },
      { name: 'Grade C', value: grades.C, color: 'hsl(var(--warning))' },
      { name: 'Grade D', value: grades.D, color: 'hsl(var(--chart-4))' },
      { name: 'Grade F', value: grades.F, color: 'hsl(var(--destructive))' },
    ].filter(g => g.value > 0);
  }, [studentsData]);

  const classComparison = useMemo(() => {
    return classStats.map(c => ({ name: c.class, value: c.average }));
  }, [classStats]);

  const topStudents = useMemo(() => {
    return studentsData
      .filter(s => s.average > 0)
      .sort((a, b) => b.average - a.average)
      .slice(0, 5)
      .map((s, i) => ({
        rank: i + 1,
        name: s.full_name,
        class: s.class,
        average: s.average,
        grade: s.grade,
      }));
  }, [studentsData]);

  const bottomStudents = useMemo(() => {
    return studentsData
      .filter(s => s.average > 0 && s.average < 50)
      .sort((a, b) => a.average - b.average)
      .slice(0, 5)
      .map((s, i) => ({
        rank: i + 1,
        name: s.full_name,
        class: s.class,
        average: s.average,
        grade: s.grade,
      }));
  }, [studentsData]);

  useEffect(() => {
    fetchReportData();
  }, [selectedClass, selectedTerm, selectedYear, user]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      let teacherClasses: string[] = [];
      let teacherSubjectIds: string[] = [];
      
      // If teacher, get their assigned classes and subjects
      if (isTeacher && user) {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('classes, subjects')
          .eq('id', user.id)
          .maybeSingle();
        
        if (teacher) {
          teacherClasses = teacher.classes || [];
          
          // Get subject IDs that match teacher's subject names
          if (teacher.subjects && teacher.subjects.length > 0) {
            const { data: allSubjects } = await supabase.from('subjects').select('*');
            if (allSubjects) {
              teacherSubjectIds = allSubjects
                .filter(s => teacher.subjects.some((name: string) => 
                  s.name.toLowerCase().includes(name.toLowerCase()) ||
                  name.toLowerCase().includes(s.name.toLowerCase())
                ))
                .map(s => s.id);
            }
          }
        }
      }

      // Fetch students - filter by teacher's classes if teacher
      let studentsQuery = supabase.from('students').select('*');
      if (isTeacher && teacherClasses.length > 0) {
        studentsQuery = studentsQuery.in('class', teacherClasses);
      }
      const { data: students, error: studentsError } = await studentsQuery;

      if (studentsError) throw studentsError;
      
      // Set available classes based on fetched students
      const uniqueClasses = [...new Set(students?.map(s => s.class) || [])].sort();
      setAvailableClasses(uniqueClasses);

      // Fetch marks - filter by term, year, class, and teacher's subjects if teacher
      // Also apply .limit() to get more than default 1000 rows
      let marksQuery = supabase.from('marks').select('*')
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYear);
      
      // Filter by selected class if not 'all'
      if (selectedClass !== 'all') {
        marksQuery = marksQuery.eq('class', selectedClass);
      }
      
      if (isTeacher && teacherSubjectIds.length > 0) {
        marksQuery = marksQuery.in('subject_id', teacherSubjectIds);
      }
      if (isTeacher && teacherClasses.length > 0) {
        marksQuery = marksQuery.in('class', teacherClasses);
      }
      
      // Increase limit to get all marks (default is 1000)
      marksQuery = marksQuery.limit(10000);
      
      const { data: marks, error: marksError } = await marksQuery;

      if (marksError) throw marksError;

      // Fetch subjects - filter by teacher's subjects if teacher
      let subjectsQuery = supabase.from('subjects').select('*');
      if (isTeacher && teacherSubjectIds.length > 0) {
        subjectsQuery = subjectsQuery.in('id', teacherSubjectIds);
      }
      const { data: subjects, error: subjectsError } = await subjectsQuery;

      if (subjectsError) throw subjectsError;

      // Filter students based on selected class
      const filteredStudents = selectedClass === 'all' 
        ? (students || [])
        : (students || []).filter(s => s.class === selectedClass);

      // Filter marks based on selected class
      const filteredMarks = selectedClass === 'all'
        ? (marks || [])
        : (marks || []).filter(m => m.class === selectedClass);

      // Calculate student averages using filtered data
      const studentsWithAvg = filteredStudents.map(student => {
        const studentMarks = filteredMarks.filter(m => m.student_id === student.id);
        const average = studentMarks.length > 0
          ? Math.round(studentMarks.reduce((sum, m) => sum + m.total, 0) / studentMarks.length)
          : 0;
        return {
          ...student,
          average,
          grade: calculateGrade(average),
        };
      });

      setStudentsData(studentsWithAvg);

      // Calculate class statistics using filtered data
      const classesToAnalyze = selectedClass === 'all' 
        ? [...new Set(students?.map(s => s.class) || [])]
        : [selectedClass];
      
      const stats = classesToAnalyze.map(cls => {
        const classStudents = studentsWithAvg.filter(s => s.class === cls);
        const averages = classStudents.map(s => s.average).filter(a => a > 0);
        return {
          class: cls,
          students: classStudents.length,
          average: averages.length > 0 ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length) : 0,
          highest: Math.max(...averages, 0),
          lowest: averages.length > 0 ? Math.min(...averages.filter(a => a > 0)) : 0,
          passRate: averages.length > 0 
            ? Math.round((averages.filter(a => a >= 40).length / averages.length) * 100) 
            : 0,
        };
      });

      setClassStats(stats);

      // Calculate subject statistics - filter by class subjects and remove duplicates
      let filteredSubjects = subjects || [];
      
      if (selectedClass !== 'all') {
        // Filter subjects that belong to the selected class
        filteredSubjects = (subjects || []).filter(s => isSubjectForClass(s.name, selectedClass));
        
        // Remove duplicate subject names (keep first occurrence)
        const uniqueNames = new Set<string>();
        filteredSubjects = filteredSubjects.filter(s => {
          const nameLower = s.name.toLowerCase().trim();
          if (uniqueNames.has(nameLower)) {
            return false;
          }
          uniqueNames.add(nameLower);
          return true;
        });
      }

      // Group marks by subject name to handle duplicate subject IDs
      const subjectStats = filteredSubjects.map(subject => {
        // Get all subject IDs with the same name
        const sameNameSubjectIds = (subjects || [])
          .filter(s => s.name.toLowerCase().trim() === subject.name.toLowerCase().trim())
          .map(s => s.id);
        
        // Get marks for all matching subject IDs
        const subjectMarks = filteredMarks.filter(m => sameNameSubjectIds.includes(m.subject_id));
        const totals = subjectMarks.map(m => m.total).filter(t => t > 0);
        
        return {
          name: subject.name,
          average: totals.length > 0 ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
          highest: totals.length > 0 ? Math.max(...totals) : 0,
          lowest: totals.length > 0 ? Math.min(...totals) : 0,
        };
      });

      setSubjectsData(subjectStats);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllReports = () => {
    const data = studentsData.map(s => ({
      name: s.full_name,
      rollNumber: s.roll_number,
      className: s.class,
      average: s.average,
      grade: s.grade,
    }));

    generateAllStudentsReportPDF(data, selectedTerm, selectedYear);
    toast.success('All reports downloaded!');
  };

  const handleDownloadClassReport = (classData: any) => {
    const classStudents = studentsData
      .filter(s => s.class === classData.class)
      .sort((a, b) => b.average - a.average)
      .map((s, index) => ({
        rank: index + 1,
        name: s.full_name,
        rollNumber: s.roll_number,
        average: s.average,
        grade: s.grade,
      }));

    generateClassReportPDF({
      className: classData.class,
      term: selectedTerm,
      academicYear: selectedYear,
      students: classStudents,
      classAverage: classData.average,
      highestScore: classData.highest,
      lowestScore: classData.lowest,
      passRate: classData.passRate,
    });

    toast.success(`${classData.class} report downloaded!`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">View comprehensive academic reports and performance analysis</p>
          </div>
          <Button className="btn-gradient" onClick={handleExportAllReports} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
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
                  {availableClasses.map((cls) => (
                    <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                  ))}
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
                  {terms.map((term) => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
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
                  {academicYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
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
                  {gradeDistribution.length > 0 ? (
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
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Class Comparison */}
              <div className="card-elevated p-6 animate-fade-in">
                <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Class Comparison</h3>
                <div className="h-[300px]">
                  {classComparison.length > 0 ? (
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
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top and Bottom Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopStudents students={topStudents} title="Top Performers" />
              <TopStudents students={bottomStudents} title="Need Support" />
            </div>
          </TabsContent>

          {/* Class Reports Tab */}
          <TabsContent value="class" className="space-y-6">
            <div className="card-elevated p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-semibold text-lg text-card-foreground">Class Performance Summary</h3>
                <Button variant="outline" size="sm" onClick={() => handleExportAllReports()}>
                  <Download className="w-4 h-4 mr-2" />
                  Download All PDF
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
                    {classStats.length > 0 ? classStats.map((row, index) => (
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
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadClassReport(row)}>
                            <FileText className="w-4 h-4 mr-1" />
                            PDF
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          No class data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Subject Analysis Tab */}
          <TabsContent value="subject" className="space-y-6">
            <PerformanceChart 
              data={subjectsData.map(s => ({ name: s.name, value: s.average }))} 
              title="Subject Performance"
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
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Average</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Highest</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Lowest</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectsData.length > 0 ? subjectsData.map((subject, index) => (
                      <tr key={index} className="border-b border-border/50 table-row-hover">
                        <td className="py-4 px-4 font-medium text-card-foreground">{subject.name}</td>
                        <td className="py-4 px-4 text-center font-semibold text-primary">{subject.average}%</td>
                        <td className="py-4 px-4 text-center text-success">{subject.highest}%</td>
                        <td className="py-4 px-4 text-center text-destructive">{subject.lowest}%</td>
                        <td className="py-4 px-4 text-center">
                          <GradeBadge grade={subject.average >= 75 ? 'A' : subject.average >= 65 ? 'B' : 'C'} />
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No subject data available
                        </td>
                      </tr>
                    )}
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
