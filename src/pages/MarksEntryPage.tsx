import { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateGrade } from '@/types';
import { Save, Loader2, Upload, Download, FileSpreadsheet, Edit3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { terms, DEFAULT_TERM_COUNT } from '@/data/mockData';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';

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
  exam: number | '';
  total: number;
  grade: string;
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  class: string;
  subject_id: string;
  academic_year: string;
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
  const { upsert } = useSecureData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(terms[0] || 'Series 1');
  const [selectedYear, setSelectedYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [entryMethod, setEntryMethod] = useState<'manual' | 'excel'>('manual');
  const [availableTerms, setAvailableTerms] = useState<string[]>(terms);
  const [showAddSeriesDialog, setShowAddSeriesDialog] = useState(false);
  const [newSeriesNumber, setNewSeriesNumber] = useState(DEFAULT_TERM_COUNT + 1);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);

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

  const availableSubjects = isTeacher
    ? subjects.filter(s => 
        teacherAssignments.some(a => a.class === selectedClass && a.subject_id === s.id)
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
      
      // Fetch subjects (publicly readable)
      const subjectsData = await fetchTable<Subject>('subjects');
      setSubjects(subjectsData);

      if (isTeacher && user?.id) {
        // Fetch teacher assignments via secure query
        const assignmentsData = await fetchTable<TeacherAssignment>('teacher_assignments', { teacher_id: user.id });
        
        if (assignmentsData && assignmentsData.length > 0) {
          const mappedAssignments = assignmentsData.map(a => ({
            ...a,
            class: mapClassToFullName(a.class)
          }));
          setTeacherAssignments(mappedAssignments);
          const firstClass = mappedAssignments[0].class;
          setSelectedClass(firstClass);
          const firstSubject = mappedAssignments.find(a => a.class === firstClass)?.subject_id;
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

  // Fetch students when class changes - for teachers, only fetch their selected students
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClass || !selectedSubject || !user) return;
      
      setIsLoading(true);
      console.log('Fetching students for:', { selectedClass, selectedSubject, userId: user?.id, isTeacher });
      
      let studentsToShow: Student[] = [];
      
      if (isTeacher && user?.id) {
        // For teachers, get only their selected students from teacher_class_students
        console.log('Teacher query params:', {
          teacher_id: user.id,
          class: selectedClass,
          subject_id: selectedSubject
        });
        
        const selectedStudents = await fetchTable<TeacherClassStudent>('teacher_class_students', {
          teacher_id: user.id,
          class: selectedClass,
          subject_id: selectedSubject
        });
        
        console.log('Selected students from teacher_class_students:', selectedStudents);
        
        if (selectedStudents && selectedStudents.length > 0) {
          const studentIds = selectedStudents.map(s => s.student_id);
          // Fetch student details for these IDs
          const allStudents = await fetchTable<Student>('students', { class: selectedClass });
          studentsToShow = allStudents.filter(s => studentIds.includes(s.id)).sort((a, b) => a.roll_number.localeCompare(b.roll_number));
        }
      } else {
        // For admin, get all students in the class
        const allStudents = await fetchTable<Student>('students', { class: selectedClass });
        studentsToShow = allStudents.sort((a, b) => a.roll_number.localeCompare(b.roll_number));
      }
      
      console.log('Final students to show:', studentsToShow.length);
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
  }, [selectedClass, selectedSubject, isTeacher, user?.id, user, fetchTable]);

  // Load existing marks when subject/term/year changes
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
      }
    };
    
    loadExistingMarks();
  }, [selectedSubject, selectedTerm, selectedYear, students, selectedClass, user, query]);

  const updateMark = (studentId: string, value: string) => {
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
    const incomplete = marks.some(m => m.exam === '');

    if (incomplete) {
      toast({
        title: "Marks Incomplete",
        description: "Please enter marks for all students before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upsert marks to database via secure data hook
      const marksToInsert = marks.map(mark => ({
        student_id: mark.studentId,
        subject_id: selectedSubject,
        class: selectedClass,
        exam: typeof mark.exam === 'number' ? mark.exam : 0,
        total: mark.total,
        grade: mark.grade,
        term: selectedTerm,
        academic_year: selectedYear,
        teacher_id: isTeacher && user?.id ? user.id : null,
      }));

      // Use secure upsert for each mark
      for (const markData of marksToInsert) {
        const result = await upsert('marks', markData);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save mark');
        }
      }
      
      toast({
        title: "Marks Saved!",
        description: `Marks for Class ${selectedClass} - ${selectedSubjectData?.name} have been saved.`,
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

  const getInputClass = (value: number | '') => {
    if (value === '') return '';
    const percentage = (Number(value) / maxMarks) * 100;
    if (percentage >= 75) return 'border-success/50 bg-success/5';
    if (percentage >= 50) return 'border-primary/50 bg-primary/5';
    if (percentage >= 40) return 'border-warning/50 bg-warning/5';
    return 'border-destructive/50 bg-destructive/5';
  };

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Class</label>
              <Select value={selectedClass} onValueChange={(value) => {
                setSelectedClass(value);
                if (isTeacher) {
                  const firstSubjectForClass = teacherAssignments.find(a => a.class === value)?.subject_id;
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
                      Class {selectedClass} - {selectedSubjectData?.name || 'Select Subject'}
                    </h3>
                    <p className="text-sm text-muted-foreground">{marks.length} students • {selectedTerm} • {selectedYear}</p>
                  </div>
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
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((mark, index) => (
                        <tr 
                          key={mark.studentId} 
                          className="border-b border-border/50 table-row-hover animate-slide-up"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="py-4 px-4 font-mono text-sm text-card-foreground">{mark.rollNumber}</td>
                          <td className="py-4 px-4 font-medium text-card-foreground">{mark.studentName}</td>
                          <td className="py-4 px-4">
                            <Input
                              type="number"
                              min="0"
                              max={maxMarks}
                              value={mark.exam}
                              onChange={(e) => updateMark(mark.studentId, e.target.value)}
                              className={`w-24 text-center mx-auto ${getInputClass(mark.exam)}`}
                              placeholder="-"
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {entryMethod === 'excel' && marks.some(m => m.exam !== '') && (
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
