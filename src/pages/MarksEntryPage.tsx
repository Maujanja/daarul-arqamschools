import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { calculateGrade } from '@/types';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

const terms = ['Term 1', 'Term 2', 'Term 3'];
const academicYears = ['2024-2025', '2023-2024', '2022-2023'];
const classes = ['10-A', '10-B', '9-A', '9-B', '8-A', '8-B'];

export default function MarksEntryPage() {
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState('10-A');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<StudentMark[]>([]);

  const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
  const maxMarks = selectedSubjectData?.max_marks || 100;

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching subjects:', error);
        return;
      }
      
      setSubjects(data || []);
      if (data && data.length > 0 && !selectedSubject) {
        setSelectedSubject(data[0].id);
      }
    };
    
    fetchSubjects();
  }, []);

  // Fetch students when class changes
  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class', selectedClass)
        .order('roll_number');
      
      if (error) {
        console.error('Error fetching students:', error);
        setIsLoading(false);
        return;
      }
      
      setStudents(data || []);
      
      // Initialize marks for these students
      const initialMarks: StudentMark[] = (data || []).map(student => ({
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
  }, [selectedClass]);

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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Marks Entry</h1>
          <p className="text-muted-foreground mt-1">Enter exam marks for students</p>
        </div>

        {/* Filters */}
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Select Class & Subject</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
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
                  {subjects.map((subject) => (
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
