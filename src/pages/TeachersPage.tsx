import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, MoreHorizontal, Users, BookOpen, Loader2, Mail } from 'lucide-react';
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
import { toast } from 'sonner';

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  subjects: string[];
  classes: string[];
  created_at: string;
}

export default function TeachersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [newTeacher, setNewTeacher] = useState({
    full_name: '',
    email: '',
    password: '',
    subjects: '',
    classes: '',
  });
  const [editTeacher, setEditTeacher] = useState({
    full_name: '',
    email: '',
    password: '',
    subjects: '',
    classes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('full_name');

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast.error('Failed to fetch teachers');
    } finally {
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
      
      const subjectsArray = newTeacher.subjects.split(',').map(s => s.trim()).filter(Boolean);
      const classesArray = newTeacher.classes.split(',').map(c => c.trim()).filter(Boolean);

      const { error } = await supabase
        .from('teachers')
        .insert({
          full_name: newTeacher.full_name,
          email: newTeacher.email,
          password_hash: newTeacher.password, // In production, hash this properly
          subjects: subjectsArray,
          classes: classesArray,
        });

      if (error) throw error;

      toast.success('Teacher added successfully');
      setShowAddDialog(false);
      setNewTeacher({ full_name: '', email: '', password: '', subjects: '', classes: '' });
      fetchTeachers();
    } catch (error) {
      console.error('Error adding teacher:', error);
      toast.error('Failed to add teacher');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Teacher deleted');
      fetchTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      toast.error('Failed to delete teacher');
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
      subjects: teacher.subjects.join(', '),
      classes: teacher.classes.join(', '),
    });
    setShowEditDialog(true);
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

      const updateData: any = {
        full_name: editTeacher.full_name,
        email: editTeacher.email,
        subjects: subjectsArray,
        classes: classesArray,
      };

      // Only update password if provided
      if (editTeacher.password) {
        updateData.password_hash = editTeacher.password;
      }

      const { error } = await supabase
        .from('teachers')
        .update(updateData)
        .eq('id', selectedTeacher.id);

      if (error) throw error;

      toast.success('Teacher updated successfully');
      setShowEditDialog(false);
      setSelectedTeacher(null);
      fetchTeachers();
    } catch (error) {
      console.error('Error updating teacher:', error);
      toast.error('Failed to update teacher');
    } finally {
      setSaving(false);
    }
  };

  const filteredTeachers = teachers.filter(teacher =>
    teacher.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchQuery.toLowerCase())
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Teachers</h1>
            <p className="text-muted-foreground mt-1">Manage teacher information and their subjects</p>
          </div>
          <Button className="btn-gradient" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Teacher
          </Button>
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
          {filteredTeachers.map((teacher, index) => (
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
                    <DropdownMenuItem onClick={() => handleOpenEditDialog(teacher)}>
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

              <h3 className="font-display font-semibold text-lg text-card-foreground mb-1">
                {teacher.full_name}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {teacher.email}
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Subjects: </span>
                    <span className="font-medium text-card-foreground">
                      {teacher.subjects.length > 0 ? teacher.subjects.join(', ') : 'None'}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Classes: </span>
                    <span className="font-medium text-card-foreground">
                      {teacher.classes.length > 0 ? teacher.classes.join(', ') : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
            <div className="space-y-2">
              <Label htmlFor="subjects">Subjects (comma separated)</Label>
              <Input
                id="subjects"
                value={newTeacher.subjects}
                onChange={(e) => setNewTeacher({ ...newTeacher, subjects: e.target.value })}
                placeholder="e.g. Mathematics, English, Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classes">Classes (comma separated)</Label>
              <Input
                id="classes"
                value={newTeacher.classes}
                onChange={(e) => setNewTeacher({ ...newTeacher, classes: e.target.value })}
                placeholder="e.g. 10-A, 10-B, 9-A"
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
            <div className="space-y-2">
              <Label htmlFor="edit-subjects">Subjects (comma separated)</Label>
              <Input
                id="edit-subjects"
                value={editTeacher.subjects}
                onChange={(e) => setEditTeacher({ ...editTeacher, subjects: e.target.value })}
                placeholder="e.g. Mathematics, English, Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-classes">Classes (comma separated)</Label>
              <Input
                id="edit-classes"
                value={editTeacher.classes}
                onChange={(e) => setEditTeacher({ ...editTeacher, classes: e.target.value })}
                placeholder="e.g. S1, S2, S3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTeacher} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
