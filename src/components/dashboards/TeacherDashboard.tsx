import { useState, useEffect } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { TopStudents } from '@/components/dashboard/TopStudents';
import { ClipboardList, Users, CheckCircle, Clock, BookOpen, Loader2, MessageSquare, User, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FeedbackItem {
  id: string;
  parent_id: string;
  student_id: string;
  message: string;
  status: string;
  created_at: string;
  recipient_type: string;
  parentName?: string;
  studentName?: string;
  studentClass?: string;
}


interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Student {
  id: string;
  full_name: string;
  class: string;
  roll_number: string;
}

interface Mark {
  id: string;
  student_id: string;
  subject_id: string;
  class: string;
  total: number;
  grade: string;
  students?: {
    full_name: string;
    class: string;
  };
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  class: string;
  subject_id: string;
  academic_year: string;
}

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [teacherData, setTeacherData] = useState<{
    classes: string[];
    subjects: string[];
    full_name: string;
  } | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      // Get teacher data
      const { data: teacher } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      // Get teacher assignments
      const { data: assignmentsData } = await supabase
        .from('teacher_assignments')
        .select('*')
        .eq('teacher_id', user.id);
      
      if (assignmentsData) {
        setAssignments(assignmentsData);
      }
      
      // Get unique classes from assignments
      const assignedClasses = [...new Set(assignmentsData?.map(a => a.class) || [])];
      
      if (teacher) {
        setTeacherData({
          classes: assignedClasses.length > 0 ? assignedClasses : (teacher.classes || []),
          subjects: teacher.subjects || [],
          full_name: teacher.full_name
        });
        
        if (assignedClasses.length > 0) {
          setSelectedClass(assignedClasses[0]);
        }
      }
      
      // Get assigned subject IDs from assignments
      const assignedSubjectIds = [...new Set(assignmentsData?.map(a => a.subject_id) || [])];
      
      // Get ONLY students from assigned classes
      let filteredStudents: Student[] = [];
      if (assignedClasses.length > 0) {
        const { data: studentsData } = await supabase
          .from('students')
          .select('*')
          .in('class', assignedClasses)
          .order('full_name');
        
        if (studentsData) filteredStudents = studentsData;
      }
      setStudents(filteredStudents);
      
      // Get ONLY assigned subjects
      let filteredSubjects: Subject[] = [];
      if (assignedSubjectIds.length > 0) {
        const { data: subjectsData } = await supabase
          .from('subjects')
          .select('*')
          .in('id', assignedSubjectIds);
        
        if (subjectsData) filteredSubjects = subjectsData;
      }
      setSubjects(filteredSubjects);
      
      // Get marks only for assigned classes and subjects
      let filteredMarks: Mark[] = [];
      if (assignedClasses.length > 0 && assignedSubjectIds.length > 0) {
        const { data: marksData } = await supabase
          .from('marks')
          .select('*, students(full_name, class)')
          .in('class', assignedClasses)
          .in('subject_id', assignedSubjectIds);
        
        if (marksData) filteredMarks = marksData as Mark[];
      }
      setMarks(filteredMarks);
      
      // Get feedback for teacher's classes
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('*')
        .eq('recipient_type', 'teacher')
        .order('created_at', { ascending: false });
      
      if (feedbackData && assignedClasses.length > 0) {
        const { data: parentsData } = await supabase.from('parents').select('id, full_name');
        const { data: studentsData } = await supabase.from('students').select('id, full_name, class');
        
        const enrichedFeedback = feedbackData.map(fb => {
          const parent = parentsData?.find(p => p.id === fb.parent_id);
          const student = studentsData?.find(s => s.id === fb.student_id);
          return {
            ...fb,
            parentName: parent?.full_name || 'Parent',
            studentName: student?.full_name || 'Student',
            studentClass: student?.class || ''
          };
        }).filter(fb => assignedClasses.includes(fb.studentClass));
        
        setFeedback(enrichedFeedback as FeedbackItem[]);
      }
      
      setIsLoading(false);
    };
    
    fetchData();
  }, [user]);

  // Update selected subject when class changes
  useEffect(() => {
    if (selectedClass && assignments.length > 0) {
      const classAssignments = assignments.filter(a => a.class === selectedClass);
      if (classAssignments.length > 0) {
        setSelectedSubject(classAssignments[0].subject_id);
      }
    }
  }, [selectedClass, assignments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Get assigned classes
  const assignedClasses = [...new Set(assignments.map(a => a.class))];
  
  // Get subjects assigned for selected class
  const classSubjectIds = assignments
    .filter(a => a.class === selectedClass)
    .map(a => a.subject_id);
  const classSubjects = subjects.filter(s => classSubjectIds.includes(s.id));

  const studentsInClass = students.filter(s => s.class === selectedClass);
  const totalStudents = assignedClasses.reduce((sum, cls) => 
    sum + students.filter(s => s.class === cls).length, 0
  );
  
  // Calculate marks submitted vs pending for assigned subjects only
  const classesWithMarks = new Set<string>();
  assignments.forEach(assignment => {
    const hasMarks = marks.some(m => m.class === assignment.class && m.subject_id === assignment.subject_id);
    if (hasMarks) {
      classesWithMarks.add(`${assignment.class}-${assignment.subject_id}`);
    }
  });
  
  const totalAssignments = assignments.length;
  const completedAssignments = classesWithMarks.size;
  const pendingAssignments = totalAssignments - completedAssignments;
  
  // Performance data for selected class and subject
  const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
  const classMarks = marks.filter(m => m.students?.class === selectedClass && m.subject_id === selectedSubject);
  
  // Performance data shows only assigned subjects for the selected class
  const performanceData = classSubjects.map(sub => {
    const subjectMarks = marks.filter(m => m.students?.class === selectedClass && m.subject_id === sub.id);
    const avg = subjectMarks.length > 0 
      ? subjectMarks.reduce((sum, m) => sum + m.total, 0) / subjectMarks.length 
      : 0;
    return {
      name: sub.name.slice(0, 6),
      value: Math.round(avg),
      average: 60
    };
  });
  
  // Top students for selected class and subject
  const studentAverages = studentsInClass.map(student => {
    const studentMarks = marks.filter(m => m.student_id === student.id && m.subject_id === selectedSubject);
    const avg = studentMarks.length > 0 
      ? studentMarks.reduce((sum, m) => sum + m.total, 0) / studentMarks.length 
      : 0;
    return {
      ...student,
      average: Math.round(avg),
      grade: avg >= 75 ? 'A' : avg >= 65 ? 'B' : avg >= 50 ? 'C' : avg >= 40 ? 'D' : 'F'
    };
  }).sort((a, b) => b.average - a.average);
  
  const topStudents = studentAverages.slice(0, 3).map((s, i) => ({
    rank: i + 1,
    name: s.full_name,
    class: s.class,
    average: s.average,
    grade: s.grade
  }));

  // Classes and subjects status
  const classSubjectStatus = assignments.map(assignment => {
    const subject = subjects.find(s => s.id === assignment.subject_id);
    const hasMarks = classesWithMarks.has(`${assignment.class}-${assignment.subject_id}`);
    const studentCount = students.filter(s => s.class === assignment.class).length;
    return {
      class: assignment.class,
      subject: subject?.name || 'Unknown',
      subject_id: assignment.subject_id,
      students: studentCount,
      status: hasMarks ? 'completed' : 'pending'
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {teacherData?.full_name || user?.name}!</p>
        </div>
        <Button 
          className="btn-gradient"
          onClick={() => navigate('/marks-entry')}
        >
          <ClipboardList className="w-4 h-4 mr-2" />
          Enter Marks
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="My Classes"
          value={assignedClasses.length.toString()}
          subtitle="Assigned classes"
          icon={BookOpen}
          variant="primary"
        />
        <StatCard
          title="Total Students"
          value={totalStudents.toString()}
          subtitle="Across all classes"
          icon={Users}
          variant="accent"
        />
        <StatCard
          title="Completed"
          value={completedAssignments.toString()}
          subtitle={`Out of ${totalAssignments} assignments`}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Pending"
          value={pendingAssignments.toString()}
          subtitle="Assignments remaining"
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Class & Subject Selector and Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PerformanceChart 
            data={performanceData} 
            title={`${selectedClass} - Subject Performance`}
          />
        </div>
        
        <div className="space-y-6">
          {/* Class & Subject Selector */}
          <div className="card-elevated p-6 animate-fade-in">
            <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Select Class & Subject</h3>
            <div className="space-y-4">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {assignedClasses.map((cls) => (
                    <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {classSubjects.length > 0 && (
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {classSubjects.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Students in class</p>
                <p className="text-2xl font-bold text-card-foreground">{studentsInClass.length}</p>
              </div>
            </div>
          </div>

          <TopStudents 
            students={topStudents} 
            title={`Top Students - ${selectedSubjectData?.name || ''}`}
          />
        </div>
      </div>

      {/* Marks Entry Status */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Marks Entry Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Class</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Students</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {classSubjectStatus.length > 0 ? classSubjectStatus.map((item, index) => (
                <tr key={index} className="border-b border-border/50 table-row-hover">
                  <td className="py-4 px-4 font-medium text-card-foreground">{item.class}</td>
                  <td className="py-4 px-4 text-card-foreground">{item.subject}</td>
                  <td className="py-4 px-4 text-card-foreground">{item.students}</td>
                  <td className="py-4 px-4">
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        <CheckCircle className="w-3 h-3" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Button 
                      variant={item.status === 'completed' ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => navigate('/marks-entry')}
                    >
                      {item.status === 'completed' ? 'View' : 'Enter Marks'}
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No classes assigned. Please contact Admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parent Messages */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Parent Messages
          </h3>
          <Button variant="outline" size="sm" onClick={() => navigate('/feedback')}>
            View All
          </Button>
        </div>
        
        {feedback.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No messages from parents yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {feedback.slice(0, 5).map((fb) => (
              <div key={fb.id} className="py-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-card-foreground">{fb.parentName}</p>
                        <p className="text-sm text-muted-foreground">
                          About: {fb.studentName} ({fb.studentClass})
                        </p>
                      </div>
                      {fb.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                          <Clock className="w-3 h-3" />Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                          <CheckCircle className="w-3 h-3" />Reviewed
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-card-foreground line-clamp-2">{fb.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(fb.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
