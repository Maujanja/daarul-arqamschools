import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, MoreHorizontal, UserCog, Loader2, Shield, GraduationCap, Users } from 'lucide-react';
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

interface Teacher {
  id: string;
  full_name: string;
  email: string;
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

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teachers');
  
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [teachersRes, parentsRes, studentsRes] = await Promise.all([
        supabase.from('teachers').select('*').order('full_name'),
        supabase.from('parents').select('*').order('full_name'),
        supabase.from('students').select('*').order('full_name'),
      ]);

      if (teachersRes.error) throw teachersRes.error;
      if (parentsRes.error) throw parentsRes.error;
      if (studentsRes.error) throw studentsRes.error;

      setTeachers(teachersRes.data || []);
      setParents(parentsRes.data || []);
      setStudents(studentsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Imeshindwa kupata data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.full_name || !newStudent.class || !newStudent.roll_number) {
      toast.error('Tafadhali jaza taarifa zote zinazohitajika');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('students')
        .insert({
          full_name: newStudent.full_name,
          class: newStudent.class,
          roll_number: newStudent.roll_number,
          parent_id: newStudent.parent_id || null,
        });

      if (error) throw error;

      toast.success('Mwanafunzi ameongezwa kikamilifu');
      setShowAddStudentDialog(false);
      setNewStudent({ full_name: '', class: '', roll_number: '', parent_id: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error('Imeshindwa kuongeza mwanafunzi');
    } finally {
      setSaving(false);
    }
  };

  const handleAddParent = async () => {
    if (!newParent.full_name || !newParent.email) {
      toast.error('Tafadhali jaza taarifa zote zinazohitajika');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('parents')
        .insert({
          full_name: newParent.full_name,
          email: newParent.email,
          phone: newParent.phone || null,
        });

      if (error) throw error;

      toast.success('Mzazi ameongezwa kikamilifu');
      setShowAddParentDialog(false);
      setNewParent({ full_name: '', email: '', phone: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding parent:', error);
      toast.error('Imeshindwa kuongeza mzazi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      toast.success('Mwanafunzi amefutwa');
      fetchData();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Imeshindwa kufuta mwanafunzi');
    }
  };

  const handleDeleteParent = async (id: string) => {
    try {
      const { error } = await supabase.from('parents').delete().eq('id', id);
      if (error) throw error;
      toast.success('Mzazi amefutwa');
      fetchData();
    } catch (error) {
      console.error('Error deleting parent:', error);
      toast.error('Imeshindwa kufuta mzazi');
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
          <h1 className="text-3xl font-display font-bold text-foreground">Usimamizi wa Watumiaji</h1>
          <p className="text-muted-foreground mt-1">Simamia walimu, wazazi, na wanafunzi</p>
        </div>

        {/* Search */}
        <div className="card-elevated p-6 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Tafuta watumiaji..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="teachers" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Walimu ({filteredTeachers.length})
            </TabsTrigger>
            <TabsTrigger value="parents" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Wazazi ({filteredParents.length})
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Wanafunzi ({filteredStudents.length})
            </TabsTrigger>
          </TabsList>

          {/* Teachers Tab */}
          <TabsContent value="teachers">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeachers.map((teacher) => (
                <div key={teacher.id} className="card-elevated p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-card-foreground truncate">{teacher.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{teacher.email}</p>
                    </div>
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
                Ongeza Mzazi
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
                          Futa
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
                Ongeza Mwanafunzi
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
                          Futa
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
            <h3 className="font-semibold text-lg text-card-foreground mb-2">Hakuna walimu</h3>
            <p className="text-muted-foreground">Nenda kwenye ukurasa wa Walimu kuongeza</p>
          </div>
        )}
      </div>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ongeza Mwanafunzi</DialogTitle>
            <DialogDescription>Jaza taarifa za mwanafunzi mpya</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student_name">Jina Kamili</Label>
              <Input
                id="student_name"
                value={newStudent.full_name}
                onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                placeholder="Mfano: John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student_class">Darasa</Label>
              <Input
                id="student_class"
                value={newStudent.class}
                onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                placeholder="Mfano: 10-A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll_number">Namba ya Usajili</Label>
              <Input
                id="roll_number"
                value={newStudent.roll_number}
                onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value })}
                placeholder="Mfano: 2024001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Mzazi</Label>
              <Select
                value={newStudent.parent_id}
                onValueChange={(value) => setNewStudent({ ...newStudent, parent_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chagua mzazi..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Hakuna</SelectItem>
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
              Ghairi
            </Button>
            <Button onClick={handleAddStudent} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Hifadhi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Parent Dialog */}
      <Dialog open={showAddParentDialog} onOpenChange={setShowAddParentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ongeza Mzazi</DialogTitle>
            <DialogDescription>Jaza taarifa za mzazi mpya</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="parent_name">Jina Kamili</Label>
              <Input
                id="parent_name"
                value={newParent.full_name}
                onChange={(e) => setNewParent({ ...newParent, full_name: e.target.value })}
                placeholder="Mfano: John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_email">Barua Pepe</Label>
              <Input
                id="parent_email"
                type="email"
                value={newParent.email}
                onChange={(e) => setNewParent({ ...newParent, email: e.target.value })}
                placeholder="mfano@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_phone">Simu</Label>
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
              Ghairi
            </Button>
            <Button onClick={handleAddParent} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Hifadhi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
