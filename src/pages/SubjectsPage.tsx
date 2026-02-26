import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { Search, Plus, MoreHorizontal, BookOpen, Loader2 } from 'lucide-react';
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

interface Subject {
  id: string;
  name: string;
  code: string;
  max_marks: number;
  created_at: string;
}

export default function SubjectsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [newSubject, setNewSubject] = useState({
    name: '',
    code: '',
    max_marks: '100',
  });
  const [editSubject, setEditSubject] = useState({
    name: '',
    code: '',
    max_marks: '100',
  });
  const [saving, setSaving] = useState(false);
  const { fetchTable } = useSecureQuery();
  const { insert, update, remove } = useSecureData();

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const data = await fetchTable<Subject>('subjects');
      setSubjects(data || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to fetch subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubject.name || !newSubject.code) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const result = await insert('subjects', {
        name: newSubject.name,
        code: newSubject.code.toUpperCase(),
        max_marks: parseInt(newSubject.max_marks) || 100,
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Subject added successfully');
      setShowAddDialog(false);
      setNewSubject({ name: '', code: '', max_marks: '100' });
      fetchSubjects();
    } catch (error: any) {
      console.error('Error adding subject:', error);
      toast.error(error.message || 'Failed to add subject');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditDialog = (subject: Subject) => {
    setSelectedSubject(subject);
    setEditSubject({
      name: subject.name,
      code: subject.code,
      max_marks: String(subject.max_marks),
    });
    setShowEditDialog(true);
  };

  const handleEditSubject = async () => {
    if (!selectedSubject || !editSubject.name || !editSubject.code) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const result = await update('subjects', {
        name: editSubject.name,
        code: editSubject.code.toUpperCase(),
        max_marks: parseInt(editSubject.max_marks) || 100,
      }, { id: selectedSubject.id });

      if (!result.success) throw new Error(result.error);

      toast.success('Subject updated successfully');
      setShowEditDialog(false);
      setSelectedSubject(null);
      fetchSubjects();
    } catch (error: any) {
      console.error('Error updating subject:', error);
      toast.error(error.message || 'Failed to update subject');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      const result = await remove('subjects', { id });
      if (!result.success) throw new Error(result.error);
      toast.success('Subject deleted');
      fetchSubjects();
    } catch (error: any) {
      console.error('Error deleting subject:', error);
      toast.error(error.message || 'Failed to delete subject');
    }
  };

  const filteredSubjects = subjects.filter(subject =>
    subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subject.code.toLowerCase().includes(searchQuery.toLowerCase())
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
            <h1 className="text-3xl font-display font-bold text-foreground">Subjects</h1>
            <p className="text-muted-foreground mt-1">Manage all school subjects</p>
          </div>
          <Button className="btn-gradient" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Subject
          </Button>
        </div>

        {/* Filters */}
        <div className="card-elevated p-6 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
        </div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSubjects.map((subject, index) => (
            <div 
              key={subject.id} 
              className="card-elevated p-6 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
                  {subject.code.substring(0, 2)}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEditDialog(subject)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => handleDeleteSubject(subject.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="font-display font-semibold text-lg text-card-foreground mb-1">
                {subject.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">Code: {subject.code}</p>
              
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Maximum Marks</p>
                <p className="font-bold text-primary text-lg">{subject.max_marks}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredSubjects.length === 0 && (
          <div className="card-elevated p-12 text-center animate-fade-in">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">
              No subjects found
            </h3>
            <p className="text-muted-foreground">Try adjusting your search criteria</p>
          </div>
        )}
      </div>

      {/* Add Subject Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Subject</DialogTitle>
            <DialogDescription>
              Fill in the new subject's information below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Subject Name</Label>
              <Input
                id="name"
                value={newSubject.name}
                onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Subject Code</Label>
              <Input
                id="code"
                value={newSubject.code}
                onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })}
                placeholder="e.g. MATH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_marks">Maximum Marks</Label>
              <Input
                id="max_marks"
                type="number"
                value={newSubject.max_marks}
                onChange={(e) => setNewSubject({ ...newSubject, max_marks: e.target.value })}
                placeholder="100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSubject} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>
              Update the subject's information below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Subject Name</Label>
              <Input
                id="edit-name"
                value={editSubject.name}
                onChange={(e) => setEditSubject({ ...editSubject, name: e.target.value })}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Subject Code</Label>
              <Input
                id="edit-code"
                value={editSubject.code}
                onChange={(e) => setEditSubject({ ...editSubject, code: e.target.value })}
                placeholder="e.g. MATH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-max_marks">Maximum Marks</Label>
              <Input
                id="edit-max_marks"
                type="number"
                value={editSubject.max_marks}
                onChange={(e) => setEditSubject({ ...editSubject, max_marks: e.target.value })}
                placeholder="100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubject} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
