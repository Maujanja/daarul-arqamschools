import { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateGrade } from '@/types';
import { Save, Loader2, Upload, Download, FileSpreadsheet, Edit3, Lock, ShieldAlert, Unlock, CheckCircle, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { terms, DEFAULT_TEST_COUNT } from '@/data/mockData';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { getStreamsForClass, hasStreams } from '@/utils/classStreams';

interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  max_marks: number;
}

interface StudentMark {
  studentId: string;
  studentName: string;
  rollNumber: string;
  exam: number | '' | '-';
  total: number;
  grade: string;
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  class: string;
  subject_id: string;
  academic_year: string;
  stream: string | null;
}

interface Mark {
  id: string;
  student_id: string;
  subject_id: string;
  class: string;
  exam: number;
  total: number;
  grade: string;
  term: string;
  academic_year: string;
  teacher_id?: string;
}

interface TeacherClassStudent {
  id: string;
  teacher_id: string;
  student_id: string;
  class: string;
  subject_id: string;
  academic_year: string;
}

interface UnlockRequest {
  id: string;
  teacher_id: string;
  status: string;
  class: string;
  subject_id: string;
  term: string;
  academic_year: string;
}

const ALL_CLASSES = ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7', 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'];

const mapClassToFullName = (shortClass: string): string => {
  const mappings: Record<string, string> = {
    'S1': 'Senior 1',
    'S2': 'Senior 2',
    'S3': 'Senior 3',
    'S4': 'Senior 4',
    'P1': 'Primary 1',
    'P2': 'Primary 2',
    'P3': 'Primary 3',
    'P4': 'Primary 4',
    'P5': 'Primary 5',
    'P6': 'Primary 6',
    'P7': 'Primary 7',
    'F3A': 'Form 3 A',
  };
  return mappings[shortClass] || shortClass;
};

export default function MarksEntryPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { academicYears, currentYear, loading: yearsLoading } = useAcademicYears();
  const { fetchTable, query } = useSecureQuery();
  const { upsert, insert, update } = useSecureData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState(terms[0] || 'Test 1');
  const [selectedYear, setSelectedYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [entryMethod, setEntryMethod] = useState<'manual' | 'excel'>('manual');
  const [availableTerms, setAvailableTerms] = useState<string[]>(terms);
  const [showAddSeriesDialog, setShowAddSeriesDialog] = useState(false);
  const [newSeriesNumber, setNewSeriesNumber] = useState(DEFAULT_TEST_COUNT + 1);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  
  // Per-student locking: track which students have existing marks
  const [lockedStudentIds, setLockedStudentIds] = useState<Set<string>>(new Set());
  // Track if there's an approved unlock request for current selection
  const [hasUnlockApproval, setHasUnlockApproval] = useState(false);
  // Unlock request dialog
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [isRequestingUnlock, setIsRequestingUnlock] = useState(false);
  const [existingUnlockRequest, setExistingUnlockRequest] = useState<UnlockRequest | null>(null);

  const isTeacher = user?.role === 'teacher';
  
  const handleAddSeries = () => {
    const newSeries = `Series ${newSeriesNumber}`;
    if (!availableTerms.includes(newSeries)) {
      setAvailableTerms(prev => [...prev, newSeries]);
      setNewSeriesNumber(prev => prev + 1);
      toast({
        title: "Series Added",
        description: `${newSeries} has been added to the list.`,
      });
    }
    setShowAddSeriesDialog(false);
  };

  const availableClasses = isTeacher 
    ? [...new Set(teacherAssignments.map(a => a.class))]
    : ALL_CLASSES;

  // Available streams for selected class - for teachers, filter by their assignments
  // If teacher's assignment has null stream, show all streams for that class (backward compat)
  const teacherHasNullStreamAssignment = isTeacher && teacherAssignments.some(
    a => a.class === selectedClass && !a.stream
  );
  const availableStreams = isTeacher
    ? teacherHasNullStreamAssignment
      ? getStreamsForClass(selectedClass) // null stream = access to all streams
      : [...new Set(teacherAssignments
          .filter(a => a.class === selectedClass && a.stream)
          .map(a => a.stream!))]
    : getStreamsForClass(selectedClass);

  const availableSubjects = isTeacher
    ? subjects.filter(s => 
        teacherAssignments.some(a => 
          a.class === selectedClass && 
          a.subject_id === s.id && 
          (!hasStreams(selectedClass) || !a.stream || a.stream === selectedStream)
        )
      )
    : subjects;

  const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
  const maxMarks = selectedSubjectData?.max_marks || 100;

  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  // Fetch teacher assignments and subjects via secure query
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      const subjectsData = await fetchTable<Subject>('subjects');
      setSubjects(subjectsData);

      if (isTeacher && user?.id) {
        const assignmentsData = await fetchTable<TeacherAssignment>('teacher_assignments', { teacher_id: user.id });
        
        if (assignmentsData && assignmentsData.length > 0) {
          const mappedAssignments = assignmentsData.map(a => ({
            ...a,
            class: mapClassToFullName(a.class)
          }));
          setTeacherAssignments(mappedAssignments);
          const firstClass = mappedAssignments[0].class;
          setSelectedClass(firstClass);
          // Auto-select first stream: use assignment stream, or first available stream for class
          const assignmentStream = mappedAssignments[0].stream;
          if (assignmentStream) {
            setSelectedStream(assignmentStream);
          } else if (hasStreams(firstClass)) {
            const classStreams = getStreamsForClass(firstClass);
            if (classStreams.length > 0) {
              setSelectedStream(classStreams[0]);
            }
          }
          const effectiveStream = assignmentStream || (hasStreams(firstClass) ? getStreamsForClass(firstClass)[0] : null);
          const firstSubject = mappedAssignments.find(a => a.class === firstClass && (!hasStreams(firstClass) || !a.stream || a.stream === effectiveStream))?.subject_id;
          if (firstSubject) {
            setSelectedSubject(firstSubject);
          }
        }
      } else {
        setSelectedClass('Primary 1');
        if (subjectsData && subjectsData.length > 0) {
          setSelectedSubject(subjectsData[0].id);
        }
      }
      
      setIsLoading(false);
    };
    
    fetchInitialData();
  }, [isTeacher, user?.id, user, fetchTable]);

  // Fetch students when class/stream changes
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClass || !selectedSubject || !user) return;
      // If class has streams, wait for stream selection
      if (hasStreams(selectedClass) && !selectedStream) {
        setStudents([]);
        setMarks([]);
        return;
      }
      
      setIsLoading(true);
      
      let studentsToShow: Student[] = [];
      
      // Helper: match stream (include records with null stream for backward compatibility)
      const matchesStream = (recordStream: string | null | undefined) => {
        if (!selectedStream) return true; // No stream filter
        return recordStream === selectedStream || !recordStream; // Match selected or null/empty
      };
      
      if (isTeacher && user?.id) {
        const filters: Record<string, unknown> = {
          teacher_id: user.id,
          class: selectedClass,
          subject_id: selectedSubject
        };
        // Don't filter by stream at DB level - filter client-side for backward compat
        
        const selectedStudents = await fetchTable<TeacherClassStudent & { stream?: string | null }>('teacher_class_students', filters);
        
        if (selectedStudents && selectedStudents.length > 0) {
          // Client-side stream filter: include records where stream matches OR stream is null
          const filteredSelections = selectedStudents.filter(s => matchesStream(s.stream));
          const studentIds = filteredSelections.map(s => s.student_id);
          const allStudents = await fetchTable<Student & { stream?: string | null }>('students', { class: selectedClass });
          studentsToShow = allStudents
            .filter(s => studentIds.includes(s.id))
            .sort((a, b) => a.roll_number.localeCompare(b.roll_number));
        }
      } else {
        const allStudents = await fetchTable<Student & { stream?: string | null }>('students', { class: selectedClass });
        // Client-side stream filter for backward compat
        studentsToShow = allStudents
          .filter(s => matchesStream((s as any).stream))
          .sort((a, b) => a.roll_number.localeCompare(b.roll_number));
      }
      
      setStudents(studentsToShow);
      
      const initialMarks: StudentMark[] = studentsToShow.map(student => ({
        studentId: student.id,
        studentName: student.full_name,
        rollNumber: student.roll_number,
        exam: '',
        total: 0,
        grade: '-',
      }));
      
      setMarks(initialMarks);
      setIsLoading(false);
    };
    
    fetchStudents();
  }, [selectedClass, selectedSubject, selectedStream, isTeacher, user?.id, user, fetchTable]);

  // Load existing marks AND check unlock requests when subject/term/year changes
  useEffect(() => {
    const loadExistingMarks = async () => {
      if (!selectedSubject || students.length === 0 || !user) return;
      
      const result = await query<Mark>('marks', {
        filters: {
          class: selectedClass,
          subject_id: selectedSubject,
          term: selectedTerm,
          academic_year: selectedYear
        }
      });
      
      if (result.success && result.data && result.data.length > 0) {
        // Track which students have existing marks (per-student locking)
        const studentsWithMarks = new Set<string>();
        result.data.forEach(m => {
          if (m.exam > 0) {
            studentsWithMarks.add(m.student_id);
          }
        });
        
        if (isTeacher) {
          setLockedStudentIds(studentsWithMarks);
        } else {
          setLockedStudentIds(new Set());
        }

        setMarks(prev => prev.map(mark => {
          const existingMark = result.data!.find(m => m.student_id === mark.studentId);
          if (existingMark) {
            return {
              ...mark,
              exam: existingMark.exam,
              total: existingMark.total,
              grade: existingMark.grade,
            };
          }
          return mark;
        }));
      } else {
        setLockedStudentIds(new Set());
      }
    };
    
    const checkUnlockRequest = async () => {
      if (!isTeacher || !user?.id || !selectedClass || !selectedSubject || !selectedTerm || !selectedYear) {
        setHasUnlockApproval(false);
        setExistingUnlockRequest(null);
        return;
      }
      
      const result = await query<UnlockRequest>('marks_unlock_requests', {
        filters: {
          teacher_id: user.id,
          class: selectedClass,
          subject_id: selectedSubject,
          term: selectedTerm,
          academic_year: selectedYear
        }
      });
      
      if (result.success && result.data && result.data.length > 0) {
        const latest = result.data[result.data.length - 1];
        setExistingUnlockRequest(latest);
        setHasUnlockApproval(latest.status === 'approved');
      } else {
        setExistingUnlockRequest(null);
        setHasUnlockApproval(false);
      }
    };
    
    loadExistingMarks();
    checkUnlockRequest();
  }, [selectedSubject, selectedTerm, selectedYear, students, selectedClass, user, query, isTeacher]);

  // Check if a specific student is locked for teacher
  const isStudentLocked = (studentId: string): boolean => {
    if (!isTeacher) return false;
    if (hasUnlockApproval) return false; // Unlock approved, all editable
    return lockedStudentIds.has(studentId);
  };

  // Check if any students are locked
  const hasLockedStudents = isTeacher && lockedStudentIds.size > 0 && !hasUnlockApproval;

  const handleRequestUnlock = async () => {
    if (!user?.id || !selectedClass || !selectedSubject || !selectedTerm || !selectedYear) return;
    
    setIsRequestingUnlock(true);
    try {
      const result = await insert('marks_unlock_requests', {
        teacher_id: user.id,
        teacher_name: user.name || 'Teacher',
        class: selectedClass,
        subject_id: selectedSubject,
        subject_name: selectedSubjectData?.name || '',
        term: selectedTerm,
        academic_year: selectedYear,
        reason: unlockReason || 'Nahitaji kubadilisha maksi',
        status: 'pending',
      });
      
      if (result.success) {
        toast({
          title: "Ombi Limetumwa!",
          description: "Ombi lako la idhini ya kubadilisha maksi limetumwa kwa Admin. Utapata taarifa pindi litakapojibiwa.",
        });
        setShowUnlockDialog(false);
        setUnlockReason('');
        // Refresh unlock request status
        setExistingUnlockRequest({ id: '', teacher_id: user.id, status: 'pending', class: selectedClass, subject_id: selectedSubject, term: selectedTerm, academic_year: selectedYear });
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Imeshindikana kutuma ombi.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingUnlock(false);
    }
  };

  const updateMark = (studentId: string, value: string) => {
    // Allow "-" as a valid value (absent/didn't sit)
    if (value === '-') {
      setMarks(prev => prev.map(mark => {
        if (mark.studentId !== studentId) return mark;
        return { ...mark, exam: '-', total: 0, grade: '-' };
      }));
      return;
    }
    
    const numValue = value === '' ? '' : Math.min(Math.max(0, parseInt(value) || 0), maxMarks);
    
    setMarks(prev => prev.map(mark => {
      if (mark.studentId !== studentId) return mark;
      
      const examScore = typeof numValue === 'number' ? numValue : 0;
      const total = examScore;
      const percentage = (total / maxMarks) * 100;
      const grade = total > 0 ? calculateGrade(percentage) : '-';
      
      return {
        ...mark,
        exam: numValue,
        total,
        grade,
      };
    }));
  };

  const handleExportTemplate = () => {
    const templateData = marks.map(mark => ({
      'Roll Number': mark.rollNumber,
      'Student Name': mark.studentName,
      'Exam Marks': mark.exam === '' ? '' : mark.exam,
    }));

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marks');
    
    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
    ];
    
    XLSX.writeFile(wb, `marks_${selectedClass}_${selectedSubjectData?.name || 'subject'}_${selectedTerm}.xlsx`);
    
    toast({
      title: "Template Downloaded",
      description: "Fill in the Exam Marks column and import the file back.",
    });
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<{
        'Roll Number': string;
        'Student Name': string;
        'Exam Marks': number | string;
      }>(worksheet);

      let updatedCount = 0;
      
      setMarks(prev => prev.map(mark => {
        // Skip locked students during import
        if (isStudentLocked(mark.studentId)) return mark;
        
        const importedRow = jsonData.find(row => 
          row['Roll Number']?.toString().trim() === mark.rollNumber.trim()
        );
        
        if (importedRow && importedRow['Exam Marks'] !== undefined && importedRow['Exam Marks'] !== '') {
          const examScore = Math.min(Math.max(0, parseInt(String(importedRow['Exam Marks'])) || 0), maxMarks);
          const total = examScore;
          const percentage = (total / maxMarks) * 100;
          const grade = total > 0 ? calculateGrade(percentage) : '-';
          updatedCount++;
          
          return {
            ...mark,
            exam: examScore,
            total,
            grade,
          };
        }
        return mark;
      }));

      toast({
        title: "Import Successful",
        description: `Updated marks for ${updatedCount} students.`,
      });
    } catch (error) {
      console.error('Error importing Excel:', error);
      toast({
        title: "Import Failed",
        description: "Please check the Excel file format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async () => {
    // Only save marks that have been filled in AND are not locked
    // Allow "-" (saves as 0 with grade "-") and numeric values
    const filledMarks = marks.filter(m => {
      if (m.exam === '') return false;
      // If student is locked, don't include in save (unless unlock approved)
      if (isStudentLocked(m.studentId)) return false;
      return true;
    });

    if (filledMarks.length === 0) {
      toast({
        title: "No Marks Entered",
        description: "Please enter marks for at least one student before saving.",
        variant: "destructive",
      });
      return;
    }

    // Count unlocked students only
    const unlockedStudents = marks.filter(m => !isStudentLocked(m.studentId));
    const unfilledCount = unlockedStudents.length - filledMarks.length;

    setIsSubmitting(true);
    
    try {
      const marksToInsert = filledMarks.map(mark => ({
        student_id: mark.studentId,
        subject_id: selectedSubject,
        class: selectedClass,
        stream: selectedStream || null,
        exam: typeof mark.exam === 'number' ? mark.exam : 0,
        total: mark.total,
        grade: mark.grade,
        term: selectedTerm,
        academic_year: selectedYear,
        teacher_id: isTeacher && user?.id ? user.id : null,
      }));

      for (const markData of marksToInsert) {
        const result = await upsert('marks', markData);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save mark');
        }
      }
      
      // After saving, lock newly saved students
      if (isTeacher) {
        setLockedStudentIds(prev => {
          const newSet = new Set(prev);
          filledMarks.forEach(m => newSet.add(m.studentId));
          return newSet;
        });
        
        // If unlock was approved, consume the approval (mark as 'used')
        if (hasUnlockApproval && existingUnlockRequest?.id) {
          await update('marks_unlock_requests', 
            { status: 'used' }, 
            { id: existingUnlockRequest.id }
          );
          setHasUnlockApproval(false);
          setExistingUnlockRequest(null);
        }
      }
      
      const description = unfilledCount > 0
        ? `Saved marks for ${filledMarks.length} students. ${unfilledCount} remaining.`
        : `All marks for Class ${selectedClass} - ${selectedSubjectData?.name} have been saved.`;
      
      toast({
        title: "Marks Saved!",
        description,
      });
    } catch (error: any) {
      console.error('Error saving marks:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save marks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClass = (value: number | '' | '-') => {
    if (value === '' || value === '-') return '';
    const percentage = (Number(value) / maxMarks) * 100;
    if (percentage >= 75) return 'border-success/50 bg-success/5';
    if (percentage >= 50) return 'border-primary/50 bg-primary/5';
    if (percentage >= 40) return 'border-warning/50 bg-warning/5';
    return 'border-destructive/50 bg-destructive/5';
  };

  // Check if there are any unlocked students to save
  const hasUnlockedStudentsToSave = marks.some(m => !isStudentLocked(m.studentId));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportExcel}
          accept=".xlsx,.xls"
          className="hidden"
          id="excel-file-input"
        />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Marks Entry</h1>
            <p className="text-muted-foreground mt-1">Enter exam marks for students</p>
          </div>
        </div>

        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Select Class & Subject</h3>
          {isTeacher && availableClasses.length === 0 && (
            <div className="p-4 bg-warning/10 text-warning rounded-lg mb-4">
              No classes assigned to you. Please contact the administrator to assign classes and subjects.
            </div>
          )}
          {isTeacher && students.length === 0 && selectedClass && selectedSubject && !isLoading && (
            <div className="p-4 bg-accent/10 text-accent-foreground rounded-lg mb-4 flex items-center justify-between">
              <div>
                <p className="font-medium">No students selected yet</p>
                <p className="text-sm text-muted-foreground">Go to "My Students" to select students for marks entry</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/my-class-students'}>
                Select Students
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Class</label>
              <Select value={selectedClass} onValueChange={(value) => {
                setSelectedClass(value);
                setSelectedStream('');
                if (isTeacher) {
                  const firstAssignment = teacherAssignments.find(a => a.class === value);
                  if (firstAssignment?.stream) {
                    setSelectedStream(firstAssignment.stream);
                  }
                  const firstSubjectForClass = firstAssignment?.subject_id;
                  if (firstSubjectForClass) {
                    setSelectedSubject(firstSubjectForClass);
                  }
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((cls) => (
                    <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableStreams.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Stream</label>
                <Select value={selectedStream} onValueChange={setSelectedStream}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stream" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStreams.map((stream) => (
                      <SelectItem key={stream} value={stream}>{stream}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Subject</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Test</label>
              <div className="flex gap-2">
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTerms.map((term) => (
                      <SelectItem key={term} value={term}>{term}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={showAddSeriesDialog} onOpenChange={setShowAddSeriesDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" title="Ongeza Series">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ongeza Series Mpya</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nambari ya Series</label>
                        <Input
                          type="number"
                          min={1}
                          value={newSeriesNumber}
                          onChange={(e) => setNewSeriesNumber(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Itaongeza: Series {newSeriesNumber}
                      </p>
                      <Button onClick={handleAddSeries} className="w-full">
                        Ongeza Series
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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

        {/* Top notification: Unlock approval/rejection/pending status */}
        {isTeacher && existingUnlockRequest && existingUnlockRequest.status === 'approved' && lockedStudentIds.size > 0 && (
          <div className="rounded-lg p-4 animate-fade-in border border-success/30 bg-success/10">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-success shrink-0" />
              <div>
                <p className="font-semibold text-success">✅ Idhini Imekubaliwa!</p>
                <p className="text-sm text-muted-foreground">Admin amekubali ombi lako. Sasa unaweza kubadilisha maksi zote.</p>
              </div>
            </div>
          </div>
        )}
        {isTeacher && existingUnlockRequest && existingUnlockRequest.status === 'pending' && (
          <div className="rounded-lg p-4 animate-fade-in border border-warning/30 bg-warning/10">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-warning shrink-0" />
              <div>
                <p className="font-semibold text-warning">⏳ Ombi Linasubiri</p>
                <p className="text-sm text-muted-foreground">Ombi lako la kubadilisha maksi linasubiri idhini ya Admin.</p>
              </div>
            </div>
          </div>
        )}
        {isTeacher && existingUnlockRequest && existingUnlockRequest.status === 'rejected' && (
          <div className="rounded-lg p-4 animate-fade-in border border-destructive/30 bg-destructive/10">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-destructive">❌ Ombi Limekataliwa</p>
                <p className="text-sm text-muted-foreground">Admin amekataa ombi lako. Unaweza kutuma ombi jipya.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setExistingUnlockRequest(null); setShowUnlockDialog(true); }}>
                Omba Tena
              </Button>
            </div>
          </div>
        )}

        {/* Unlock Request Dialog */}
        <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Omba Idhini ya Kubadilisha Maksi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p><strong>Darasa:</strong> {selectedClass}</p>
                <p><strong>Somo:</strong> {selectedSubjectData?.name}</p>
                <p><strong>Test:</strong> {selectedTerm}</p>
                <p><strong>Mwaka:</strong> {selectedYear}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sababu ya kuomba mabadiliko</label>
                <Textarea
                  placeholder="Andika sababu ya kuomba kubadilisha maksi..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                onClick={handleRequestUnlock} 
                className="w-full btn-gradient"
                disabled={isRequestingUnlock}
              >
                {isRequestingUnlock ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Inatuma...</>
                ) : (
                  <><Unlock className="w-4 h-4 mr-2" />Tuma Ombi</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs value={entryMethod} onValueChange={(v) => setEntryMethod(v as 'manual' | 'excel')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="excel" className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Excel Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="mt-6">
            <div className="card-elevated p-8 animate-fade-in">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-semibold text-card-foreground">Import Marks from Excel</h3>
                  <p className="text-muted-foreground mt-2">Download the template, fill in the marks, and upload it back</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleExportTemplate}
                    disabled={marks.length === 0}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Template
                  </Button>
                  <Button 
                    size="lg"
                    className="btn-gradient"
                    onClick={handleImportClick}
                    disabled={marks.length === 0 || isImporting}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-2" />
                        Upload Excel File
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 max-w-lg mx-auto">
                  <h4 className="font-medium text-card-foreground mb-2">Instructions:</h4>
                  <ol className="text-sm text-muted-foreground text-left space-y-1 list-decimal list-inside">
                    <li>Click "Download Template" to get the Excel file with student list</li>
                    <li>Fill in the "Exam Marks" column for each student</li>
                    <li>Save the Excel file</li>
                    <li>Click "Upload Excel File" and select your file</li>
                    <li>Review the imported marks and click "Save Marks"</li>
                  </ol>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-6">
            <div className="card-elevated overflow-hidden animate-fade-in">
              <div className="p-6 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold text-lg text-card-foreground">
                      Class {selectedClass}{selectedStream ? ` ${selectedStream}` : ''} - {selectedSubjectData?.name || 'Select Subject'}
                    </h3>
                    <p className="text-sm text-muted-foreground">{marks.length} students • {selectedTerm} • {selectedYear}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Omba Idhini button - visible when there are locked students and no existing request */}
                    {isTeacher && hasLockedStudents && !existingUnlockRequest && (
                      <Button 
                        variant="outline"
                        onClick={() => setShowUnlockDialog(true)}
                        className="border-warning text-warning hover:bg-warning/10"
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Omba Idhini ya Kubadilisha
                      </Button>
                    )}
                    {hasUnlockedStudentsToSave && (
                      <Button 
                        className="btn-gradient"
                        onClick={handleSubmit}
                        disabled={isSubmitting || marks.length === 0}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Marks
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {isLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground mt-4">Loading students...</p>
                </div>
              ) : marks.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">No students in this class. Add students first.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Roll No</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Student Name</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                          <div>Exam</div>
                          <div className="text-xs font-normal">(Max: {maxMarks})</div>
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Grade</th>
                        {isTeacher && <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((mark, index) => {
                        const locked = isStudentLocked(mark.studentId);
                        return (
                          <tr 
                            key={mark.studentId} 
                            className={`border-b border-border/50 table-row-hover animate-slide-up ${locked ? 'bg-muted/30' : ''}`}
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <td className="py-4 px-4 font-mono text-sm text-card-foreground">{mark.rollNumber}</td>
                            <td className="py-4 px-4 font-medium text-card-foreground">{mark.studentName}</td>
                            <td className="py-4 px-4">
                              <Input
                                type="text"
                                value={mark.exam}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '-' || val === '') {
                                    updateMark(mark.studentId, val);
                                  } else if (/^\d+$/.test(val)) {
                                    updateMark(mark.studentId, val);
                                  }
                                }}
                                className={`w-24 text-center mx-auto ${getInputClass(mark.exam)} ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder="-"
                                disabled={locked}
                              />
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={`text-lg font-bold ${mark.total >= 75 ? 'text-success' : mark.total >= 50 ? 'text-primary' : mark.total >= 40 ? 'text-warning' : mark.total > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {mark.total || '-'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <GradeBadge grade={mark.grade} />
                            </td>
                            {isTeacher && (
                              <td className="py-4 px-4 text-center whitespace-nowrap">
                                {locked ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <Lock className="w-4 h-4 text-warning flex-shrink-0" />
                                    <span className="text-xs text-warning font-medium">Imefungwa</span>
                                  </div>
                                ) : mark.exam !== '' ? (
                                  <span className="text-xs text-success font-medium">✓ Wazi</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {entryMethod === 'excel' && marks.some(m => m.exam !== '' && !isStudentLocked(m.studentId)) && hasUnlockedStudentsToSave && (
          <div className="flex justify-center">
            <Button 
              className="btn-gradient"
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Imported Marks
                </>
              )}
            </Button>
          </div>
        )}

        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Grading Scale</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <GradeBadge grade="A" size="sm" />
              <span className="text-sm text-muted-foreground">75-100%</span>
            </div>
            <div className="flex items-center gap-2">
              <GradeBadge grade="B" size="sm" />
              <span className="text-sm text-muted-foreground">65-74%</span>
            </div>
            <div className="flex items-center gap-2">
              <GradeBadge grade="C" size="sm" />
              <span className="text-sm text-muted-foreground">50-64%</span>
            </div>
            <div className="flex items-center gap-2">
              <GradeBadge grade="D" size="sm" />
              <span className="text-sm text-muted-foreground">40-49%</span>
            </div>
            <div className="flex items-center gap-2">
              <GradeBadge grade="F" size="sm" />
              <span className="text-sm text-muted-foreground">0-39%</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
