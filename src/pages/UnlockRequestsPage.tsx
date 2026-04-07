import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { Loader2, Unlock, Lock, CheckCircle, XCircle, Bell, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UnlockRequest {
  id: string;
  teacher_id: string;
  teacher_name: string;
  class: string;
  subject_id: string;
  subject_name: string;
  term: string;
  academic_year: string;
  reason: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  student_id: string | null;
  student_name: string | null;
  current_marks: number | null;
}

export default function UnlockRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fetchTable } = useSecureQuery();
  const { update } = useSecureData();
  
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UnlockRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionType, setActionType] = useState<'approved' | 'rejected'>('approved');

  const isAdmin = user?.role === 'admin';
  const isHeadOfSchool = user?.role?.startsWith('head_') || false;
  const canApprove = isAdmin || isHeadOfSchool;
  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    setIsLoading(true);
    
    const data = await fetchTable<UnlockRequest>('marks_unlock_requests');
    
    // For teachers, filter to only their requests
    const filtered = isTeacher 
      ? data.filter(r => r.teacher_id === user.id)
      : data;
    
    // Sort by created_at descending
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRequests(filtered);
    setIsLoading(false);
  };

  const handleAction = (request: UnlockRequest, action: 'approved' | 'rejected') => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNote('');
    setShowNoteDialog(true);
  };

  const confirmAction = async () => {
    if (!selectedRequest) return;
    
    setProcessingId(selectedRequest.id);
    setShowNoteDialog(false);
    
    try {
      const result = await update('marks_unlock_requests', 
        { status: actionType, admin_note: adminNote || null },
        { id: selectedRequest.id }
      );
      
      if (result.success) {
        toast({
          title: actionType === 'approved' ? "Request Approved" : "Request Rejected",
          description: actionType === 'approved' 
            ? `${selectedRequest.teacher_name} can now update marks.`
            : `${selectedRequest.teacher_name}'s request has been rejected.`,
        });
        await loadRequests();
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process request.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/20 text-warning"><Clock className="w-3 h-3" />Pending</span>;
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/20 text-success"><CheckCircle className="w-3 h-3" />Approved</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-destructive/20 text-destructive"><XCircle className="w-3 h-3" />Rejected</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {canApprove ? 'Marks Unlock Requests' : 'My Unlock Requests'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {canApprove 
              ? 'Manage teacher requests to edit previously submitted marks'
              : 'Track the status of your marks edit requests'
            }
          </p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Pending ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="processed" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Processed ({processedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {pendingRequests.length === 0 ? (
              <div className="card-elevated p-12 text-center">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <div key={request.id} className="card-elevated p-5 animate-fade-in border-l-4 border-l-warning">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-card-foreground">{request.teacher_name}</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground mb-3">
                          <div><span className="font-medium">Class:</span> {request.class}</div>
                          <div><span className="font-medium">Subject:</span> {request.subject_name}</div>
                          <div><span className="font-medium">Series:</span> {request.term}</div>
                          <div><span className="font-medium">Year:</span> {request.academic_year}</div>
                        </div>
                        {/* Student info */}
                        {request.student_name && (
                          <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg mb-3">
                            <p className="font-medium text-primary text-xs mb-1">📋 Student requested:</p>
                            <p className="text-card-foreground font-semibold">{request.student_name}</p>
                            {request.current_marks !== null && (
                              <p className="text-sm text-muted-foreground">Current marks: <strong>{request.current_marks}</strong></p>
                            )}
                          </div>
                        )}
                        {request.reason && (
                          <div className="text-sm bg-muted/50 p-3 rounded-lg">
                            <span className="font-medium">Reason: </span>{request.reason}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                      
                      {canApprove && (
                        <div className="flex gap-2 shrink-0">
                          <Button 
                            size="sm"
                            className="bg-success hover:bg-success/90 text-white"
                            onClick={() => handleAction(request, 'approved')}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <><CheckCircle className="w-4 h-4 mr-1" />Approve</>
                            )}
                          </Button>
                          <Button 
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(request, 'rejected')}
                            disabled={processingId === request.id}
                          >
                            <XCircle className="w-4 h-4 mr-1" />Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="processed" className="mt-6">
            {processedRequests.length === 0 ? (
              <div className="card-elevated p-12 text-center">
                <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No processed requests yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {processedRequests.map(request => (
                  <div key={request.id} className={`card-elevated p-5 animate-fade-in border-l-4 ${request.status === 'approved' ? 'border-l-success' : 'border-l-destructive'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-card-foreground">{request.teacher_name}</h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground mb-2">
                        <div><span className="font-medium">Class:</span> {request.class}</div>
                        <div><span className="font-medium">Subject:</span> {request.subject_name}</div>
                        <div><span className="font-medium">Series:</span> {request.term}</div>
                        <div><span className="font-medium">Year:</span> {request.academic_year}</div>
                      </div>
                      {request.student_name && (
                        <div className="text-sm mb-2">
                          <span className="font-medium">📋 Student:</span> {request.student_name}
                          {request.current_marks !== null && <span className="text-muted-foreground ml-2">(Marks: {request.current_marks})</span>}
                        </div>
                      )}
                      {request.reason && (
                        <p className="text-sm text-muted-foreground"><span className="font-medium">Reason:</span> {request.reason}</p>
                      )}
                      {request.admin_note && (
                        <p className="text-sm mt-1"><span className="font-medium">Admin Response:</span> {request.admin_note}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Admin Note Dialog */}
        <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approved' ? 'Approve Request' : 'Reject Request'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {selectedRequest && (
                 <div className="p-3 bg-muted/50 rounded-lg text-sm">
                   <p><strong>Teacher:</strong> {selectedRequest.teacher_name}</p>
                   <p><strong>Class:</strong> {selectedRequest.class} - {selectedRequest.subject_name}</p>
                   <p><strong>Series:</strong> {selectedRequest.term}</p>
                   {selectedRequest.student_name && (
                     <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded">
                       <p className="text-primary font-medium">📋 Student: {selectedRequest.student_name}</p>
                       {selectedRequest.current_marks !== null && (
                         <p className="text-muted-foreground">Current marks: <strong>{selectedRequest.current_marks}</strong></p>
                       )}
                     </div>
                   )}
                 </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Note (optional)</label>
                <Textarea
                  placeholder="Enter your note..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                onClick={confirmAction}
                className={`w-full ${actionType === 'approved' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'} text-white`}
              >
                {actionType === 'approved' ? 'Approve' : 'Reject'} Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
