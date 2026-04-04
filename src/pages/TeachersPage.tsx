import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { getStreamsForClass, hasStreams, getClassStreamDisplay } from '@/utils/classStreams';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { Search, Plus, MoreHorizontal, Users, BookOpen, Loader2, Mail, Settings } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  subjects: string[];
  classes: string[];
  created_at: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  class: string;
  subject_id: string;
  academic_year: string;
  stream: string | null;
}

const ALL_CLASSES = ['Baby Class', 'Kindergarten I', 'Kindergarten II', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7', 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'];

const SECTION_BASE_CLASSES: Record<string, string[]> = {
  head_nursery: ['Baby Class', 'Kindergarten I', 'Kindergarten II'],
  head_primary: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7'],
  head_secondary: ['Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'],
};

// Generate class+stream slots for assignments
function buildClassStreamSlots(classes: string[]) {
  const slots: { className: string; stream: string | null; key: string; display: string }[] = [];
  classes.forEach(cls => {
    const streams = getStreamsForClass(cls);
    if (streams.length === 0) {
      slots.push({ className: cls, stream: null, key: cls, display: cls });
    } else {
      streams.forEach(stream => {
        slots.push({ className: cls, stream, key: `${cls}|${stream}`, display: `${cls} ${stream}` });
      });
    }
  });
  return slots;
}

const ALL_CLASS_STREAM_SLOTS = buildClassStreamSlots(ALL_CLASSES);

export default function TeachersPage() {
  const { user } = useAuth();
  const { currentYear } = useAcademicYears();
  const { fetchTable } = useSecureQuery();
  const { insert, update, remove, upsert } = useSecureData();
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [newTeacher, setNewTeacher] = useState({
    full_name: '',
    email: '',
    password: '',
  });
  const [editTeacher, setEditTeacher] = useState({
    full_name: '',
    email: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  // Assignment state - class -> subject ids
  const [classSubjectAssignments, setClassSubjectAssignments] = useState<Record<string, Set<string>>>({});

  const isAdmin = user?.role === 'admin';
  const isHoS = user?.role?.startsWith('head_');
  const canManageAssignments = isAdmin || isHoS;
  const sectionClasses = isHoS ? (SECTION_BASE_CLASSES[user?.role || ''] || []) : ALL_CLASSES;
  const sectionSlots = isHoS ? buildClassStreamSlots(sectionClasses) : ALL_CLASS_STREAM_SLOTS;

  useEffect(() => {
    console.log('TeachersPage: Component mounted, fetching data...');
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('TeachersPage: Fetching teachers data via secure query...');
      
      const [teachersData, subjectsData, assignmentsData] = await Promise.all([
        fetchTable<Teacher>('teachers', undefined, { orderBy: { column: 'full_name', ascending: true } }),
        fetchTable<Subject>('subjects', undefined, { orderBy: { column: 'name', ascending: true } }),
        fetchTable<TeacherAssignment>('teacher_assignments')
      ]);

      console.log('TeachersPage: Teachers fetched:', teachersData?.length || 0);
      console.log('TeachersPage: Subjects fetched:', subjectsData?.length || 0);
      console.log('TeachersPage: Assignments fetched:', assignmentsData?.length || 0);

      setTeachers(teachersData || []);
      setSubjects(subjectsData || []);
      setAssignments(assignmentsData || []);
    } catch (err: any) {
      console.error('TeachersPage: Error fetching data:', err);
      setError(`Error: ${err.message || 'Unknown error'}`);
      toast.error('Failed to fetch data');
    } finally {
      console.log('TeachersPage: Data fetch complete, setting loading to false');
      setLoading(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!newTeacher.full_name || !newTeacher.email || !newTeacher.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const result = await insert('teachers', {
        full_name: newTeacher.full_name,
        email: newTeacher.email,
        password_hash: newTeacher.password,
        subjects: [],
        classes: [],
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Teacher added successfully');
      setShowAddDialog(false);
      setNewTeacher({ full_name: '', email: '', password: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error adding teacher:', error);
      toast.error(error.message || 'Failed to add teacher');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    try {
      const result = await remove('teachers', { id });
      if (!result.success) throw new Error(result.error);
      toast.success('Teacher deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting teacher:', error);
      toast.error(error.message || 'Failed to delete teacher');
    }
  };

  const handleViewTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowViewDialog(true);
  };

  const handleOpenEditDialog = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setEditTeacher({
      full_name: teacher.full_name,
      email: teacher.email,
      password: '',
    });
    setShowEditDialog(true);
  };

  const handleOpenAssignDialog = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    
    // Load existing assignments for this teacher
    const teacherAssigns = assignments.filter(a => a.teacher_id === teacher.id);
    const assignmentMap: Record<string, Set<string>> = {};
    
    teacherAssigns.forEach(a => {
      const key = a.stream ? `${a.class}|${a.stream}` : a.class;
      if (!assignmentMap[key]) {
        assignmentMap[key] = new Set();
      }
      assignmentMap[key].add(a.subject_id);
    });
    
    setClassSubjectAssignments(assignmentMap);
    setShowAssignDialog(true);
  };

  const toggleSubjectForClass = (slotKey: string, subjectId: string) => {
    setClassSubjectAssignments(prev => {
      const newMap = { ...prev };
      if (!newMap[slotKey]) {
        newMap[slotKey] = new Set();
      } else {
        newMap[slotKey] = new Set(newMap[slotKey]);
      }
      
      if (newMap[slotKey].has(subjectId)) {
        newMap[slotKey].delete(subjectId);
      } else {
        newMap[slotKey].add(subjectId);
      }
      
      if (newMap[slotKey].size === 0) {
        delete newMap[slotKey];
      }
      
      return newMap;
    });
  };

  const handleSaveAssignments = async () => {
    if (!selectedTeacher) return;

    try {
      setSaving(true);

      // Build new assignments list
      const newAssignments: { teacher_id: string; class: string; subject_id: string; academic_year: string; stream: string | null }[] = [];
      
      Object.entries(classSubjectAssignments).forEach(([slotKey, subjectIds]) => {
        const slot = ALL_CLASS_STREAM_SLOTS.find(s => s.key === slotKey);
        const className = slot?.className || slotKey;
        const stream = slot?.stream || null;
        
        subjectIds.forEach(subjectId => {
          newAssignments.push({
            teacher_id: selectedTeacher.id,
            class: className,
            subject_id: subjectId,
            academic_year: currentYear,
            stream,
          });
        });
      });

      // Delete existing assignments for this teacher for current year, then insert new ones
      const deleteResult = await remove('teacher_assignments', { teacher_id: selectedTeacher.id, academic_year: currentYear });
      console.log('Delete result:', deleteResult);

      if (newAssignments.length > 0) {
        const result = await insert('teacher_assignments', newAssignments);
        console.log('Insert result:', result);
        if (!result.success) throw new Error(result.error);
      }

      // Update teacher's classes and subjects arrays for backwards compatibility
      const assignedClasses = [...new Set(newAssignments.map(a => a.stream ? `${a.class} ${a.stream}` : a.class))];
      const assignedSubjectIds = new Set<string>();
      Object.values(classSubjectAssignments).forEach(subjectSet => {
        subjectSet.forEach(id => assignedSubjectIds.add(id));
      });
      
      const assignedSubjectNames = subjects
        .filter(s => assignedSubjectIds.has(s.id))
        .map(s => s.name);

      await update('teachers', {
        classes: assignedClasses,
        subjects: assignedSubjectNames
      }, { id: selectedTeacher.id });

      toast.success('Teacher assignments saved successfully');
      setShowAssignDialog(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving assignments:', error);
      toast.error(error.message || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTeacher = async () => {
    if (!selectedTeacher || !editTeacher.full_name || !editTeacher.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      
      const updateData: Record<string, unknown> = {
        full_name: editTeacher.full_name,
        email: editTeacher.email,
      };

      if (editTeacher.password) {
        updateData.password_hash = editTeacher.password;
      }

      const result = await update('teachers', updateData, { id: selectedTeacher.id });
      if (!result.success) throw new Error(result.error);

      toast.success('Teacher updated successfully');
      setShowEditDialog(false);
      setSelectedTeacher(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating teacher:', error);
      toast.error(error.message || 'Failed to update teacher');
    } finally {
      setSaving(false);
    }
  };

  // Get assignments for a specific teacher
  const getTeacherAssignments = (teacherId: string) => {
    const teacherAssigns = assignments.filter(a => a.teacher_id === teacherId);
    const classSubjectMap: Record<string, string[]> = {};
    
    teacherAssigns.forEach(a => {
      const displayKey = a.stream ? `${a.class} ${a.stream}` : a.class;
      const subjectName = subjects.find(s => s.id === a.subject_id)?.name || 'Unknown';
      if (!classSubjectMap[displayKey]) {
        classSubjectMap[displayKey] = [];
      }
      classSubjectMap[displayKey].push(subjectName);
    });
    
    return classSubjectMap;
  };

  const filteredTeachers = teachers.filter(teacher =>
    teacher.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading teachers data...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Users className="w-16 h-16 text-destructive" />
          <h2 className="text-xl font-semibold text-foreground">An Error Occurred</h2>
          <p className="text-muted-foreground text-center max-w-md">{error}</p>
          <Button onClick={fetchData} variant="outline">
            Try Again
          </Button>
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
            <h1 className="text-3xl font-display font-bold text-foreground">Teachers</h1>
            <p className="text-muted-foreground mt-1">Manage teacher information and class assignments</p>
          </div>
          {isAdmin && (
            <Button className="btn-gradient" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Teacher
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="card-elevated p-6 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
        </div>

        {/* Teachers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeachers.map((teacher, index) => {
            const teacherAssignments = getTeacherAssignments(teacher.id);
            const assignedClasses = Object.keys(teacherAssignments);
            
            return (
              <div 
                key={teacher.id} 
                className="card-elevated p-6 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-success flex items-center justify-center text-primary-foreground font-bold text-lg">
                    {teacher.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewTeacher(teacher)}>
                        View Details
                      </DropdownMenuItem>
                      {canManageAssignments && (
                        <>
                          <DropdownMenuItem onClick={() => handleOpenAssignDialog(teacher)}>
                            <Settings className="w-4 h-4 mr-2" />
                            Manage Assignments
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(teacher)}>
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteTeacher(teacher.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="font-display font-semibold text-lg text-card-foreground mb-1">
                  {teacher.full_name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {teacher.email}
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">Classes: </span>
                      <span className="font-medium text-card-foreground">
                        {assignedClasses.length > 0 ? assignedClasses.join(', ') : 'None assigned'}
                      </span>
                    </div>
                  </div>
                  {assignedClasses.length > 0 && (
                    <div className="text-xs text-muted-foreground pl-6 space-y-1">
                      {assignedClasses.slice(0, 3).map(cls => (
                        <div key={cls}>
                          <span className="font-medium">{cls}:</span> {teacherAssignments[cls].join(', ')}
                        </div>
                      ))}
                      {assignedClasses.length > 3 && (
                        <div className="text-primary">+{assignedClasses.length - 3} more classes</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredTeachers.length === 0 && (
          <div className="card-elevated p-12 text-center animate-fade-in">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">
              No teachers found
            </h3>
            <p className="text-muted-foreground">Try adjusting your search criteria</p>
          </div>
        )}
      </div>

      {/* Add Teacher Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Teacher</DialogTitle>
            <DialogDescription>
              Fill in the new teacher's information below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={newTeacher.full_name}
                onChange={(e) => setNewTeacher({ ...newTeacher, full_name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newTeacher.email}
                onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                placeholder="example@school.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newTeacher.password}
                onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                placeholder="Login password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTeacher} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Teacher Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Teacher Details</DialogTitle>
            <DialogDescription>
              Viewing information for {selectedTeacher?.full_name}
            </DialogDescription>
          </DialogHeader>
          {selectedTeacher && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-success flex items-center justify-center text-primary-foreground font-bold text-xl">
                  {selectedTeacher.full_name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedTeacher.full_name}</h3>
                  <p className="text-muted-foreground">{selectedTeacher.email}</p>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <div>
                  <Label className="text-muted-foreground">Class & Subject Assignments</Label>
                  <div className="mt-2 space-y-2">
                    {Object.entries(getTeacherAssignments(selectedTeacher.id)).length > 0 ? (
                      Object.entries(getTeacherAssignments(selectedTeacher.id)).map(([cls, subjectList]) => (
                        <div key={cls} className="p-3 rounded-lg bg-muted/50">
                          <p className="font-medium text-card-foreground">{cls}</p>
                          <p className="text-sm text-muted-foreground">{subjectList.join(', ')}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No assignments yet</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Joined</Label>
                  <p className="font-medium">
                    {new Date(selectedTeacher.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>
              Update teacher information below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editTeacher.full_name}
                onChange={(e) => setEditTeacher({ ...editTeacher, full_name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editTeacher.email}
                onChange={(e) => setEditTeacher({ ...editTeacher, email: e.target.value })}
                placeholder="example@school.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Password (leave empty to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={editTeacher.password}
                onChange={(e) => setEditTeacher({ ...editTeacher, password: e.target.value })}
                placeholder="New password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTeacher} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Classes & Subjects Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Class & Subject Assignments</DialogTitle>
            <DialogDescription>
              Assign {selectedTeacher?.full_name} to classes and specific subjects within each class
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select the subjects this teacher will teach in each class. The teacher will only be able to enter marks for their assigned classes and subjects.
            </p>
            
            <div className="space-y-4">
              {ALL_CLASS_STREAM_SLOTS.map(slot => {
                const assignedSubjects = classSubjectAssignments[slot.key] || new Set();
                const hasAssignmentsForSlot = assignedSubjects.size > 0;
                
                return (
                  <div key={slot.key} className={`border rounded-lg p-4 ${hasAssignmentsForSlot ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-card-foreground">{slot.display}</h4>
                      <span className="text-xs text-muted-foreground">
                        {assignedSubjects.size} subjects selected
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {subjects.map(subject => (
                        <div 
                          key={subject.id} 
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`${slot.key}-${subject.id}`}
                            checked={assignedSubjects.has(subject.id)}
                            onCheckedChange={() => toggleSubjectForClass(slot.key, subject.id)}
                          />
                          <label 
                            htmlFor={`${slot.key}-${subject.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {subject.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignments} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
