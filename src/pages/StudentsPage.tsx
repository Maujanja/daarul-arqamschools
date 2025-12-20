import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, MoreHorizontal, GraduationCap, Calendar, Loader2, Download, FileText } from 'lucide-react';
import { generateStudentReportPDF, generateAllStudentsReportPDF } from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { calculateGrade, Grade } from '@/types';

interface Student {
  id: string;
  full_name: string;
  class: string;
  roll_number: string;
  admission_date: string;
  parent_id: string | null;
}

interface StudentWithMarks extends Student {
  averageMarks: number;
  grade: Grade;
}

export default function StudentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState<StudentWithMarks[]>([]);
  const [classes, setClasses] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .order('full_name');

      if (studentsError) throw studentsError;

      // Fetch all marks
      const { data: marksData, error: marksError } = await supabase
        .from('marks')
        .select('student_id, total');

      if (marksError) throw marksError;

      // Calculate average for each student
      const studentsWithMarks: StudentWithMarks[] = (studentsData || []).map(student => {
        const studentMarks = marksData?.filter(m => m.student_id === student.id) || [];
        const averageMarks = studentMarks.length > 0
          ? Math.round(studentMarks.reduce((sum, m) => sum + m.total, 0) / studentMarks.length)
          : 0;
        const grade = calculateGrade(averageMarks);

        return {
          ...student,
          averageMarks,
          grade
        };
      });

      setStudents(studentsWithMarks);

      // Extract unique classes
      const uniqueClasses = [...new Set(studentsData?.map(s => s.class) || [])].sort();
      setClasses(['all', ...uniqueClasses]);

    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.roll_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.class === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleDownloadStudentReport = async (student: StudentWithMarks) => {
    try {
      // Fetch marks with subject details for this student
      const { data: marksData, error } = await supabase
        .from('marks')
        .select(`
          total,
          grade,
          term,
          academic_year,
          subject_id,
          subjects (name)
        `)
        .eq('student_id', student.id);

      if (error) throw error;

      const subjects = (marksData || []).map((m: any) => ({
        name: m.subjects?.name || 'Unknown Subject',
        marks: m.total,
        grade: m.grade,
      }));

      const term = marksData?.[0]?.term || 'Term 1';
      const academicYear = marksData?.[0]?.academic_year || '2024-2025';

      generateStudentReportPDF({
        fullName: student.full_name,
        rollNumber: student.roll_number,
        className: student.class,
        admissionDate: new Date(student.admission_date).toLocaleDateString(),
        subjects,
        averageMarks: student.averageMarks,
        overallGrade: student.grade,
        term,
        academicYear,
      });

      toast.success('Ripoti imepakuliwa!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Imeshindikana kupakua ripoti');
    }
  };

  const handleDownloadAllReports = () => {
    const studentsData = filteredStudents.map(s => ({
      name: s.full_name,
      rollNumber: s.roll_number,
      className: s.class,
      average: s.averageMarks,
      grade: s.grade,
    }));

    generateAllStudentsReportPDF(studentsData, 'Term 1', '2024-2025');
    toast.success('Ripoti ya wanafunzi wote imepakuliwa!');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Students</h1>
            <p className="text-muted-foreground mt-1">Manage student records and view academic information</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadAllReports}>
              <Download className="w-4 h-4 mr-2" />
              Export All PDF
            </Button>
            <Button className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="card-elevated p-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search by name or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-enhanced"
              />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.slice(1).map((cls) => (
                  <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Students Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student, index) => (
            <div 
              key={student.id} 
              className="card-elevated p-6 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {student.full_name.split(' ').map(n => n[0]).join('')}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Profile</DropdownMenuItem>
                    <DropdownMenuItem>View Marks</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownloadStudentReport(student)}>
                      <FileText className="w-4 h-4 mr-2" />
                      Download Report
                    </DropdownMenuItem>
                    <DropdownMenuItem>Edit Details</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="font-display font-semibold text-lg text-card-foreground mb-1">{student.full_name}</h3>
              <p className="text-sm text-muted-foreground mb-4">Roll No: {student.roll_number}</p>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Class:</span>
                  <span className="font-medium text-card-foreground">{student.class}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Admission:</span>
                  <span className="font-medium text-card-foreground">{new Date(student.admission_date).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="font-bold text-primary">{student.averageMarks}%</p>
                </div>
                <GradeBadge grade={student.grade} />
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredStudents.length === 0 && (
          <div className="card-elevated p-12 text-center animate-fade-in">
            <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">No students found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
