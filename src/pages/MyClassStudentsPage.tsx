import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Save, Users, UserPlus, CheckCircle } from 'lucide-react';

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
}

interface TeacherClassStudent {
  id: string;
  teacher_id: string;
  student_id: string;
  class: string;
  subject_id: string;
  academic_year: string;
}

export default function MyClassStudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<Subject[]>([]);
  const [allStudentsInClass, setAllStudentsInClass] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [existingSelections, setExistingSelections] = useState<TeacherClassStudent[]>([]);

  // Map short class codes to full class names
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
      'F3A': 'Form 3 A',
    };
    return mappings[shortClass] || shortClass;
  };

  // Fetch teacher's assigned classes and subjects
  useEffect(() => {
    const fetchTeacherData = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      
      // Get teacher data
      const { data: teacher } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (!teacher) {
        setIsLoading(false);
        return;
      }
      
      // Map short class codes to full names
      const rawClasses = teacher.classes || [];
      const mappedClasses = rawClasses.map((cls: string) => mapClassToFullName(cls));
      const subjectNames = teacher.subjects || [];
      
      setTeacherClasses(mappedClasses);
      
      if (mappedClasses.length > 0) {
        setSelectedClass(mappedClasses[0]);
      }
      
      // Get subjects matching teacher's subject names
      const { data: allSubjects } = await supabase
        .from('subjects')
        .select('*');
      
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
  }, [user?.id]);

  // Fetch students when class changes
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClass) return;
      
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('class', selectedClass)
        .order('roll_number');
      
      setAllStudentsInClass(students || []);
    };
    
    fetchStudents();
  }, [selectedClass]);

  // Fetch existing selections when class/subject changes
  useEffect(() => {
    const fetchExistingSelections = async () => {
      if (!user?.id || !selectedClass || !selectedSubject) return;
      
      const { data: selections } = await supabase
        .from('teacher_class_students')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('class', selectedClass)
        .eq('subject_id', selectedSubject);
      
      setExistingSelections(selections || []);
      
      // Set selected student IDs from existing selections
      const selectedIds = new Set((selections || []).map(s => s.student_id));
      setSelectedStudentIds(selectedIds);
    };
    
    fetchExistingSelections();
  }, [user?.id, selectedClass, selectedSubject]);

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
    if (!user?.id || !selectedClass || !selectedSubject) return;
    
    setIsSaving(true);
    
    try {
      // Delete existing selections for this class/subject
      await supabase
        .from('teacher_class_students')
        .delete()
        .eq('teacher_id', user.id)
        .eq('class', selectedClass)
        .eq('subject_id', selectedSubject);
      
      // Insert new selections
      if (selectedStudentIds.size > 0) {
        const insertData = Array.from(selectedStudentIds).map(studentId => ({
          teacher_id: user.id,
          student_id: studentId,
          class: selectedClass,
          subject_id: selectedSubject,
          academic_year: '2024-2025',
        }));
        
        const { error } = await supabase
          .from('teacher_class_students')
          .insert(insertData);
        
        if (error) throw error;
      }
      
      toast({
        title: "Wanafunzi Wamehifadhiwa!",
        description: `Umechagua wanafunzi ${selectedStudentIds.size} kwa ${selectedClass} - ${teacherSubjects.find(s => s.id === selectedSubject)?.name}`,
      });
      
      // Refresh existing selections
      const { data: selections } = await supabase
        .from('teacher_class_students')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('class', selectedClass)
        .eq('subject_id', selectedSubject);
      
      setExistingSelections(selections || []);
      
    } catch (error: any) {
      console.error('Error saving students:', error);
      toast({
        title: "Kosa",
        description: error.message || "Imeshindwa kuhifadhi. Jaribu tena.",
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
          <h2 className="text-xl font-semibold text-foreground mb-2">Hakuna Madarasa</h2>
          <p className="text-muted-foreground">Hujapewa darasa lolote. Wasiliana na Admin.</p>
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
            <h1 className="text-3xl font-display font-bold text-foreground">Wanafunzi Wangu</h1>
            <p className="text-muted-foreground mt-1">Chagua wanafunzi utakaowaingiza maksi</p>
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
            Hifadhi Wanafunzi ({selectedStudentIds.size})
          </Button>
        </div>

        {/* Filters */}
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Chagua Darasa na Somo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Darasa</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Chagua darasa" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses.map((cls) => (
                    <SelectItem key={cls} value={cls}>Darasa {cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Somo</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Chagua somo" />
                </SelectTrigger>
                <SelectContent>
                  {teacherSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tafuta</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Jina au namba..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card-elevated p-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wanafunzi Wote</p>
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
                <p className="text-sm text-muted-foreground">Wamechaguliwa</p>
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
                <p className="text-sm text-muted-foreground">Hawajachaguliwa</p>
                <p className="text-2xl font-bold text-foreground">{allStudentsInClass.length - selectedStudentIds.size}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Chagua Wote
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Ondoa Wote
          </Button>
        </div>

        {/* Students List */}
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">
            Wanafunzi wa {selectedClass} ({filteredStudents.length})
          </h3>
          
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Hakuna wanafunzi katika darasa hili</p>
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
