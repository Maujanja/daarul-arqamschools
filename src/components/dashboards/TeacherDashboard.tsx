import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, ClipboardList, Loader2, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { terms } from '@/data/mockData';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { SeriesSummaryTable } from '@/components/dashboard/SeriesSummaryTable';
import { SeriesPerformanceChart } from '@/components/dashboard/SeriesPerformanceChart';
import { getTestDisplayName, getTestsForClass, getFilterLabel } from '@/utils/seniorGrading';

interface TeacherInfo {
  id: string;
  full_name: string;
  classes: string[];
  subjects: string[];
}

interface StudentCount {
  class: string;
  count: number;
}

interface Mark {
  student_id: string;
  term: string;
  total: number;
  grade: string;
  class: string;
  students: {
    id: string;
    full_name: string;
    class: string;
  };
}

interface StudentNeedingSupport {
  id: string;
  full_name: string;
  class: string;
  average: number;
  grade: string;
}

interface SeriesData {
  name: string;
  [key: string]: number | string | null;
}

interface ClassSeriesData {
  className: string;
  data: SeriesData[];
  seriesKeys: string[];
}

export function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchTable, fetchAllPaginated, count } = useSecureQuery();
  const { academicYears, currentYear, loading: yearsLoading } = useAcademicYears();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [studentCounts, setStudentCounts] = useState<StudentCount[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(terms[0] || 'Series 1');
  const [selectedYear, setSelectedYear] = useState('');
  const [studentsNeedingSupport, setStudentsNeedingSupport] = useState<StudentNeedingSupport[]>([]);
  const [seriesSummaryData, setSeriesSummaryData] = useState<any[]>([]);
  const [seriesLabels, setSeriesLabels] = useState<string[]>([]);
  const [classPerformanceData, setClassPerformanceData] = useState<ClassSeriesData[]>([]);

  // Set initial year when academic years load
  useEffect(() => {
    if (currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);

  const fetchData = useCallback(async () => {
    if (!user) {
      console.log('TeacherDashboard: No user found');
      setError('Please login first');
      setIsLoading(false);
      return;
    }

    if (!selectedYear) {
      console.log('TeacherDashboard: Waiting for selectedYear');
      return;
    }

    console.log('TeacherDashboard: Fetching for user:', user.id, 'year:', selectedYear);
    setIsLoading(true);
    setError(null);

    try {
      // Fetch teacher data using secure query
      const teachersData = await fetchTable<TeacherInfo>('teachers', { id: user.id });
      const teacherData = teachersData?.[0] || null;

      console.log('TeacherDashboard: Teacher result:', { teacherData });

      if (!teacherData) {
        console.log('TeacherDashboard: No teacher found for ID:', user.id);
        setError('Teacher information not found');
        setIsLoading(false);
        return;
      }

      setTeacher(teacherData);

      // Count students per class and fetch marks
      if (teacherData.classes && teacherData.classes.length > 0) {
        const counts: StudentCount[] = [];
        for (const cls of teacherData.classes) {
          const studentCount = await count('students', { class: cls });
          counts.push({ class: cls, count: studentCount || 0 });
        }
        setStudentCounts(counts);

        // Fetch marks for all assigned classes using secure query with pagination
        const marksData = await fetchAllPaginated<any>('marks', { 
          class: teacherData.classes, 
          academic_year: selectedYear 
        });

        // We need to also fetch students separately to join the data
        const studentsData = await fetchTable<any>('students', { class: teacherData.classes });

        if (marksData && marksData.length > 0) {
          // Build a lookup map for student info
          const studentMap = new Map(studentsData?.map((s: any) => [s.id, s]) || []);
          
          // Calculate students needing support (average < 45)
          const studentTotals: Record<string, { name: string; class: string; total: number; count: number }> = {};
          
          marksData.forEach((mark: any) => {
            const studentId = mark.student_id;
            const student = studentMap.get(studentId);
            if (!studentTotals[studentId]) {
              studentTotals[studentId] = {
                name: student?.full_name || 'Unknown',
                class: student?.class || mark.class,
                total: 0,
                count: 0
              };
            }
            studentTotals[studentId].total += mark.total;
            studentTotals[studentId].count += 1;
          });

          const needingSupport: StudentNeedingSupport[] = Object.entries(studentTotals)
            .map(([id, data]) => ({
              id,
              full_name: data.name,
              class: data.class,
              average: data.count > 0 ? Math.round(data.total / data.count) : 0,
              grade: getGrade(data.count > 0 ? data.total / data.count : 0)
            }))
            .filter(student => student.average < 45)
            .sort((a, b) => a.average - b.average)
            .slice(0, 10);

          setStudentsNeedingSupport(needingSupport);

          // Calculate series summary for all classes using all 11 series
          const allSeriesLabels = ['Series 1', 'Series 2', 'Series 3', 'Series 4', 'Series 5', 'Series 6', 'Series 7', 'Series 8', 'Series 9', 'Series 10', 'Series 11'];
          const classSummary: any[] = [];
          
          console.log('TeacherDashboard: Processing marks for series summary', { marksCount: marksData.length, classes: teacherData.classes });
          
          teacherData.classes.forEach((cls: string) => {
            const classMarks = marksData.filter((m: any) => m.class === cls);
            const seriesAverages: Record<string, number | null> = {};
            
            console.log(`TeacherDashboard: Class ${cls} marks count:`, classMarks.length);
            
            allSeriesLabels.forEach((term, idx) => {
              const termMarks = classMarks.filter((m: any) => m.term === term);
              if (termMarks.length > 0) {
                const avg = termMarks.reduce((sum: number, m: any) => sum + m.total, 0) / termMarks.length;
                seriesAverages[`S${idx + 1}`] = Math.round(avg * 10) / 10;
              } else {
                seriesAverages[`S${idx + 1}`] = null;
              }
            });
            
            const validAverages = Object.values(seriesAverages).filter(v => v !== null) as number[];
            const overallAvg = validAverages.length > 0 
              ? Math.round(validAverages.reduce((a, b) => a + b, 0) / validAverages.length * 10) / 10
              : null;

            classSummary.push({
              sn: classSummary.length + 1,
              name: cls,
              seriesData: seriesAverages,
              average: overallAvg,
              grade: overallAvg ? getGrade(overallAvg) : '-'
            });
          });

          setSeriesSummaryData(classSummary);
          setSeriesLabels(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11']);

          // Build performance trend chart data from the classSummary data
          const seriesLabelsForChart = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11'];
          const classChartData: ClassSeriesData[] = classSummary.map((classItem: any) => {
            const chartData: SeriesData[] = seriesLabelsForChart.map(series => {
              const value = classItem.seriesData[series];
              return {
                name: series,
                Average: typeof value === 'number' ? value : null
              };
            });
            
            return {
              className: classItem.name,
              data: chartData,
              seriesKeys: ['Average']
            };
          });

          setClassPerformanceData(classChartData);
        }
      }

      console.log('TeacherDashboard: Success!');
    } catch (err: any) {
      console.error('TeacherDashboard: Catch error:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedYear, fetchTable, count]);

  const getGrade = (score: number): string => {
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 45) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  };

  // Refetch data when selectedYear or selectedTerm changes
  useEffect(() => {
    if (selectedYear) {
      fetchData();
    }
  }, [user, selectedYear, selectedTerm]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-16 h-16 text-destructive" />
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // No teacher data
  if (!teacher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Users className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Data Not Found</h2>
        <p className="text-muted-foreground text-center">
          Could not retrieve your information. Please contact Admin.
        </p>
      </div>
    );
  }

  const totalStudents = studentCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Welcome, {teacher.full_name}
        </h1>
        <p className="text-muted-foreground mt-1">Teacher Dashboard</p>
      </div>

      {/* Term and Year Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Series</label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select series" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((term) => (
                    <SelectItem key={term} value={term}>Series {term.replace(/\D/g, '')}</SelectItem>
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
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Classes
            </CardTitle>
            <ClipboardList className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teacher.classes?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {teacher.classes?.join(', ') || 'None assigned'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students
            </CardTitle>
            <Users className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">In your classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Subjects
            </CardTitle>
            <BookOpen className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teacher.subjects?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {teacher.subjects?.join(', ') || 'None assigned'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Classes breakdown */}
      {studentCounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Students per Class</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {studentCounts.map((item) => (
                <div key={item.class} className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{item.count}</p>
                  <p className="text-sm text-muted-foreground">{item.class}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Series Summary Table */}
      {seriesSummaryData.length > 0 && (
        <SeriesSummaryTable
          title="Series Summary - All Classes"
          subtitle={`Academic Year: ${selectedYear}`}
          data={seriesSummaryData}
          seriesLabels={seriesLabels}
          showPosition={false}
          showAveragePerSeries={true}
          showSeriesSelector={true}
          pdfFileName={`teacher_series_summary_${selectedYear}`}
        />
      )}

      {/* General Performance Trend Charts per Class */}
      {classPerformanceData.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">General Performance Trend</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {classPerformanceData.map((classData) => (
              <SeriesPerformanceChart
                key={classData.className}
                data={classData.data}
                title={`${classData.className} - General Performance Trend`}
                seriesKeys={classData.seriesKeys}
                colors={['hsl(var(--primary))']}
                pdfFileName={`${classData.className}_performance_trend_${selectedYear}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Students Needing Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Students Needing Support
          </CardTitle>
        </CardHeader>
        <CardContent>
          {studentsNeedingSupport.length > 0 ? (
            <div className="space-y-3">
              {studentsNeedingSupport.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <p className="font-medium">{student.full_name}</p>
                    <p className="text-sm text-muted-foreground">{student.class}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-destructive">{student.average}%</p>
                    <p className="text-sm text-muted-foreground">Grade: {student.grade}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>No students currently need additional support</p>
              <p className="text-sm mt-1">Students with average below 45% will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate('/marks-entry')}>
              Enter Marks
            </Button>
            <Button variant="outline" onClick={() => navigate('/my-students')}>
              View Students
            </Button>
            <Button variant="outline" onClick={() => navigate('/feedback')}>
              View Feedback
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
