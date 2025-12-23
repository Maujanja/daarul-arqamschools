import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Megaphone, Plus, Calendar, User, Trash2, Edit, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setSubmitting(true);
    
    try {
      if (editingAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title: title.trim(),
            content: content.trim()
          })
          .eq('id', editingAnnouncement.id);
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Announcement updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({
            title: title.trim(),
            content: content.trim(),
            created_by: user?.name || 'Admin'
          });
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Announcement created successfully"
        });
      }
      
      setTitle('');
      setContent('');
      setEditingAnnouncement(null);
      setDialogOpen(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error saving announcement:', error);
      toast({
        title: "Error",
        description: "Failed to save announcement",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Announcement deleted successfully"
      });
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast({
        title: "Error",
        description: "Failed to delete announcement",
        variant: "destructive"
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingAnnouncement(null);
    setTitle('');
    setContent('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">School Announcements</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? "Create and manage school announcements" : "View important school news and updates"}
            </p>
          </div>
          
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              if (!open) handleDialogClose();
              else setDialogOpen(true);
            }}>
              <DialogTrigger asChild>
                <Button className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter announcement title"
                      className="input-enhanced"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Enter announcement content..."
                      className="min-h-[150px] input-enhanced"
                      required
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                      Cancel
                    </Button>
                    <Button type="submit" className="btn-gradient" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        editingAnnouncement ? 'Update' : 'Create'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="card-elevated p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground mt-4">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">No Announcements</h3>
            <p className="text-muted-foreground">
              {isAdmin ? "Create your first announcement to share with parents" : "No announcements have been posted yet"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {announcements.map((announcement, index) => (
              <div 
                key={announcement.id} 
                className="card-elevated p-6 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-semibold text-lg text-card-foreground">
                        {announcement.title}
                      </h3>
                    </div>
                    <p className="text-card-foreground whitespace-pre-wrap">{announcement.content}</p>
                    <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {announcement.created_by}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(announcement.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(announcement)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(announcement.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
