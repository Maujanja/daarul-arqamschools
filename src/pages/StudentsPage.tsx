import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { Search, Plus, MoreHorizontal, GraduationCap, Calendar, Loader2, Download, FileText, ArrowRightLeft, Users, Camera, User } from 'lucide-react';
import { generateStudentReportPDF, generateAllStudentsReportPDF } from '@/utils/pdfGenerator';
import { terms } from '@/data/mockData';
import { getStreamsForClass, hasStreams } from '@/utils/classStreams';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { calculateGrade, Grade } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { StudentAvatarUpload } from '@/components/StudentAvatarUpload';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Student {
  id: string;
  full_name: string;
  class: string;
  stream: string | null;
  roll_number: string;
  admission_date: string;
  parent_id: string | null;
  boarding_type: string;
  gender?: string;
  avatar_url?: string | null;
}

interface StudentWithMarks extends Student {
  averageMarks: number;
  grade: Grade;
}

interface Mark {
  student_id: string;
  total: number;
  subject_id: string;
}

interface Teacher {
  id: string;
  classes: string[];
  subjects: string[];
}

interface Subject {
  id: string;
  name: string;
}

interface FeeStructure {
  id: string;
  class: string;
  term: string;
  total_fee: number;
  academic_year: string;
}

interface FeePayment {
  id: string;
  student_id: string;
  amount: number;
  term: string;
  academic_year: string;
}

interface AcademicYear {
  year_name: string;
  is_current: boolean;
}

const ALL_CLASSES = ['Baby Class', 'Kindergarten I', 'Kindergarten II', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7', 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'];

// Map short class codes to full class names used in students table
const mapClassToFullName = (shortCode: string): string => {
  const mapping: Record<string, string> = {
    'BC': 'Baby Class',
    'KG1': 'Kindergarten I',
    'KG2': 'Kindergarten II',
    'N': 'Baby Class',
    'P1': 'Primary 1',
    'P2': 'Primary 2',
    'P3': 'Primary 3',
    'P4': 'Primary 4',
    'P5': 'Primary 5',
    'P6': 'Primary 6',
    'P7': 'Primary 7',
    'S1': 'Senior 1',
    'S2': 'Senior 2',
    'S3': 'Senior 3',
    'S4': 'Senior 4',
  };
  return mapping[shortCode] || shortCode;
};

export default function StudentsPage() {
  const { user } = useAuth();
  const { academicYears, currentYear } = useAcademicYears();
  const { fetchTable, query } = useSecureQuery();
  const { insert, update, remove } = useSecureData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState<StudentWithMarks[]>([]);
  const [classes, setClasses] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkTransferDialog, setShowBulkTransferDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentWithMarks | null>(null);
  const [saving, setSaving] = useState(false);
  const [newStudent, setNewStudent] = useState({
    full_name: '',
    roll_number: '',
    class: '',
    stream: '' as string,
    boarding_type: 'day',
    gender: 'Male',
    admission_date: new Date().toISOString().split('T')[0],
    avatar_url: null as string | null,
  });
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);
  const [newStudentTempId] = useState(() => `temp-${Date.now()}`);
  
  // Bulk transfer state
  const [transferFromClass, setTransferFromClass] = useState('');
  const [transferToClass, setTransferToClass] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const isAdmin = user?.role === 'admin';
  const isSecretary = user?.role === 'secretary';
  const isTeacher = user?.role === 'teacher';
  const canManageStudents = isAdmin || isSecretary;

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      let teacherClasses: string[] = [];
      let teacherSubjectIds: string[] = [];
      
      // If teacher, get their assigned classes and subjects
      if (isTeacher && user) {
        const teacherResult = await query<Teacher>('teachers', {
          filters: { id: user.id },
          limit: 1
        });
        
        if (teacherResult.success && teacherResult.data && teacherResult.data.length > 0) {
          const teacher = teacherResult.data[0];
          teacherClasses = teacher.classes || [];
          
          // Get subject IDs that match teacher's subject names
          if (teacher.subjects && teacher.subjects.length > 0) {
            const allSubjects = await fetchTable<Subject>('subjects');
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

      // Build query based on role
      let studentsData: Student[] = [];
      
      // Teachers only see students from their assigned classes (convert short codes to full names)
      if (isTeacher && teacherClasses.length > 0) {
        const mappedClasses = teacherClasses.map(mapClassToFullName);
        const studentsResult = await query<Student>('students', {
          filters: { class: mappedClasses },
          orderBy: { column: 'full_name', ascending: true }
        });
        if (studentsResult.success && studentsResult.data) {
          studentsData = studentsResult.data;
        }
      } else {
        studentsData = await fetchTable<Student>('students', undefined, {
          orderBy: { column: 'full_name', ascending: true }
        });
      }

      // Get marks - filter by teacher's subjects if teacher
      let marksData: Mark[] = [];
      if (isTeacher && teacherSubjectIds.length > 0) {
        const marksResult = await query<Mark>('marks', {
          select: 'student_id, total, subject_id',
          filters: { subject_id: teacherSubjectIds }
        });
        if (marksResult.success && marksResult.data) {
          marksData = marksResult.data;
        }
      } else {
        marksData = await fetchTable<Mark>('marks', undefined, {
          select: 'student_id, total, subject_id'
        });
      }

      const studentsWithMarks: StudentWithMarks[] = (studentsData || []).map(student => {
        const studentMarks = marksData?.filter(m => m.student_id === student.id) || [];
        const averageMarks = studentMarks.length > 0
          ? Math.round(studentMarks.reduce((sum, m) => sum + m.total, 0) / studentMarks.length)
          : 0;
        const grade = calculateGrade(averageMarks);

        return {
          ...student,
          boarding_type: student.boarding_type || 'day',
          averageMarks,
          grade
        };
      });

      setStudents(studentsWithMarks);

      const uniqueClasses = [...new Set(studentsData?.map(s => s.class) || [])].sort();
      setClasses(['all', ...uniqueClasses]);

    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isTeacher, fetchTable, query]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleAddStudent = async () => {
    if (!newStudent.full_name || !newStudent.roll_number || !newStudent.class) {
      toast.error('Please fill in all required fields');
      return;
    }
    // Stream is required if the class has streams
    if (hasStreams(newStudent.class) && !newStudent.stream) {
      toast.error('Please select a stream for this class');
      return;
    }

    try {
      setSaving(true);

      const result = await insert('students', {
        full_name: newStudent.full_name.trim(),
        roll_number: newStudent.roll_number.trim(),
        class: newStudent.class.trim(),
        stream: newStudent.stream || null,
        boarding_type: newStudent.boarding_type,
        gender: newStudent.gender,
        admission_date: newStudent.admission_date,
        avatar_url: tempAvatarUrl,
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Student added successfully!');
      setShowAddDialog(false);
      setNewStudent({
        full_name: '',
        roll_number: '',
        class: '',
        stream: '',
        boarding_type: 'day',
        gender: 'Male',
        admission_date: new Date().toISOString().split('T')[0],
        avatar_url: null,
      });
      setTempAvatarUrl(null);
      fetchStudents();
    } catch (error: any) {
      console.error('Error adding student:', error);
      toast.error(error.message || 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (student: StudentWithMarks) => {
    setEditingStudent(student);
    setShowEditDialog(true);
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    // Stream is required if the class has streams
    if (hasStreams(editingStudent.class) && !editingStudent.stream) {
      toast.error('Please select a stream for this class');
      return;
    }

    try {
      setSaving(true);

      const result = await update('students', {
        full_name: editingStudent.full_name.trim(),
        roll_number: editingStudent.roll_number.trim(),
        class: editingStudent.class.trim(),
        stream: editingStudent.stream || null,
        boarding_type: editingStudent.boarding_type,
        gender: editingStudent.gender || 'Male',
        avatar_url: editingStudent.avatar_url,
      }, { id: editingStudent.id });

      if (!result.success) throw new Error(result.error);

      toast.success('Student updated successfully!');
      setShowEditDialog(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast.error(error.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAvatarChange = (newUrl: string | null) => {
    if (editingStudent) {
      setEditingStudent({ ...editingStudent, avatar_url: newUrl });
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      const result = await remove('students', { id });
      if (!result.success) throw new Error(result.error);
      toast.success('Student deleted');
      fetchStudents();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast.error(error.message || 'Failed to delete student');
    }
  };

  const handleBulkTransfer = async () => {
    if (!transferFromClass || !transferToClass || transferFromClass === transferToClass) {
      toast.error('Please select different source and destination classes');
      return;
    }

    const studentsToTransfer = selectedStudentIds.size > 0 
      ? Array.from(selectedStudentIds)
      : students.filter(s => s.class === transferFromClass).map(s => s.id);

    if (studentsToTransfer.length === 0) {
      toast.error('No students to transfer');
      return;
    }

    try {
      setSaving(true);
      toast.info(`Transferring ${studentsToTransfer.length} students...`);

      // Get current academic year
      const academicYearsData = await fetchTable<AcademicYear>('academic_years', { is_current: true }, { limit: 1 });
      const academicYear = academicYearsData?.[0]?.year_name || '2024-2025';

      // Fetch fee data in parallel
      const [feeStructures, feePayments] = await Promise.all([
        fetchTable<FeeStructure>('fee_structure', { class: transferFromClass, academic_year: academicYear }),
        fetchTable<FeePayment>('fee_payments', { academic_year: academicYear }),
      ]);

      // Build all debt records at once
      const debtRecords: Record<string, unknown>[] = [];
      for (const studentId of studentsToTransfer) {
        for (const term of terms) {
          const structure = feeStructures?.find(f => f.term === term);
          if (!structure) continue;
          const expectedFee = structure.total_fee || 0;
          const paidAmount = feePayments
            ?.filter(p => p.student_id === studentId && p.term === term)
            .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
          const outstanding = expectedFee - paidAmount;
          if (outstanding > 0) {
            debtRecords.push({
              student_id: studentId,
              academic_year: academicYear,
              term,
              original_amount: expectedFee,
              amount_paid: paidAmount,
              outstanding_balance: outstanding,
              is_cleared: false,
              notes: `Debt carried forward from ${transferFromClass} to ${transferToClass}`
            });
          }
        }
      }

      // Batch insert all debt records in one call
      if (debtRecords.length > 0) {
        await insert('student_debt_history', debtRecords);
      }

      // Batch update all students' class in parallel (groups of 5)
      const BATCH_SIZE = 5;
      for (let i = 0; i < studentsToTransfer.length; i += BATCH_SIZE) {
        const batch = studentsToTransfer.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(id => update('students', { class: transferToClass }, { id })));
      }

      // Convert full class name to short code for teacher matching
      const getClassShortCode = (fullName: string): string => {
        const reverseMapping: Record<string, string> = {
          'Primary 1': 'P1', 'Primary 2': 'P2', 'Primary 3': 'P3', 'Primary 4': 'P4',
          'Primary 5': 'P5', 'Primary 6': 'P6', 'Primary 7': 'P7',
          'Senior 1': 'S1', 'Senior 2': 'S2', 'Senior 3': 'S3', 'Senior 4': 'S4',
        };
        return reverseMapping[fullName] || fullName;
      };

      const oldClassShortCode = getClassShortCode(transferFromClass);

      // Batch delete teacher_class_students in parallel (groups of 5)
      for (let i = 0; i < studentsToTransfer.length; i += BATCH_SIZE) {
        const batch = studentsToTransfer.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.flatMap(id => [
          remove('teacher_class_students', { student_id: id, class: transferFromClass }),
          remove('teacher_class_students', { student_id: id, class: oldClassShortCode }),
        ]));
      }

      toast.success(`Transferred ${studentsToTransfer.length} students to ${transferToClass}`);
      setShowBulkTransferDialog(false);
      setTransferFromClass('');
      setTransferToClass('');
      setSelectedStudentIds(new Set());
      fetchStudents();
    } catch (error: any) {
      console.error('Error transferring students:', error);
      toast.error(error.message || 'Failed to transfer students');
    } finally {
      setSaving(false);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const selectAllInClass = (className: string) => {
    const classStudentIds = students.filter(s => s.class === className).map(s => s.id);
    setSelectedStudentIds(new Set(classStudentIds));
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.roll_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.class === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleDownloadStudentReport = async (student: StudentWithMarks) => {
    try {
      const marksData = await fetchTable<any>('marks', { student_id: student.id });

      const subjectsData = await fetchTable<Subject>('subjects');
      const subjectsMap = new Map(subjectsData.map(s => [s.id, s.name]));

      const subjects = (marksData || []).map((m: any) => ({
        name: subjectsMap.get(m.subject_id) || 'Unknown Subject',
        marks: m.total,
        grade: m.grade,
      }));

      const term = marksData?.[0]?.term || terms[0] || 'Series 1';
      const academicYear = marksData?.[0]?.academic_year || currentYear || '2024-2025';

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

      toast.success('Report downloaded!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to download report');
    }
  };

  const handleDownloadAllReports = () => {
    if (filteredStudents.length === 0) {
      toast.error('No students to generate report');
      return;
    }
    
    const studentsData = filteredStudents.map(s => ({
      name: s.full_name,
      rollNumber: s.roll_number,
      className: s.class,
      average: s.averageMarks,
      grade: s.grade,
    }));

    generateAllStudentsReportPDF(studentsData, terms[0] || 'Series 1', currentYear);
    toast.success('All students report downloaded!');
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
            <p className="text-muted-foreground mt-1">Manage student records and academic information</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {filteredStudents.length > 0 && (
              <Button variant="outline" onClick={handleDownloadAllReports}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            )}
            {canManageStudents && (
              <>
                <Button variant="outline" onClick={() => setShowBulkTransferDialog(true)}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Bulk Transfer
                </Button>
                <Button className="btn-gradient" onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </>
            )}
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
                <SelectValue placeholder="Select class" />
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
        {filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student, index) => (
              <div 
                key={student.id} 
                className="card-elevated p-6 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <Avatar className="w-14 h-14 border-2 border-primary/20">
                    <AvatarImage src={student.avatar_url || undefined} alt={student.full_name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
                      {student.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-50">
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info(`Profile: ${student.full_name}`);
                        }}
                      >
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info(`Marks for ${student.full_name}`);
                        }}
                      >
                        View Marks
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadStudentReport(student);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Download Report
                      </DropdownMenuItem>
                      {canManageStudents && (
                        <>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(student);
                            }}
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Edit / Photo
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStudent(student.id);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="font-display font-semibold text-lg text-card-foreground mb-1">{student.full_name}</h3>
                <p className="text-sm text-muted-foreground mb-4">Roll No: {student.roll_number}</p>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Class:</span>
                    <span className="font-medium text-card-foreground">
                      {student.stream ? `${student.class} ${student.stream}` : student.class}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Type:</span>
                    <span className={`font-medium capitalize ${student.boarding_type === 'boarding' ? 'text-primary' : 'text-card-foreground'}`}>
                      {student.boarding_type === 'boarding' ? 'Boarding' : 'Day'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Admission:</span>
                    <span className="font-medium text-card-foreground">{new Date(student.admission_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Gender:</span>
                    <span className="font-medium text-card-foreground">{student.gender || 'N/A'}</span>
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
        ) : (
          <div className="card-elevated p-12 text-center animate-fade-in">
            <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display font-semibold text-xl text-card-foreground mb-2">
              No students registered
            </h3>
            <p className="text-muted-foreground mb-6">
              Start by adding new students to the system
            </p>
            {canManageStudents && (
              <Button className="btn-gradient" onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Student
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Student Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Fill in the new student's information below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
            {/* Student Photo */}
            <div className="flex flex-col items-center gap-3">
              <Label>Student Photo (Optional)</Label>
              <StudentAvatarUpload
                studentId={newStudentTempId}
                studentName={newStudent.full_name || 'New Student'}
                currentAvatarUrl={tempAvatarUrl}
                onAvatarChange={(url) => setTempAvatarUrl(url)}
                size="lg"
                editable={true}
              />
              <p className="text-xs text-muted-foreground text-center">
                Click the camera icon to upload a photo
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={newStudent.full_name}
                onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll_number">Roll Number</Label>
              <Input
                id="roll_number"
                value={newStudent.roll_number}
                onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value })}
                placeholder="e.g. STD001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              <Select value={newStudent.class} onValueChange={(v) => setNewStudent({ ...newStudent, class: v, stream: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_CLASSES.map((cls) => (
                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasStreams(newStudent.class) && (
              <div className="space-y-2">
                <Label htmlFor="stream">Stream <span className="text-destructive">*</span></Label>
                <Select value={newStudent.stream} onValueChange={(v) => setNewStudent({ ...newStudent, stream: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stream" />
                  </SelectTrigger>
                  <SelectContent>
                    {getStreamsForClass(newStudent.class).map((stream) => (
                      <SelectItem key={stream} value={stream}>{stream}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="boarding_type">Student Type</Label>
              <Select 
                value={newStudent.boarding_type} 
                onValueChange={(v) => setNewStudent({ ...newStudent, boarding_type: v })}
                disabled={['Baby Class', 'Kindergarten I', 'Kindergarten II'].includes(newStudent.class)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day Student</SelectItem>
                  {!['Baby Class', 'Kindergarten I', 'Kindergarten II'].includes(newStudent.class) && (
                    <SelectItem value="boarding">Boarding Student</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {['Baby Class', 'Kindergarten I', 'Kindergarten II'].includes(newStudent.class) && (
                <p className="text-xs text-muted-foreground">Nursery students are day students only</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={newStudent.gender} onValueChange={(v) => setNewStudent({ ...newStudent, gender: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admission_date">Admission Date</Label>
              <Input
                id="admission_date"
                type="date"
                value={newStudent.admission_date}
                onChange={(e) => setNewStudent({ ...newStudent, admission_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Transfer Dialog */}
      <Dialog open={showBulkTransferDialog} onOpenChange={setShowBulkTransferDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Transfer Students</DialogTitle>
            <DialogDescription>
              Transfer students from one class to another
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Class</Label>
                <Select value={transferFromClass} onValueChange={(v) => {
                  setTransferFromClass(v);
                  setSelectedStudentIds(new Set());
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source class" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CLASSES.map((cls) => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Class</Label>
                <Select value={transferToClass} onValueChange={setTransferToClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination class" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CLASSES.filter(c => c !== transferFromClass).map((cls) => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {transferFromClass && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select Students to Transfer</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectAllInClass(transferFromClass)}
                  >
                    Select All
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {students.filter(s => s.class === transferFromClass).map(student => (
                    <div key={student.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded">
                      <Checkbox 
                        checked={selectedStudentIds.has(student.id)}
                        onCheckedChange={() => toggleStudentSelection(student.id)}
                      />
                      <span className="font-medium">{student.full_name}</span>
                      <span className="text-sm text-muted-foreground">({student.roll_number})</span>
                    </div>
                  ))}
                  {students.filter(s => s.class === transferFromClass).length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No students in this class</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedStudentIds.size > 0 
                    ? `${selectedStudentIds.size} students selected`
                    : 'All students will be transferred if none selected'
                  }
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTransferDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkTransfer} disabled={saving || !transferFromClass || !transferToClass}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Transfer Students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information and photo
            </DialogDescription>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {/* Student Photo */}
              <div className="flex flex-col items-center gap-3">
                <Label>Student Photo</Label>
                <StudentAvatarUpload
                  studentId={editingStudent.id}
                  studentName={editingStudent.full_name}
                  currentAvatarUrl={editingStudent.avatar_url}
                  onAvatarChange={handleEditAvatarChange}
                  size="xl"
                  editable={true}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Click the camera icon to upload or change photo
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editingStudent.full_name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Roll Number</Label>
                <Input
                  value={editingStudent.roll_number}
                  onChange={(e) => setEditingStudent({ ...editingStudent, roll_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select 
                  value={editingStudent.class} 
                  onValueChange={(v) => setEditingStudent({ ...editingStudent, class: v, stream: null })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CLASSES.map((cls) => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasStreams(editingStudent.class) && (
                <div className="space-y-2">
                  <Label>Stream <span className="text-destructive">*</span></Label>
                  <Select 
                    value={editingStudent.stream || ''} 
                    onValueChange={(v) => setEditingStudent({ ...editingStudent, stream: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stream" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStreamsForClass(editingStudent.class).map((stream) => (
                        <SelectItem key={stream} value={stream}>{stream}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Student Type</Label>
                <Select 
                  value={editingStudent.boarding_type} 
                  onValueChange={(v) => setEditingStudent({ ...editingStudent, boarding_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day Student</SelectItem>
                    <SelectItem value="boarding">Boarding Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select 
                  value={editingStudent.gender || 'Male'} 
                  onValueChange={(v) => setEditingStudent({ ...editingStudent, gender: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="flex-shrink-0 pt-4 border-t mt-auto">
            <Button variant="outline" onClick={(e) => { e.stopPropagation(); setShowEditDialog(false); }}>
              Cancel
            </Button>
            <Button 
              onClick={(e) => { e.stopPropagation(); handleUpdateStudent(); }} 
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
