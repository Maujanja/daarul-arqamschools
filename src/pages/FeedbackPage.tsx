import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Send, Clock, CheckCircle, User, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

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

export default function FeedbackPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [recipientType, setRecipientType] = useState('teacher');
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  
  const isParent = user?.role === 'parent';
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isSecretary = user?.role === 'secretary';

  const refetchFeedback = useCallback(() => { fetchFeedback(); }, []);

  useEffect(() => {
    if (isParent) {
      fetchStudentData();
    }
    fetchFeedback();
  }, [user]);

  // Realtime: auto-refresh feedback on changes
  useRealtimeSubscription({
    table: 'feedback',
    onUpdate: refetchFeedback,
    enabled: !!user,
  });

  const fetchStudentData = async () => {
    if (!user) return;
    
    // The user.id from login is either:
    // 1. parent.id (if student has parent_id set)
    // 2. student.id (if student has no parent_id)
    
    // First try: user.id is a parent.id - find student linked to this parent
    const { data: studentByParentId } = await supabase
      .from('students')
      .select('id, full_name, parent_id')
      .eq('parent_id', user.id)
      .maybeSingle();
    
    if (studentByParentId) {
      setStudentId(studentByParentId.id);
      setStudentName(studentByParentId.full_name);
      setParentId(user.id);
      return;
    }
    
    // Second try: user.id is the student.id itself (no parent linked during login)
    const { data: studentDirect } = await supabase
      .from('students')
      .select('id, full_name, parent_id')
      .eq('id', user.id)
      .maybeSingle();
    
    if (studentDirect) {
      setStudentId(studentDirect.id);
      setStudentName(studentDirect.full_name);
      // Use student.id as parent_id for feedback since no parent record exists
      setParentId(studentDirect.parent_id || studentDirect.id);
      return;
    }
    
    // Third try: Check parents table by user_id
    const { data: parentData } = await supabase
      .from('parents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (parentData) {
      setParentId(parentData.id);
      
      const { data: studentData } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('parent_id', parentData.id)
        .maybeSingle();
      
      if (studentData) {
        setStudentId(studentData.id);
        setStudentName(studentData.full_name);
      }
    }
  };

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (feedbackError) throw feedbackError;

      const { data: parentsData } = await supabase.from('parents').select('id, full_name');
      const { data: studentsData } = await supabase.from('students').select('id, full_name, class');

      const enrichedFeedback = (feedbackData || []).map(fb => {
        const parent = parentsData?.find(p => p.id === fb.parent_id);
        const student = studentsData?.find(s => s.id === fb.student_id);
        return {
          ...fb,
          recipient_type: fb.recipient_type || 'teacher',
          parentName: parent?.full_name || 'Parent',
          studentName: student?.full_name || 'Student',
          studentClass: student?.class || ''
        };
      });

      // Filter based on role
      let filteredFeedback = enrichedFeedback;
      
      // Teachers see feedback sent to teachers for their classes
      if (isTeacher && user) {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('classes')
          .eq('id', user.id)
          .maybeSingle();
        
        if (teacherData?.classes) {
          filteredFeedback = enrichedFeedback.filter(fb => 
            fb.recipient_type === 'teacher' && teacherData.classes.includes(fb.studentClass)
          );
        }
      }
      
      // Secretary sees feedback sent to secretary
      if (isSecretary) {
        filteredFeedback = enrichedFeedback.filter(fb => fb.recipient_type === 'secretary');
      }
      
      // Parents see only their own feedback
      if (isParent && studentId) {
        filteredFeedback = enrichedFeedback.filter(fb => fb.student_id === studentId);
      }
      
      // Admin sees all feedback
      if (isAdmin) {
        filteredFeedback = enrichedFeedback;
      }

      setFeedbackList(filteredFeedback);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    if (!studentId) {
      toast({
        title: "Error",
        description: "No student linked to your account. Please contact admin.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    
    // Use parentId if available, otherwise generate a temporary one
    const feedbackParentId = parentId || user?.id;
    
    if (!feedbackParentId) {
      toast({
        title: "Error",
        description: "Unable to identify parent account",
        variant: "destructive"
      });
      setSubmitting(false);
      return;
    }
    
    const { error } = await supabase.from('feedback').insert({
      parent_id: feedbackParentId,
      student_id: studentId,
      message: newMessage.trim(),
      status: 'pending',
      recipient_type: recipientType
    });

    if (error) {
      console.error('Feedback insert error:', error);
      toast({
        title: "Error",
        description: "Failed to send feedback. Please try again.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: `Your feedback has been sent to ${recipientType === 'teacher' ? 'the Teacher' : 'the Secretary'}`,
      });
      setNewMessage('');
      fetchFeedback();
    }
    
    setSubmitting(false);
  };

  const handleMarkReviewed = async (feedbackId: string) => {
    const { error } = await supabase
      .from('feedback')
      .update({ status: 'reviewed' })
      .eq('id', feedbackId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Feedback marked as reviewed",
      });
      fetchFeedback();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Feedback</h1>
          <p className="text-muted-foreground mt-1">
            {isParent ? "Send feedback to teachers or secretary and view responses" : "View and respond to parent feedback"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {isParent && (
            <div className="lg:col-span-1">
              <div className="card-elevated p-6 animate-fade-in">
                <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">
                  <MessageSquare className="w-5 h-5 inline mr-2 text-primary" />
                  Send Feedback
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Student</Label>
                    <div className="mt-1 p-3 rounded-lg bg-muted/50 text-card-foreground">
                      {studentName || 'No student linked'}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Send To</Label>
                    <Select value={recipientType} onValueChange={setRecipientType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teacher">Class Teacher</SelectItem>
                        <SelectItem value="secretary">Secretary (Fee Related)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Your Message</Label>
                    <Textarea
                      placeholder="Write your feedback here..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="mt-1 min-h-[150px] input-enhanced"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full btn-gradient"
                    disabled={submitting || !studentId}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Feedback
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          )}

          <div className={isParent ? "lg:col-span-2" : "lg:col-span-3"}>
            <div className="card-elevated animate-fade-in">
              <div className="p-6 border-b border-border">
                <h3 className="font-display font-semibold text-lg text-card-foreground">
                  {isParent ? "Your Feedback History" : "Parent Feedback"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{feedbackList.length} messages</p>
              </div>

              {loading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground mt-4">Loading...</p>
                </div>
              ) : feedbackList.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">No feedback yet</h3>
                  <p className="text-muted-foreground">
                    {isParent ? "Send your first feedback to teachers or secretary" : "No feedback received from parents"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {feedbackList.map((feedback, index) => (
                    <div key={feedback.id} className="p-6 hover:bg-muted/30 transition-colors animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-card-foreground">{feedback.parentName}</p>
                              <p className="text-sm text-muted-foreground">
                                About: {feedback.studentName} ({feedback.studentClass})
                              </p>
                              <p className="text-xs text-primary mt-1">
                                To: {feedback.recipient_type === 'teacher' ? 'Teacher' : 'Secretary'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {feedback.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                                  <Clock className="w-3 h-3" />Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                                  <CheckCircle className="w-3 h-3" />Reviewed
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="mt-3 text-card-foreground">{feedback.message}</p>
                          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(feedback.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                          {(isAdmin || isTeacher || isSecretary) && feedback.status === 'pending' && (
                            <div className="mt-4">
                              <Button 
                                size="sm"
                                onClick={() => handleMarkReviewed(feedback.id)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Mark as Reviewed
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
