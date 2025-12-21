import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Clock, CheckCircle, User, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FeedbackItem {
  id: string;
  parent_id: string;
  student_id: string;
  message: string;
  status: string;
  created_at: string;
  parentName?: string;
  studentName?: string;
  studentClass?: string;
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  
  const isParent = user?.role === 'parent';
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    if (isParent) {
      fetchStudentData();
    }
    fetchFeedback();
  }, [user]);

  const fetchStudentData = async () => {
    if (!user) return;
    
    // Find student linked to this parent
    const { data: studentByParent } = await supabase
      .from('students')
      .select('id, full_name, parent_id')
      .eq('parent_id', user.id)
      .maybeSingle();
    
    if (studentByParent) {
      setStudentId(studentByParent.id);
      setStudentName(studentByParent.full_name);
      setParentId(studentByParent.parent_id);
      return;
    }
    
    // Try finding by student id
    const { data: studentById } = await supabase
      .from('students')
      .select('id, full_name, parent_id')
      .eq('id', user.id)
      .maybeSingle();
    
    if (studentById) {
      setStudentId(studentById.id);
      setStudentName(studentById.full_name);
      setParentId(studentById.parent_id || user.id);
    }
  };

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      
      const { data: feedbackData, error: feedbackError } = await query;
      
      if (feedbackError) throw feedbackError;

      const { data: parentsData } = await supabase.from('parents').select('id, full_name');
      const { data: studentsData } = await supabase.from('students').select('id, full_name, class');

      const enrichedFeedback = (feedbackData || []).map(fb => {
        const parent = parentsData?.find(p => p.id === fb.parent_id);
        const student = studentsData?.find(s => s.id === fb.student_id);
        return {
          ...fb,
          parentName: parent?.full_name || 'Mzazi',
          studentName: student?.full_name || 'Mwanafunzi',
          studentClass: student?.class || ''
        };
      });

      // Filter for teachers - show only their class students' feedback
      let filteredFeedback = enrichedFeedback;
      
      if (isTeacher && user) {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('classes')
          .eq('id', user.id)
          .maybeSingle();
        
        if (teacherData?.classes) {
          filteredFeedback = enrichedFeedback.filter(fb => 
            teacherData.classes.includes(fb.studentClass)
          );
        }
      }
      
      // Filter for parents - show only their own feedback
      if (isParent && studentId) {
        filteredFeedback = enrichedFeedback.filter(fb => fb.student_id === studentId);
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
        title: "Kosa",
        description: "Hakuna mwanafunzi aliyeunganishwa na akaunti yako",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    
    const { error } = await supabase.from('feedback').insert({
      parent_id: parentId || user?.id,
      student_id: studentId,
      message: newMessage.trim(),
      status: 'pending'
    });

    if (error) {
      toast({
        title: "Kosa",
        description: "Imeshindikana kutuma maoni",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Imefanikiwa",
        description: "Maoni yako yametumwa kwa Admin na Mwalimu",
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
        title: "Kosa",
        description: "Imeshindikana kubadilisha hali",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Imefanikiwa",
        description: "Maoni yamekaguliwa",
      });
      fetchFeedback();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Maoni</h1>
          <p className="text-muted-foreground mt-1">
            {isParent ? "Tuma maoni kwa walimu na uone majibu" : "Angalia na ujibu maoni ya wazazi"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {isParent && (
            <div className="lg:col-span-1">
              <div className="card-elevated p-6 animate-fade-in">
                <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">
                  <MessageSquare className="w-5 h-5 inline mr-2 text-primary" />
                  Tuma Maoni
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Mwanafunzi</label>
                    <div className="mt-1 p-3 rounded-lg bg-muted/50 text-card-foreground">
                      {studentName || 'Hakuna mwanafunzi'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Ujumbe Wako</label>
                    <Textarea
                      placeholder="Andika maoni yako hapa..."
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
                        Inatuma...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Tuma Maoni
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
                  {isParent ? "Historia ya Maoni Yako" : "Maoni ya Wazazi"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{feedbackList.length} ujumbe</p>
              </div>

              {loading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground mt-4">Inapakia...</p>
                </div>
              ) : feedbackList.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">Hakuna maoni bado</h3>
                  <p className="text-muted-foreground">
                    {isParent ? "Tuma maoni yako ya kwanza kwa walimu" : "Hakuna maoni yaliyopokelewa kutoka kwa wazazi"}
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
                                Kuhusu: {feedback.studentName} ({feedback.studentClass})
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {feedback.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                                  <Clock className="w-3 h-3" />Inasubiri
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                                  <CheckCircle className="w-3 h-3" />Imekaguliwa
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="mt-3 text-card-foreground">{feedback.message}</p>
                          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(feedback.created_at).toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                          {(isAdmin || isTeacher) && feedback.status === 'pending' && (
                            <div className="mt-4">
                              <Button 
                                size="sm"
                                onClick={() => handleMarkReviewed(feedback.id)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Weka kama Imekaguliwa
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
