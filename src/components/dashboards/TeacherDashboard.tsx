import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, ClipboardList, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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

export function TeacherDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [studentCounts, setStudentCounts] = useState<StudentCount[]>([]);

  const fetchData = async () => {
    if (!user) {
      console.log('TeacherDashboard: Hakuna user');
      setError('Tafadhali ingia kwanza');
      setIsLoading(false);
      return;
    }

    console.log('TeacherDashboard: Fetching for user:', user.id, user.name);
    setIsLoading(true);
    setError(null);

    try {
      // Fetch teacher data
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id, full_name, classes, subjects')
        .eq('id', user.id)
        .maybeSingle();

      console.log('TeacherDashboard: Teacher result:', { teacherData, teacherError });

      if (teacherError) {
        console.error('TeacherDashboard: Error:', teacherError);
        setError(`Hitilafu: ${teacherError.message}`);
        setIsLoading(false);
        return;
      }

      if (!teacherData) {
        console.log('TeacherDashboard: No teacher found for ID:', user.id);
        setError('Taarifa za mwalimu hazijapatikana');
        setIsLoading(false);
        return;
      }

      setTeacher(teacherData);

      // Count students per class
      if (teacherData.classes && teacherData.classes.length > 0) {
        const counts: StudentCount[] = [];
        for (const cls of teacherData.classes) {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class', cls);
          
          counts.push({ class: cls, count: count || 0 });
        }
        setStudentCounts(counts);
      }

      console.log('TeacherDashboard: Success!');
    } catch (err: any) {
      console.error('TeacherDashboard: Catch error:', err);
      setError(err.message || 'Hitilafu isiyojulikana');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Inapakia...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-16 h-16 text-destructive" />
        <h2 className="text-xl font-semibold">Hitilafu</h2>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Jaribu Tena
        </Button>
      </div>
    );
  }

  // No teacher data
  if (!teacher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Users className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Taarifa Hazijapatikana</h2>
        <p className="text-muted-foreground text-center">
          Hatukuweza kupata taarifa zako. Wasiliana na Admin.
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
          Karibu, {teacher.full_name}
        </h1>
        <p className="text-muted-foreground mt-1">Teacher Dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Madarasa Yangu
            </CardTitle>
            <ClipboardList className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teacher.classes?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {teacher.classes?.join(', ') || 'Hakuna'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wanafunzi Wote
            </CardTitle>
            <Users className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Katika madarasa yako</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Masomo Yangu
            </CardTitle>
            <BookOpen className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teacher.subjects?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {teacher.subjects?.join(', ') || 'Hakuna'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Classes breakdown */}
      {studentCounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Wanafunzi kwa Darasa</CardTitle>
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

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Vitendo vya Haraka</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => window.location.href = '/marks-entry'}>
              Ingiza Alama
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/my-students'}>
              Tazama Wanafunzi
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/feedback'}>
              Tazama Maoni
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
