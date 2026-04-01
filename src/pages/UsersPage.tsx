import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, MoreHorizontal, UserCog, Loader2, Shield, GraduationCap, Users, DollarSign, School } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { useAuth } from '@/contexts/AuthContext';

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  password_hash: string | null;
  subjects: string[];
  classes: string[];
}

interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface Student {
  id: string;
  full_name: string;
  class: string;
  roll_number: string;
  parent_id: string | null;
}

interface Secretary {
  id: string;
  username: string;
  full_name: string;
  password_hash: string;
}

interface Accountant {
  id: string;
  username: string;
  full_name: string;
  password_hash: string;
}

interface HeadOfSchool {
  id: string;
  username: string;
  full_name: string;
  password_hash: string;
  department: string;
}

export default function UsersPage() {
  const { user } = useAuth();
  const { fetchTable } = useSecureQuery();
  const { insert, update, remove } = useSecureData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [secretaries, setSecretaries] = useState<Secretary[]>([]);
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [headsOfSchool, setHeadsOfSchool] = useState<HeadOfSchool[]>([]);
  const [activeTab, setActiveTab] = useState('teachers');
  
  // Secretary Management
  const [showAddSecretaryDialog, setShowAddSecretaryDialog] = useState(false);
  const [showEditSecretaryDialog, setShowEditSecretaryDialog] = useState(false);
  const [selectedSecretary, setSelectedSecretary] = useState<Secretary | null>(null);
  const [newSecretary, setNewSecretary] = useState({
    username: '',
    full_name: '',
    password: '',
  });
  const [editSecretary, setEditSecretary] = useState({
    username: '',
    full_name: '',
    password: '',
  });
  
  // Add Student Dialog
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [newStudent, setNewStudent] = useState({
    full_name: '',
    class: '',
    roll_number: '',
    parent_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Add Parent Dialog
  const [showAddParentDialog, setShowAddParentDialog] = useState(false);
  const [newParent, setNewParent] = useState({
    full_name: '',
    email: '',
    phone: '',
  });

  // Teacher Management
  const [showViewTeacherDialog, setShowViewTeacherDialog] = useState(false);
  const [showEditTeacherDialog, setShowEditTeacherDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [editTeacher, setEditTeacher] = useState({
    full_name: '',
    email: '',
    password: '',
    subjects: '',
    classes: '',
  });
  const [showAddTeacherDialog, setShowAddTeacherDialog] = useState(false);
  const [newTeacher, setNewTeacher] = useState({
    full_name: '',
    email: '',
    password: '',
    subjects: '',
    classes: '',
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const [teachersData, parentsData, studentsData, secretariesData] = await Promise.all([
        fetchTable<Teacher>('teachers', undefined, { orderBy: { column: 'full_name', ascending: true } }),
        fetchTable<Parent>('parents', undefined, { orderBy: { column: 'full_name', ascending: true } }),
        fetchTable<Student>('students', undefined, { orderBy: { column: 'full_name', ascending: true } }),
        fetchTable<Secretary>('secretary_credentials' as any, undefined, { orderBy: { column: 'full_name', ascending: true } }),
      ]);

      setTeachers(teachersData);
      setParents(parentsData);
      setStudents(studentsData);
      setSecretaries(secretariesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [user, fetchTable]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddStudent = async () => {
    if (!newStudent.full_name || !newStudent.class || !newStudent.roll_number) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const result = await insert('students', {
        full_name: newStudent.full_name,
        class: newStudent.class,
        roll_number: newStudent.roll_number,
        parent_id: newStudent.parent_id || null,
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Student added successfully');
      setShowAddStudentDialog(false);
      setNewStudent({ full_name: '', class: '', roll_number: '', parent_id: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error adding student:', error);
      toast.error(error.message || 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  const handleAddParent = async () => {
    if (!newParent.full_name || !newParent.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const result = await insert('parents', {
        full_name: newParent.full_name,
        email: newParent.email,
        phone: newParent.phone || null,
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Parent added successfully');
      setShowAddParentDialog(false);
      setNewParent({ full_name: '', email: '', phone: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error adding parent:', error);
      toast.error(error.message || 'Failed to add parent');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      const result = await remove('students', { id });
      if (!result.success) throw new Error(result.error);
      toast.success('Student deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast.error(error.message || 'Failed to delete student');
    }
  };

  const handleDeleteParent = async (id: string) => {
    try {
      const result = await remove('parents', { id });
      if (!result.success) throw new Error(result.error);
      toast.success('Parent deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting parent:', error);
      toast.error(error.message || 'Failed to delete parent');
    }
  };

  // Teacher Management Functions
  const handleViewTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowViewTeacherDialog(true);
  };

  const handleOpenEditTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setEditTeacher({
      full_name: teacher.full_name,
      email: teacher.email,
      password: '',
      subjects: teacher.subjects.join(', '),
      classes: teacher.classes.join(', '),
    });
    setShowEditTeacherDialog(true);
  };

  const handleEditTeacher = async () => {
    if (!selectedTeacher || !editTeacher.full_name || !editTeacher.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      
      const subjectsArray = editTeacher.subjects.split(',').map(s => s.trim()).filter(Boolean);
      const classesArray = editTeacher.classes.split(',').map(c => c.trim()).filter(Boolean);

      const updateData: Record<string, unknown> = {
        full_name: editTeacher.full_name,
        email: editTeacher.email,
        subjects: subjectsArray,
        classes: classesArray,
      };

      if (editTeacher.password) {
        updateData.password_hash = editTeacher.password;
      }

      const result = await update('teachers', updateData, { id: selectedTeacher.id });

      if (!result.success) throw new Error(result.error);

      toast.success('Teacher updated successfully');
      setShowEditTeacherDialog(false);
      setSelectedTeacher(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating teacher:', error);
      toast.error(error.message || 'Failed to update teacher');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!newTeacher.full_name || !newTeacher.email || !newTeacher.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      
      const subjectsArray = newTeacher.subjects.split(',').map(s => s.trim()).filter(Boolean);
      const classesArray = newTeacher.classes.split(',').map(c => c.trim()).filter(Boolean);

      const result = await insert('teachers', {
        full_name: newTeacher.full_name,
        email: newTeacher.email,
        password_hash: newTeacher.password,
        subjects: subjectsArray,
        classes: classesArray,
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Teacher added successfully');
      setShowAddTeacherDialog(false);
      setNewTeacher({ full_name: '', email: '', password: '', subjects: '', classes: '' });
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

  const filteredTeachers = teachers.filter(t =>
    t.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredParents = parents.filter(p =>
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSecretaries = secretaries.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Secretary Management Functions
  const handleAddSecretary = async () => {
    if (!newSecretary.username || !newSecretary.full_name || !newSecretary.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const result = await insert('secretary_credentials', {
        username: newSecretary.username,
        full_name: newSecretary.full_name,
        password_hash: newSecretary.password,
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Secretary added successfully');
      setShowAddSecretaryDialog(false);
      setNewSecretary({ username: '', full_name: '', password: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error adding secretary:', error);
      toast.error(error.message || 'Failed to add secretary');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditSecretary = (secretary: Secretary) => {
    setSelectedSecretary(secretary);
    setEditSecretary({
      username: secretary.username,
      full_name: secretary.full_name,
      password: '',
    });
    setShowEditSecretaryDialog(true);
  };

  const handleEditSecretary = async () => {
    if (!selectedSecretary || !editSecretary.username || !editSecretary.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const updateData: Record<string, unknown> = {
        username: editSecretary.username,
        full_name: editSecretary.full_name,
      };

      if (editSecretary.password) {
        updateData.password_hash = editSecretary.password;
      }

      const result = await update('secretary_credentials', updateData, { id: selectedSecretary.id });

      if (!result.success) throw new Error(result.error);

      toast.success('Secretary updated successfully');
      setShowEditSecretaryDialog(false);
      setSelectedSecretary(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating secretary:', error);
      toast.error(error.message || 'Failed to update secretary');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSecretary = async (id: string) => {
    try {
      const result = await remove('secretary_credentials', { id });
      if (!result.success) throw new Error(result.error);
      toast.success('Secretary deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting secretary:', error);
      toast.error(error.message || 'Failed to delete secretary');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage teachers, parents, and students</p>
        </div>

        {/* Search */}
        <div className="card-elevated p-6 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="teachers" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Teachers ({filteredTeachers.length})
            </TabsTrigger>
            <TabsTrigger value="secretaries" className="flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Secretaries ({filteredSecretaries.length})
            </TabsTrigger>
            <TabsTrigger value="parents" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Parents ({filteredParents.length})
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Students ({filteredStudents.length})
            </TabsTrigger>
          </TabsList>

          {/* Teachers Tab */}
          <TabsContent value="teachers">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowAddTeacherDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Teacher
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeachers.map((teacher) => (
                <div key={teacher.id} className="card-elevated p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-card-foreground truncate">{teacher.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{teacher.email}</p>
                      </div>
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
                        <DropdownMenuItem onClick={() => handleOpenEditTeacher(teacher)}>
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteTeacher(teacher.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Password:</span> {teacher.password_hash || 'Not set'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Subjects:</span> {teacher.subjects.length > 0 ? teacher.subjects.join(', ') : 'None'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Classes:</span> {teacher.classes.length > 0 ? teacher.classes.join(', ') : 'None'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Secretaries Tab */}
          <TabsContent value="secretaries">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowAddSecretaryDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Secretary
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSecretaries.map((secretary) => (
                <div key={secretary.id} className="card-elevated p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                        <UserCog className="w-5 h-5 text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-card-foreground truncate">{secretary.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{secretary.username}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditSecretary(secretary)}>
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteSecretary(secretary.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Password:</span> {secretary.password_hash || 'Not set'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Parents Tab */}
          <TabsContent value="parents">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowAddParentDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Parent
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredParents.map((parent) => (
                <div key={parent.id} className="card-elevated p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-card-foreground truncate">{parent.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{parent.email}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteParent(parent.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowAddStudentDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map((student) => (
                <div key={student.id} className="card-elevated p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-card-foreground truncate">{student.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.class} • {student.roll_number}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteStudent(student.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Empty States */}
        {activeTab === 'teachers' && filteredTeachers.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <UserCog className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-card-foreground mb-2">No teachers</h3>
            <p className="text-muted-foreground">Go to Teachers page to add teachers</p>
          </div>
        )}
      </div>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Fill in the new student's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student_name">Full Name</Label>
              <Input
                id="student_name"
                value={newStudent.full_name}
                onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student_class">Class</Label>
              <Input
                id="student_class"
                value={newStudent.class}
                onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                placeholder="e.g. 10-A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll_number">Roll Number</Label>
              <Input
                id="roll_number"
                value={newStudent.roll_number}
                onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value })}
                placeholder="e.g. 2024001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Parent</Label>
              <Select
                value={newStudent.parent_id}
                onValueChange={(value) => setNewStudent({ ...newStudent, parent_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {parents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStudentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Parent Dialog */}
      <Dialog open={showAddParentDialog} onOpenChange={setShowAddParentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Parent</DialogTitle>
            <DialogDescription>Fill in the new parent's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="parent_name">Full Name</Label>
              <Input
                id="parent_name"
                value={newParent.full_name}
                onChange={(e) => setNewParent({ ...newParent, full_name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_email">Email</Label>
              <Input
                id="parent_email"
                type="email"
                value={newParent.email}
                onChange={(e) => setNewParent({ ...newParent, email: e.target.value })}
                placeholder="example@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_phone">Phone</Label>
              <Input
                id="parent_phone"
                value={newParent.phone}
                onChange={(e) => setNewParent({ ...newParent, phone: e.target.value })}
                placeholder="+255 XXX XXX XXX"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddParentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddParent} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Teacher Dialog */}
      <Dialog open={showViewTeacherDialog} onOpenChange={setShowViewTeacherDialog}>
        <DialogContent>
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
                  <Label className="text-muted-foreground">Password</Label>
                  <p className="font-medium font-mono bg-muted px-2 py-1 rounded">
                    ••••••••
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Subjects</Label>
                  <p className="font-medium">
                    {selectedTeacher.subjects.length > 0 ? selectedTeacher.subjects.join(', ') : 'None assigned'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Classes</Label>
                  <p className="font-medium">
                    {selectedTeacher.classes.length > 0 ? selectedTeacher.classes.join(', ') : 'None assigned'}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewTeacherDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Dialog */}
      <Dialog open={showEditTeacherDialog} onOpenChange={setShowEditTeacherDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>Update teacher information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_teacher_name">Full Name</Label>
              <Input
                id="edit_teacher_name"
                value={editTeacher.full_name}
                onChange={(e) => setEditTeacher({ ...editTeacher, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_teacher_email">Email</Label>
              <Input
                id="edit_teacher_email"
                type="email"
                value={editTeacher.email}
                onChange={(e) => setEditTeacher({ ...editTeacher, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_teacher_password">Password (leave empty to keep current)</Label>
              <Input
                id="edit_teacher_password"
                type="text"
                value={editTeacher.password}
                onChange={(e) => setEditTeacher({ ...editTeacher, password: e.target.value })}
                placeholder="New password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_teacher_subjects">Subjects (comma separated)</Label>
              <Input
                id="edit_teacher_subjects"
                value={editTeacher.subjects}
                onChange={(e) => setEditTeacher({ ...editTeacher, subjects: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_teacher_classes">Classes (comma separated)</Label>
              <Input
                id="edit_teacher_classes"
                value={editTeacher.classes}
                onChange={(e) => setEditTeacher({ ...editTeacher, classes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTeacherDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTeacher} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Teacher Dialog */}
      <Dialog open={showAddTeacherDialog} onOpenChange={setShowAddTeacherDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Teacher</DialogTitle>
            <DialogDescription>Fill in the new teacher's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_teacher_name">Full Name</Label>
              <Input
                id="new_teacher_name"
                value={newTeacher.full_name}
                onChange={(e) => setNewTeacher({ ...newTeacher, full_name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_teacher_email">Email</Label>
              <Input
                id="new_teacher_email"
                type="email"
                value={newTeacher.email}
                onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                placeholder="example@school.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_teacher_password">Password</Label>
              <Input
                id="new_teacher_password"
                type="text"
                value={newTeacher.password}
                onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                placeholder="Login password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_teacher_subjects">Subjects (comma separated)</Label>
              <Input
                id="new_teacher_subjects"
                value={newTeacher.subjects}
                onChange={(e) => setNewTeacher({ ...newTeacher, subjects: e.target.value })}
                placeholder="e.g. Mathematics, English"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_teacher_classes">Classes (comma separated)</Label>
              <Input
                id="new_teacher_classes"
                value={newTeacher.classes}
                onChange={(e) => setNewTeacher({ ...newTeacher, classes: e.target.value })}
                placeholder="e.g. S1, S2, S3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTeacherDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTeacher} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Secretary Dialog */}
      <Dialog open={showAddSecretaryDialog} onOpenChange={setShowAddSecretaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Secretary</DialogTitle>
            <DialogDescription>Fill in the new secretary's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_secretary_username">Username</Label>
              <Input
                id="new_secretary_username"
                value={newSecretary.username}
                onChange={(e) => setNewSecretary({ ...newSecretary, username: e.target.value })}
                placeholder="e.g. secretary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_secretary_name">Full Name</Label>
              <Input
                id="new_secretary_name"
                value={newSecretary.full_name}
                onChange={(e) => setNewSecretary({ ...newSecretary, full_name: e.target.value })}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_secretary_password">Password</Label>
              <Input
                id="new_secretary_password"
                type="text"
                value={newSecretary.password}
                onChange={(e) => setNewSecretary({ ...newSecretary, password: e.target.value })}
                placeholder="Login password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSecretaryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSecretary} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Secretary Dialog */}
      <Dialog open={showEditSecretaryDialog} onOpenChange={setShowEditSecretaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Secretary</DialogTitle>
            <DialogDescription>Update secretary information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_secretary_username">Username</Label>
              <Input
                id="edit_secretary_username"
                value={editSecretary.username}
                onChange={(e) => setEditSecretary({ ...editSecretary, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_secretary_name">Full Name</Label>
              <Input
                id="edit_secretary_name"
                value={editSecretary.full_name}
                onChange={(e) => setEditSecretary({ ...editSecretary, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_secretary_password">Password (leave empty to keep current)</Label>
              <Input
                id="edit_secretary_password"
                type="text"
                value={editSecretary.password}
                onChange={(e) => setEditSecretary({ ...editSecretary, password: e.target.value })}
                placeholder="New password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSecretaryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSecretary} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
