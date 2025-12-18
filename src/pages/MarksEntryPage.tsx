import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockStudents, mockSubjects, classes, terms, academicYears } from '@/data/mockData';
import { calculateGrade } from '@/types';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudentMark {
  studentId: string;
  studentName: string;
  rollNumber: string;
  test1: number | '';
  test2: number | '';
  assignment: number | '';
  exam: number | '';
  total: number;
  grade: string;
}

export default function MarksEntryPage() {
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState('10-A');
  const [selectedSubject, setSelectedSubject] = useState('sub-1');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxMarks = {
    test1: 20,
    test2: 20,
    assignment: 10,
    exam: 50,
  };

  const studentsInClass = mockStudents.filter(s => s.class === selectedClass);
  const selectedSubjectData = mockSubjects.find(s => s.id === selectedSubject);

  const [marks, setMarks] = useState<StudentMark[]>(() => 
    studentsInClass.map(student => ({
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      test1: '',
      test2: '',
      assignment: '',
      exam: '',
      total: 0,
      grade: '-',
    }))
  );

  // Reset marks when class changes
  useMemo(() => {
    const newMarks = mockStudents
      .filter(s => s.class === selectedClass)
      .map(student => ({
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        test1: '' as number | '',
        test2: '' as number | '',
        assignment: '' as number | '',
        exam: '' as number | '',
        total: 0,
        grade: '-',
      }));
    setMarks(newMarks);
  }, [selectedClass]);

  const updateMark = (studentId: string, field: keyof Pick<StudentMark, 'test1' | 'test2' | 'assignment' | 'exam'>, value: string) => {
    const numValue = value === '' ? '' : Math.min(Math.max(0, parseInt(value) || 0), maxMarks[field]);
    
    setMarks(prev => prev.map(mark => {
      if (mark.studentId !== studentId) return mark;
      
      const updated = { ...mark, [field]: numValue };
      
      // Calculate total and grade
      const t1 = typeof updated.test1 === 'number' ? updated.test1 : 0;
      const t2 = typeof updated.test2 === 'number' ? updated.test2 : 0;
      const ass = typeof updated.assignment === 'number' ? updated.assignment : 0;
      const ex = typeof updated.exam === 'number' ? updated.exam : 0;
      
      updated.total = t1 + t2 + ass + ex;
      updated.grade = updated.total > 0 ? calculateGrade(updated.total) : '-';
      
      return updated;
    }));
  };

  const handleSubmit = async () => {
    // Validate all marks are entered
    const incomplete = marks.some(m => 
      m.test1 === '' || m.test2 === '' || m.assignment === '' || m.exam === ''
    );

    if (incomplete) {
      toast({
        title: "Incomplete Marks",
        description: "Please enter marks for all students before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Marks Submitted Successfully!",
      description: `Marks for Class ${selectedClass} - ${selectedSubjectData?.name} have been saved.`,
    });
    
    setIsSubmitting(false);
  };

  const getInputClass = (value: number | '', max: number) => {
    if (value === '') return '';
    const percentage = (value / max) * 100;
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
          <p className="text-muted-foreground mt-1">Enter student marks for continuous assessment and exams</p>
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
                  {['10-A', '10-B', '9-A'].map((cls) => (
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
                  {mockSubjects.map((subject) => (
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
                  Class {selectedClass} - {selectedSubjectData?.name}
                </h3>
                <p className="text-sm text-muted-foreground">{marks.length} students • {selectedTerm} • {selectedYear}</p>
              </div>
              <Button 
                className="btn-gradient"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Submit Marks
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Roll No.</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Student Name</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                    <div>Test 1</div>
                    <div className="text-xs font-normal">(Max: {maxMarks.test1})</div>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                    <div>Test 2</div>
                    <div className="text-xs font-normal">(Max: {maxMarks.test2})</div>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                    <div>Assignment</div>
                    <div className="text-xs font-normal">(Max: {maxMarks.assignment})</div>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                    <div>Exam</div>
                    <div className="text-xs font-normal">(Max: {maxMarks.exam})</div>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Total (100)</th>
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
                        max={maxMarks.test1}
                        value={mark.test1}
                        onChange={(e) => updateMark(mark.studentId, 'test1', e.target.value)}
                        className={`w-20 text-center mx-auto ${getInputClass(mark.test1, maxMarks.test1)}`}
                        placeholder="-"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <Input
                        type="number"
                        min="0"
                        max={maxMarks.test2}
                        value={mark.test2}
                        onChange={(e) => updateMark(mark.studentId, 'test2', e.target.value)}
                        className={`w-20 text-center mx-auto ${getInputClass(mark.test2, maxMarks.test2)}`}
                        placeholder="-"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <Input
                        type="number"
                        min="0"
                        max={maxMarks.assignment}
                        value={mark.assignment}
                        onChange={(e) => updateMark(mark.studentId, 'assignment', e.target.value)}
                        className={`w-20 text-center mx-auto ${getInputClass(mark.assignment, maxMarks.assignment)}`}
                        placeholder="-"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <Input
                        type="number"
                        min="0"
                        max={maxMarks.exam}
                        value={mark.exam}
                        onChange={(e) => updateMark(mark.studentId, 'exam', e.target.value)}
                        className={`w-20 text-center mx-auto ${getInputClass(mark.exam, maxMarks.exam)}`}
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
