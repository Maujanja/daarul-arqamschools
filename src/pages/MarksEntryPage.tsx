import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { calculateGrade } from '@/types';
import { Save, Loader2, Upload, Download, FileSpreadsheet, Edit3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { terms } from '@/data/mockData';

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


const academicYears = ['2024-2025', '2023-2024', '2022-2023'];
const ALL_CLASSES = ['Nursery', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7', 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'];

// Map short class codes to full class names (for teacher assignments compatibility)
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(terms[0] || 'Series 11');
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [entryMethod, setEntryMethod] = useState<'manual' | 'excel'>('manual');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);

  const isTeacher = user?.role === 'teacher';

  // Get available classes for teacher
  const availableClasses = isTeacher 
    ? [...new Set(teacherAssignments.map(a => a.class))]
    : ALL_CLASSES;

  // Get available subjects for selected class (for teacher, only assigned subjects)
  const availableSubjects = isTeacher
    ? subjects.filter(s => 
        teacherAssignments.some(a => a.class === selectedClass && a.subject_id === s.id)
      )
    : subjects;

  const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
  const maxMarks = selectedSubjectData?.max_marks || 100;

  // Fetch teacher assignments and subjects
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      
      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .order('name');
      
      if (subjectsError) {
        console.error('Error fetching subjects:', subjectsError);
        setIsLoading(false);
        return;
      }
      
      setSubjects(subjectsData || []);

      // Fetch teacher assignments if teacher
      if (isTeacher && user?.id) {
        const { data: assignmentsData } = await supabase
          .from('teacher_assignments')
          .select('*')
          .eq('teacher_id', user.id);
        
        if (assignmentsData && assignmentsData.length > 0) {
          // Map assignment classes to full names
          const mappedAssignments = assignmentsData.map(a => ({
            ...a,
            class: mapClassToFullName(a.class)
          }));
          setTeacherAssignments(mappedAssignments);
          // Set initial class from assignments
          const firstClass = mappedAssignments[0].class;
          setSelectedClass(firstClass);
          // Set initial subject for that class
          const firstSubject = mappedAssignments.find(a => a.class === firstClass)?.subject_id;
          if (firstSubject) {
            setSelectedSubject(firstSubject);
          }
        }
      } else {
        // For admin, set default class
        setSelectedClass('Primary 1');
        if (subjectsData && subjectsData.length > 0) {
          setSelectedSubject(subjectsData[0].id);
        }
      }
      
      setIsLoading(false);
    };
    
    fetchInitialData();
  }, [isTeacher, user?.id]);

  // Fetch students when class changes - for teachers, only fetch their selected students
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClass || !selectedSubject) return;
      
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
        
        const { data: selectedStudents, error: selectError } = await supabase
          .from('teacher_class_students')
          .select('student_id')
          .eq('teacher_id', user.id)
          .eq('class', selectedClass)
          .eq('subject_id', selectedSubject);
        
        console.log('Selected students from teacher_class_students:', selectedStudents, 'Error:', selectError);
        
        if (selectedStudents && selectedStudents.length > 0) {
          const studentIds = selectedStudents.map(s => s.student_id);
          const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .in('id', studentIds)
            .order('roll_number');
          
          console.log('Fetched students:', students?.length, 'Error:', studentsError);
          studentsToShow = students || [];
        }
      } else {
        // For admin, get all students in the class
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('class', selectedClass)
          .order('roll_number');
        
        studentsToShow = data || [];
      }
      
      console.log('Final students to show:', studentsToShow.length);
      setStudents(studentsToShow);
      
      // Initialize marks for these students
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
  }, [selectedClass, selectedSubject, isTeacher, user?.id]);

  // Load existing marks when subject/term/year changes
  useEffect(() => {
    const loadExistingMarks = async () => {
      if (!selectedSubject || students.length === 0) return;
      
      const { data, error } = await supabase
        .from('marks')
        .select('*')
        .eq('class', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYear);
      
      if (error) {
        console.error('Error loading marks:', error);
        return;
      }
      
      if (data && data.length > 0) {
        setMarks(prev => prev.map(mark => {
          const existingMark = data.find(m => m.student_id === mark.studentId);
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
  }, [selectedSubject, selectedTerm, selectedYear, students, selectedClass]);

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

  // Excel export function
  const handleExportTemplate = () => {
    const templateData = marks.map(mark => ({
      'Roll Number': mark.rollNumber,
      'Student Name': mark.studentName,
      'Exam Marks': mark.exam === '' ? '' : mark.exam,
    }));

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marks');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 },  // Roll Number
      { wch: 30 },  // Student Name
      { wch: 15 },  // Exam Marks
    ];
    
    XLSX.writeFile(wb, `marks_${selectedClass}_${selectedSubjectData?.name || 'subject'}_${selectedTerm}.xlsx`);
    
    toast({
      title: "Template Downloaded",
      description: "Fill in the Exam Marks column and import the file back.",
    });
  };

  // Handle file input click
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Excel import function
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
    // Validate all marks are entered
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
      // Upsert marks to database
      const marksToInsert = marks.map(mark => ({
        student_id: mark.studentId,
        subject_id: selectedSubject,
        class: selectedClass,
        exam: typeof mark.exam === 'number' ? mark.exam : 0,
        total: mark.total,
        grade: mark.grade,
        term: selectedTerm,
        academic_year: selectedYear,
      }));

      for (const markData of marksToInsert) {
        const { error } = await supabase
          .from('marks')
          .upsert(markData, {
            onConflict: 'student_id,subject_id,term,academic_year',
          });
        
        if (error) {
          throw error;
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
        {/* Hidden file input for Excel import */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportExcel}
          accept=".xlsx,.xls"
          className="hidden"
          id="excel-file-input"
        />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Marks Entry</h1>
            <p className="text-muted-foreground mt-1">Enter exam marks for students</p>
          </div>
        </div>

        {/* Filters */}
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
                <p className="font-medium">Hujachagua wanafunzi bado</p>
                <p className="text-sm text-muted-foreground">Nenda "Wanafunzi Wangu" kuchagua wanafunzi utakaowaingiza maksi</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/my-class-students'}>
                Chagua Wanafunzi
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Class</label>
              <Select value={selectedClass} onValueChange={(value) => {
                setSelectedClass(value);
                // Reset subject when class changes for teacher
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

        {/* Entry Method Tabs */}
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

          {/* Excel Import Tab */}
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

          {/* Manual Entry Tab */}
          <TabsContent value="manual" className="mt-6">
            {/* Marks Entry Table */}
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

        {/* Show Save Button for Excel Tab too when marks are loaded */}
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

        {/* Grading Info */}
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
