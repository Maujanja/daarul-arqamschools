import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { Loader2, Search, Save, Users, UserPlus, CheckCircle } from 'lucide-react';
import { extractUniqueBaseClasses, parseClassStream, getStreamsForClass, hasStreams } from '@/utils/classStreams';

interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
  stream: string | null;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface TeacherClassStudent {
  id: string;
  teacher_id: string;
  student_id: string;
  class: string;
  subject_id: string;
  academic_year: string;
  stream: string | null;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  subjects: string[];
  classes: string[];
}

export default function MyClassStudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentYear } = useAcademicYears();
  const { fetchTable, query } = useSecureQuery();
  const { insert, remove, upsert } = useSecureData();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<Subject[]>([]);
  const [allStudentsInClass, setAllStudentsInClass] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [existingSelections, setExistingSelections] = useState<TeacherClassStudent[]>([]);

  // Available streams for selected class
  const availableStreams = selectedClass ? getStreamsForClass(selectedClass) : [];

  // Fetch teacher's assigned classes and subjects via secure query
  useEffect(() => {
    const fetchTeacherData = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      
      // Get teacher data via secure query
      const result = await query<Teacher>('teachers', {
        filters: { id: user.id }
      });
      
      if (!result.success || !result.data || result.data.length === 0) {
        setIsLoading(false);
        return;
      }
      
      const teacher = result.data[0];
      
      // Extract unique base classes from class+stream strings like "Senior 3 B"
      const rawClasses = teacher.classes || [];
      const baseClasses = extractUniqueBaseClasses(rawClasses);
      const subjectNames = teacher.subjects || [];
      
      setTeacherClasses(baseClasses);
      
      if (baseClasses.length > 0) {
        setSelectedClass(baseClasses[0]);
        // Auto-select first stream if class has streams
        if (hasStreams(baseClasses[0])) {
          const streams = getStreamsForClass(baseClasses[0]);
          if (streams.length > 0) setSelectedStream(streams[0]);
        }
      }
      
      // Get subjects matching teacher's subject names
      const allSubjects = await fetchTable<Subject>('subjects');
      
      if (allSubjects) {
        const matchedSubjects = allSubjects.filter(s => 
          subjectNames.some((name: string) => 
            s.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(s.name.toLowerCase())
          )
        );
        setTeacherSubjects(matchedSubjects);
        
        if (matchedSubjects.length > 0) {
          setSelectedSubject(matchedSubjects[0].id);
        }
      }
      
      setIsLoading(false);
    };
    
    fetchTeacherData();
  }, [user?.id, query, fetchTable]);

  // Auto-select stream when class changes
  useEffect(() => {
    if (selectedClass && hasStreams(selectedClass)) {
      const streams = getStreamsForClass(selectedClass);
      if (streams.length > 0 && !streams.includes(selectedStream)) {
        setSelectedStream(streams[0]);
      }
    } else {
      setSelectedStream('');
    }
  }, [selectedClass]);

  // Fetch students when class/stream changes
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClass || !user) return;
      
      // Fetch ALL students in the class, then filter client-side
      // This ensures students with null stream are included (backward compatibility)
      const students = await fetchTable<Student>('students', { class: selectedClass });
      
      // Include students whose stream matches OR whose stream is null/empty (backward compat)
      const filtered = selectedStream
        ? students.filter(s => s.stream === selectedStream || !s.stream || s.stream === '')
        : students;
      
      const sortedStudents = filtered.sort((a, b) => a.roll_number.localeCompare(b.roll_number));
      setAllStudentsInClass(sortedStudents);
    };
    
    fetchStudents();
  }, [selectedClass, selectedStream, user, fetchTable]);

  // Fetch existing selections when class/subject/stream/academic year changes
  useEffect(() => {
    const fetchExistingSelections = async () => {
      if (!user?.id || !selectedClass || !selectedSubject || !currentYear) return;
      // If class has streams but none selected, wait
      if (hasStreams(selectedClass) && !selectedStream) return;
      
      const filters: Record<string, unknown> = {
        teacher_id: user.id,
        class: selectedClass,
        subject_id: selectedSubject,
        academic_year: currentYear
      };
      
      const selections = await fetchTable<TeacherClassStudent>('teacher_class_students', filters);
      
      // Filter by stream client-side (include null stream for backward compat)
      const filtered = selectedStream 
        ? (hasStreams(selectedClass)
            ? selections.filter(s => s.stream === selectedStream)
            : selections.filter(s => s.stream === selectedStream || !s.stream))
        : selections;
      
      setExistingSelections(filtered);
      
      // Set selected student IDs from existing selections
      const selectedIds = new Set(filtered.map(s => s.student_id));
      setSelectedStudentIds(selectedIds);
    };
    
    fetchExistingSelections();
  }, [user?.id, selectedClass, selectedSubject, selectedStream, currentYear, fetchTable]);

  const toggleStudent = (studentId: string) => {
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

  const selectAll = () => {
    const allIds = new Set(allStudentsInClass.map(s => s.id));
    setSelectedStudentIds(allIds);
  };

  const deselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const handleSave = async () => {
    if (!user?.id || !selectedClass || !selectedSubject || !currentYear) return;
    
    setIsSaving(true);
    
    try {
      const contextFilters = {
        teacher_id: user.id,
        class: selectedClass,
        subject_id: selectedSubject,
        academic_year: currentYear,
      };

      // Delete only current stream rows first (plus legacy null stream rows when class has streams)
      const hasClassStreams = hasStreams(selectedClass);
      if (hasClassStreams && selectedStream) {
        await Promise.all([
          remove('teacher_class_students', { ...contextFilters, stream: selectedStream }),
          remove('teacher_class_students', { ...contextFilters, stream: null }),
        ]);
      } else {
        await remove('teacher_class_students', { ...contextFilters, stream: null });
      }
      
      // Upsert new selections in batches to avoid duplicate-key save failures
      if (selectedStudentIds.size > 0) {
        const allInsertData = Array.from(selectedStudentIds).map(studentId => ({
          teacher_id: user.id,
          student_id: studentId,
          class: selectedClass,
          subject_id: selectedSubject,
          academic_year: currentYear,
          stream: selectedStream || null,
        }));
        
        const batchSize = 50;
        for (let i = 0; i < allInsertData.length; i += batchSize) {
          const batch = allInsertData.slice(i, i + batchSize);
          const result = await upsert('teacher_class_students', batch);
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to save students');
          }
        }
      }
      
      toast({
        title: "Students Saved!",
        description: `You have selected ${selectedStudentIds.size} students for ${selectedClass} - ${teacherSubjects.find(s => s.id === selectedSubject)?.name}`,
      });
      
      // Refresh existing selections
      const selections = await fetchTable<TeacherClassStudent>('teacher_class_students', contextFilters);
      const refreshedFiltered = selectedStream
        ? (hasStreams(selectedClass)
            ? selections.filter(s => s.stream === selectedStream)
            : selections.filter(s => s.stream === selectedStream || !s.stream))
        : selections;
      setExistingSelections(refreshedFiltered);
      
    } catch (error: any) {
      console.error('Error saving students:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = allStudentsInClass.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (teacherClasses.length === 0) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No Classes Assigned</h2>
          <p className="text-muted-foreground">You haven't been assigned any classes. Please contact the Admin.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">My Students</h1>
            <p className="text-muted-foreground mt-1">Select students you will enter marks for</p>
          </div>
          <Button 
            className="btn-gradient" 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Students ({selectedStudentIds.size})
          </Button>
        </div>

        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Select Class, Stream and Subject</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses.map((cls) => (
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
                      <SelectItem key={stream} value={stream}>Stream {stream}</SelectItem>
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
                  {teacherSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Name or number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card-elevated p-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">All Students</p>
                <p className="text-2xl font-bold text-foreground">{allStudentsInClass.length}</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selected</p>
                <p className="text-2xl font-bold text-foreground">{selectedStudentIds.size}</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Not Selected</p>
                <p className="text-2xl font-bold text-foreground">{allStudentsInClass.length - selectedStudentIds.size}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Deselect All
          </Button>
        </div>

        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">
            Students in {selectedClass} ({filteredStudents.length})
          </h3>
          
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No students in this class</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map((student) => {
                const isSelected = selectedStudentIds.has(student.id);
                return (
                  <div
                    key={student.id}
                    onClick={() => toggleStudent(student.id)}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleStudent(student.id)}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">#{student.roll_number}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
