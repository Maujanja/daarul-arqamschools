import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { StudentAvatarUpload } from '@/components/StudentAvatarUpload';
import { CLASS_STREAMS, getStreamsForClass, hasStreams } from '@/utils/classStreams';

import { 
  Users, 
  GraduationCap, 
  Plus, 
  Search,
  Loader2,
  UserPlus,
  Camera,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  class: string;
  stream: string | null;
  roll_number: string;
  boarding_type?: string;
  gender?: string;
  avatar_url?: string | null;
}

const ALL_CLASSES = Object.keys(CLASS_STREAMS);

export function SecretaryDashboard({ isAdminMode = false }: { isAdminMode?: boolean } = {}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fetchTable } = useSecureQuery();
  const { insert, update } = useSecureData();
  const { academicYears, currentYear } = useAcademicYears();
  
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState(currentYear || '');
  
  // Add student dialog
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');
  const [newStudentStream, setNewStudentStream] = useState('');
  const [newStudentRollNumber, setNewStudentRollNumber] = useState('');
  const [newStudentGender, setNewStudentGender] = useState('Male');
  const [newStudentBoardingType, setNewStudentBoardingType] = useState('day');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo dialog
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [selectedStudentForPhoto, setSelectedStudentForPhoto] = useState<Student | null>(null);

  useEffect(() => {
    if (currentYear) setSelectedYear(currentYear);
  }, [currentYear]);

  useEffect(() => {
    if (selectedYear) fetchData();
  }, [selectedYear]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const studentsRes = await fetchTable<Student>('students');
      setStudents(studentsRes || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTable]);

  const handleAddStudent = async () => {
    if (!newStudentName || !newStudentClass || !newStudentRollNumber) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await insert('students', {
      full_name: newStudentName.trim(),
      class: newStudentClass,
      stream: newStudentStream || null,
      roll_number: newStudentRollNumber.trim(),
      gender: newStudentGender,
      boarding_type: newStudentBoardingType,
    });
    if (result.success) {
      toast({ title: "Success", description: "Student registered successfully" });
      setShowAddStudentDialog(false);
      setNewStudentName('');
      setNewStudentClass('');
      setNewStudentStream('');
      setNewStudentRollNumber('');
      setNewStudentGender('Male');
      setNewStudentBoardingType('day');
      fetchData();
    } else {
      toast({ title: "Error", description: result.error || "Failed to add student", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleAvatarChange = async (studentId: string, url: string) => {
    await update('students', { avatar_url: url }, { id: studentId });
    fetchData();
  };

  const toggleClassExpand = (className: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  };

  const studentsByClass = students.reduce((acc, student) => {
    if (!acc[student.class]) acc[student.class] = [];
    acc[student.class].push(student);
    return acc;
  }, {} as Record<string, Student[]>);

  const filteredStudents = students.filter(s => {
    const matchesSearch = !searchQuery || 
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.class === selectedClass;
    return matchesSearch && matchesClass;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {isAdminMode ? 'Student & Teacher Management' : 'Secretary Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-1">Student and Teacher Admissions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate('/students')}>
            <GraduationCap className="w-4 h-4 mr-2" />
            Manage Students
          </Button>
          <Button variant="outline" onClick={() => navigate('/teachers')}>
            <Users className="w-4 h-4 mr-2" />
            Manage Teachers
          </Button>
          <Button className="btn-gradient" onClick={() => setShowAddStudentDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Students"
          value={students.length.toString()}
          subtitle="Registered"
          icon={Users}
          variant="primary"
          bgStyle="silk"
        />
        <StatCard
          title="Classes"
          value={ALL_CLASSES.length.toString()}
          subtitle="Available"
          icon={GraduationCap}
          variant="accent"
          bgStyle="cherries"
        />
        <StatCard
          title="New Today"
          value={students.filter(s => {
            const today = new Date().toISOString().split('T')[0];
            return s.roll_number && true; // placeholder
          }).length.toString()}
          subtitle="Registrations"
          icon={UserPlus}
          variant="success"
          bgStyle="silk"
        />
      </div>

      {/* Students by Class */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground">Students by Class</h3>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {ALL_CLASSES.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {selectedClass === 'all' && !searchQuery ? (
          <div className="space-y-4">
            {ALL_CLASSES.map((className) => {
              const classStudents = studentsByClass[className] || [];
              if (classStudents.length === 0) return null;
              const isExpanded = expandedClasses.has(className);
              return (
                <div key={className} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleClassExpand(className)}
                    className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-card-foreground">{className}</span>
                      <span className="text-sm text-muted-foreground">{classStudents.length} students</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Roll #</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Stream</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Gender</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Photo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classStudents.sort((a, b) => a.full_name.localeCompare(b.full_name)).map((student) => (
                            <tr key={student.id} className="border-b border-border/50 table-row-hover">
                              <td className="py-3 px-4 font-medium text-card-foreground">
                                <div className="flex items-center gap-3">
                                  <StudentAvatarUpload
                                    studentId={student.id}
                                    studentName={student.full_name}
                                    currentAvatarUrl={student.avatar_url}
                                    onAvatarChange={(url) => handleAvatarChange(student.id, url)}
                                    size="sm"
                                    editable={false}
                                  />
                                  {student.full_name}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-card-foreground">{student.roll_number}</td>
                              <td className="py-3 px-4 text-card-foreground">{student.stream || '-'}</td>
                              <td className="py-3 px-4 text-card-foreground">{student.gender || '-'}</td>
                              <td className="py-3 px-4 text-card-foreground capitalize">{student.boarding_type || 'day'}</td>
                              <td className="py-3 px-4 text-right">
                                <Button size="icon" variant="outline" className="h-8 w-8"
                                  onClick={() => { setSelectedStudentForPhoto(student); setShowPhotoDialog(true); }}>
                                  <Camera className="w-3 h-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Class</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Roll #</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Gender</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-border/50 table-row-hover">
                    <td className="py-4 px-4 font-medium text-card-foreground">{student.full_name}</td>
                    <td className="py-4 px-4 text-card-foreground">{student.stream ? `${student.class} ${student.stream}` : student.class}</td>
                    <td className="py-4 px-4 text-card-foreground">{student.roll_number}</td>
                    <td className="py-4 px-4 text-card-foreground">{student.gender || '-'}</td>
                    <td className="py-4 px-4 text-card-foreground capitalize">{student.boarding_type || 'day'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg text-card-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/students')}>
            <GraduationCap className="w-6 h-6" />
            <span>Students Page</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/teachers')}>
            <Users className="w-6 h-6" />
            <span>Teachers Page</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowAddStudentDialog(true)}>
            <UserPlus className="w-6 h-6" />
            <span>Register New Student</span>
          </Button>
        </div>
      </div>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Register New Student
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Enter student full name" />
            </div>
            <div className="space-y-2">
              <Label>Roll Number *</Label>
              <Input value={newStudentRollNumber} onChange={(e) => setNewStudentRollNumber(e.target.value)} placeholder="Enter roll number" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={newStudentClass} onValueChange={(v) => { setNewStudentClass(v); setNewStudentStream(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {ALL_CLASSES.map((cls) => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasStreams(newStudentClass) && (
                <div className="space-y-2">
                  <Label>Stream *</Label>
                  <Select value={newStudentStream} onValueChange={setNewStudentStream}>
                    <SelectTrigger><SelectValue placeholder="Select stream" /></SelectTrigger>
                    <SelectContent>
                      {getStreamsForClass(newStudentClass).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={newStudentGender} onValueChange={setNewStudentGender}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Boarding Type</Label>
                <Select value={newStudentBoardingType} onValueChange={setNewStudentBoardingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="boarding">Boarding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStudentDialog(false)}>Cancel</Button>
            <Button onClick={handleAddStudent} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Student Photo
            </DialogTitle>
          </DialogHeader>
          {selectedStudentForPhoto && (
            <div className="flex flex-col items-center gap-4 py-4">
              <StudentAvatarUpload
                studentId={selectedStudentForPhoto.id}
                studentName={selectedStudentForPhoto.full_name}
                currentAvatarUrl={selectedStudentForPhoto.avatar_url}
                onAvatarChange={(url) => handleAvatarChange(selectedStudentForPhoto.id, url)}
                size="xl"
                editable={true}
              />
              <p className="font-medium text-lg">{selectedStudentForPhoto.full_name}</p>
              <p className="text-sm text-muted-foreground">{selectedStudentForPhoto.class}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhotoDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
