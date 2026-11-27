import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Plus, Calendar, User, Trash2, Edit, Loader2, Clock, Paperclip, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { supabase } from '@/integrations/supabase/client';
import { AnnouncementMedia } from '@/components/AnnouncementMedia';
import { classes } from '@/data/mockData';

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4', 'webm', 'mov', 'm4v']);
const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,audio/*,video/*';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  academic_year: string;
  visibility_type: string;
  expires_at: string | null;
  media_url: string | null;
  media_type: string | null;
  media_name: string | null;
  link_url: string | null;
  target_class: string | null;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { academicYears, currentYear, loading: yearsLoading } = useAcademicYears();
  const { fetchTable } = useSecureQuery();
  const { insert, update, remove } = useSecureData();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibilityType, setVisibilityType] = useState('yearly');
  const [targetClass, setTargetClass] = useState('all');
  const [linkUrl, setLinkUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<string | null>(null);
  const [existingMediaName, setExistingMediaName] = useState<string | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  const fetchAnnouncements = useCallback(async () => {
    if (!selectedYear) return;
    try {
      setLoading(true);
      const data = await fetchTable<Announcement>('announcements', {
        academic_year: selectedYear,
      }, {
        orderBy: { column: 'created_at', ascending: false },
      });
      
      // Filter out expired announcements client-side
      const now = new Date().toISOString();
      const filtered = data.filter(a => !a.expires_at || a.expires_at > now);
      setAnnouncements(filtered);
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
  }, [selectedYear, fetchTable, toast]);

  useEffect(() => {
    if (selectedYear) {
      fetchAnnouncements();
    }
  }, [selectedYear, fetchAnnouncements]);

  useRealtimeSubscription({
    table: 'announcements',
    onUpdate: fetchAnnouncements,
    enabled: !!selectedYear,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setSubmitting(true);
    
    try {
      // Handle file upload first if a new file is chosen
      let mediaUrl: string | null | undefined = undefined;
      let mediaType: string | null | undefined = undefined;
      let mediaName: string | null | undefined = undefined;
      if (mediaFile) {
        const ext = (mediaFile.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
          throw new Error('Choose a PDF, Word document, image, audio, or video file.');
        }
        if (mediaFile.size > MAX_ATTACHMENT_BYTES) {
          throw new Error('Attachment must be 50 MB or smaller.');
        }
        const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('announcement-media')
          .upload(path, mediaFile, { contentType: mediaFile.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('announcement-media').getPublicUrl(path);
        mediaUrl = pub.publicUrl;
        mediaType = mediaFile.type || `application/${ext}`;
        mediaName = mediaFile.name;
      } else if (removeMedia) {
        mediaUrl = null;
        mediaType = null;
        mediaName = null;
      }

      if (editingAnnouncement) {
        const updatePayload: Record<string, unknown> = {
          title: title.trim(),
          content: content.trim(),
          visibility_type: visibilityType,
          target_class: targetClass === 'all' ? null : targetClass,
          link_url: linkUrl.trim() || null,
        };
        if (mediaUrl !== undefined) {
          updatePayload.media_url = mediaUrl;
          updatePayload.media_type = mediaType;
          updatePayload.media_name = mediaName;
        }
        const result = await update('announcements', updatePayload, { id: editingAnnouncement.id });
        
        if (!result.success) throw new Error(result.error);
        
        toast({ title: "Success", description: "Announcement updated successfully" });
      } else {
        const result = await insert('announcements', {
          title: title.trim(),
          content: content.trim(),
          created_by: user?.name || 'Admin',
          academic_year: selectedYear,
          visibility_type: visibilityType,
          target_class: targetClass === 'all' ? null : targetClass,
          link_url: linkUrl.trim() || null,
          media_url: mediaUrl ?? null,
          media_type: mediaType ?? null,
          media_name: mediaName ?? null,
        });
        
        if (!result.success) throw new Error(result.error);
        
        toast({ title: "Success", description: "Announcement created successfully" });

        // General notices may notify every device; class notices stay inside the targeted dashboards.
        if (targetClass === 'all') {
          try {
            await supabase.functions.invoke('push-send', {
              body: {
                payload: {
                  title: `📢 ${title.trim()}`,
                  body: content.trim().slice(0, 160),
                  url: '/announcements',
                  tag: 'announcement',
                  requireInteraction: false,
                },
              },
            });
          } catch (pushErr) {
            console.error('Push notification failed:', pushErr);
          }
        }
      }
      
      handleDialogClose();
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error saving announcement:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save announcement",
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
    setVisibilityType(announcement.visibility_type || 'yearly');
    setTargetClass(announcement.target_class || 'all');
    setLinkUrl(announcement.link_url || '');
    setExistingMediaUrl(announcement.media_url || null);
    setExistingMediaType(announcement.media_type || null);
    setExistingMediaName(announcement.media_name || null);
    setMediaFile(null);
    setRemoveMedia(false);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
      const result = await remove('announcements', { id });
      if (!result.success) throw new Error(result.error);
      
      toast({ title: "Success", description: "Announcement deleted successfully" });
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete announcement",
        variant: "destructive"
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingAnnouncement(null);
    setTitle('');
    setContent('');
    setVisibilityType('yearly');
    setTargetClass('all');
    setLinkUrl('');
    setMediaFile(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setExistingMediaName(null);
    setRemoveMedia(false);
  };

  const getVisibilityLabel = (type: string) => {
    switch (type) {
      case 'weekly': return 'Weekly (7 days)';
      case 'monthly': return 'Monthly (30 days)';
      case 'yearly': return 'Yearly (365 days)';
      default: return 'Yearly';
    }
  };

  if (yearsLoading) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">School Announcements</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? "Create and manage school announcements" : "View important school news and updates"}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
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
                      <Label htmlFor="visibility">Visibility Duration</Label>
                      <Select value={visibilityType} onValueChange={setVisibilityType}>
                        <SelectTrigger className="input-enhanced">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                          <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                          <SelectItem value="yearly">Yearly (365 days)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="audience">Send To Parents Of</Label>
                      <Select value={targetClass} onValueChange={setTargetClass}>
                        <SelectTrigger id="audience" className="input-enhanced">
                          <SelectValue placeholder="Choose a class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Classes</SelectItem>
                          {classes.map((className) => (
                            <SelectItem key={className} value={className}>{className}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <div className="space-y-2">
                      <Label htmlFor="link">Clickable Link (optional)</Label>
                      <Input
                        id="link"
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="input-enhanced"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="media">Attachment (PDF, Word, PNG, audio, or video — optional, max 50 MB)</Label>
                      <Input
                        id="media"
                        type="file"
                        accept={ATTACHMENT_ACCEPT}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setMediaFile(f);
                          if (f) setRemoveMedia(false);
                        }}
                        className="input-enhanced"
                      />
                      {(existingMediaUrl && !mediaFile && !removeMedia) && (
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                          <span className="flex items-center gap-2 truncate">
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate">{existingMediaName || 'Current attachment kept'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setRemoveMedia(true)}
                            className="text-destructive inline-flex items-center gap-1 hover:underline"
                          >
                            <X className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      )}
                      {removeMedia && (
                        <p className="text-xs text-destructive">Attachment will be removed on save.</p>
                      )}
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
                    <p className="text-card-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere text-sm sm:text-base leading-relaxed">
                      {announcement.content}
                    </p>
                    <AnnouncementMedia
                      mediaUrl={announcement.media_url}
                      mediaType={announcement.media_type}
                      mediaName={announcement.media_name}
                      linkUrl={announcement.link_url}
                    />
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4 text-xs sm:text-sm text-muted-foreground">
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
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {getVisibilityLabel(announcement.visibility_type)}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {announcement.target_class || 'All Classes'}
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
