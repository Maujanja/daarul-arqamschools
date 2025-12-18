import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { mockFeedback, mockStudents, mockParents } from '@/data/mockData';
import { MessageSquare, Send, Clock, CheckCircle, User, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function FeedbackPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const isParent = user?.role === 'parent';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    toast({
      title: "Feedback Submitted",
      description: "Your feedback has been sent successfully.",
    });
    setNewMessage('');
  };

  const feedbackList = mockFeedback.map(fb => {
    const parent = mockParents.find(p => p.id === fb.parentId);
    const student = mockStudents.find(s => s.id === fb.studentId);
    return { ...fb, parentName: parent?.name, studentName: student?.name };
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Feedback</h1>
          <p className="text-muted-foreground mt-1">
            {isParent ? "Send feedback to teachers and view responses" : "View and respond to parent feedback"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Feedback Form (Parents only) */}
          {isParent && (
            <div className="lg:col-span-1">
              <div className="card-elevated p-6 animate-fade-in">
                <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">
                  <MessageSquare className="w-5 h-5 inline mr-2 text-primary" />
                  Send Feedback
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Student</label>
                    <Input value="Alex Smith - Class 10-A" readOnly className="mt-1 bg-muted/50" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Your Message</label>
                    <Textarea
                      placeholder="Write your feedback or message here..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="mt-1 min-h-[150px] input-enhanced"
                    />
                  </div>
                  <Button type="submit" className="w-full btn-gradient">
                    <Send className="w-4 h-4 mr-2" />
                    Send Feedback
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* Feedback List */}
          <div className={isParent ? "lg:col-span-2" : "lg:col-span-3"}>
            <div className="card-elevated animate-fade-in">
              <div className="p-6 border-b border-border">
                <h3 className="font-display font-semibold text-lg text-card-foreground">
                  {isParent ? "Your Feedback History" : "Parent Feedback"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {feedbackList.length} messages
                </p>
              </div>

              <div className="divide-y divide-border">
                {feedbackList.map((feedback, index) => (
                  <div 
                    key={feedback.id}
                    className="p-6 hover:bg-muted/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-card-foreground">{feedback.parentName}</p>
                            <p className="text-sm text-muted-foreground">Regarding: {feedback.studentName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {feedback.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                                <CheckCircle className="w-3 h-3" />
                                Reviewed
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-card-foreground">{feedback.message}</p>
                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(feedback.date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                        
                        {!isParent && feedback.status === 'pending' && (
                          <div className="mt-4 flex gap-2">
                            <Button variant="outline" size="sm">Reply</Button>
                            <Button size="sm">Mark as Reviewed</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {feedbackList.length === 0 && (
                <div className="p-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">No feedback yet</h3>
                  <p className="text-muted-foreground">
                    {isParent ? "Send your first feedback to teachers" : "No parent feedback received yet"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
