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
          title: actionType === 'approved' ? "Idhini Imekubaliwa" : "Ombi Limekataliwa",
          description: actionType === 'approved' 
            ? `${selectedRequest.teacher_name} sasa anaweza kubadilisha maksi.`
            : `Ombi la ${selectedRequest.teacher_name} limekataliwa.`,
        });
        await loadRequests();
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Imeshindikana.",
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
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/20 text-warning"><Clock className="w-3 h-3" />Inasubiri</span>;
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/20 text-success"><CheckCircle className="w-3 h-3" />Imekubaliwa</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-destructive/20 text-destructive"><XCircle className="w-3 h-3" />Imekataliwa</span>;
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
            {isAdmin ? 'Maombi ya Idhini (Maksi)' : 'Maombi Yangu ya Idhini'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin 
              ? 'Simamia maombi ya walimu ya kubadilisha maksi zilizoshawekwa'
              : 'Fuatilia hali ya maombi yako ya kubadilisha maksi'
            }
          </p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Inasubiri ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="processed" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Yaliyojibiwa ({processedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {pendingRequests.length === 0 ? (
              <div className="card-elevated p-12 text-center">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Hakuna maombi yanayosubiri</p>
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
                          <div><span className="font-medium">Darasa:</span> {request.class}</div>
                          <div><span className="font-medium">Somo:</span> {request.subject_name}</div>
                          <div><span className="font-medium">Test:</span> {request.term}</div>
                          <div><span className="font-medium">Mwaka:</span> {request.academic_year}</div>
                        </div>
                        {request.reason && (
                          <div className="text-sm bg-muted/50 p-3 rounded-lg space-y-1">
                            {request.reason.split('\n').map((line, i) => (
                              <p key={i} className={line.startsWith('Wanafunzi:') ? 'font-medium text-primary' : ''}>
                                {i === 0 && <span className="font-medium">Sababu: </span>}
                                {line}
                              </p>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                      
                      {isAdmin && (
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
                              <><CheckCircle className="w-4 h-4 mr-1" />Kubali</>
                            )}
                          </Button>
                          <Button 
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(request, 'rejected')}
                            disabled={processingId === request.id}
                          >
                            <XCircle className="w-4 h-4 mr-1" />Kataa
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
                <p className="text-muted-foreground">Hakuna maombi yaliyojibiwa bado</p>
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
                        <div><span className="font-medium">Darasa:</span> {request.class}</div>
                        <div><span className="font-medium">Somo:</span> {request.subject_name}</div>
                        <div><span className="font-medium">Test:</span> {request.term}</div>
                        <div><span className="font-medium">Mwaka:</span> {request.academic_year}</div>
                      </div>
                      {request.reason && (
                        <p className="text-sm text-muted-foreground"><span className="font-medium">Sababu:</span> {request.reason}</p>
                      )}
                      {request.admin_note && (
                        <p className="text-sm mt-1"><span className="font-medium">Jibu la Admin:</span> {request.admin_note}</p>
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
                {actionType === 'approved' ? 'Kubali Ombi' : 'Kataa Ombi'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {selectedRequest && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p><strong>Mwalimu:</strong> {selectedRequest.teacher_name}</p>
                  <p><strong>Darasa:</strong> {selectedRequest.class} - {selectedRequest.subject_name}</p>
                  <p><strong>Test:</strong> {selectedRequest.term}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Maoni (hiari)</label>
                <Textarea
                  placeholder="Andika maoni yako..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                onClick={confirmAction}
                className={`w-full ${actionType === 'approved' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'} text-white`}
              >
                {actionType === 'approved' ? 'Kubali' : 'Kataa'} Ombi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
