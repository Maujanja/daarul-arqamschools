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
  const [newTeacher, setNewTeacher] = useState({
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
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    <DropdownMenuItem>Edit Details</DropdownMenuItem>
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
    </DashboardLayout>
  );
}
