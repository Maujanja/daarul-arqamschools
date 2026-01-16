import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { terms } from '@/data/mockData';
import { 
  Users, 
  DollarSign, 
  Plus, 
  Search,
  Loader2,
  Receipt,
  AlertTriangle,
  TrendingUp,
  Bot,
  Send,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  MessageSquare,
  User,
  Calendar,
  Clock,
  CheckCircle,
  History,
  XCircle,
  Trash2
} from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  class: string;
  roll_number: string;
  boarding_type?: string;
}

interface FeePayment {
  id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string | null;
  academic_year: string;
  term: string;
  notes: string | null;
  students?: {
    full_name: string;
    class: string;
    boarding_type?: string;
  };
}

interface FeeStructure {
  id: string;
  class: string;
  academic_year: string;
  term: string;
  total_fee: number;
  boarding_type: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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

interface DebtHistory {
  id: string;
  student_id: string;
  academic_year: string;
  term: string;
  original_amount: number;
  amount_paid: number;
  outstanding_balance: number;
  is_cleared: boolean;
  cleared_by: string | null;
  cleared_at: string | null;
  notes: string | null;
  created_at: string;
  studentName?: string;
  studentClass?: string;
}

export function SecretaryDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { academicYears, currentYear, loading: yearsLoading } = useAcademicYears();
  
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  
  // Filter state for academic year and term
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(terms[0] || 'Term 1');
  
  // AI Assistant state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // Add payment dialog
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  
  // Debt history state
  const [debtHistory, setDebtHistory] = useState<DebtHistory[]>([]);
  const [showDebtManagement, setShowDebtManagement] = useState(false);

  // Set initial year when academic years load
  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  useEffect(() => {
    if (selectedYear) {
      fetchData();
    }
  }, [selectedYear, selectedTerm]);

  const fetchData = async () => {
    if (!selectedYear) return;
    
    setIsLoading(true);
    
    const [studentsRes, paymentsRes, structureRes, feedbackRes, debtHistoryRes] = await Promise.all([
      supabase.from('students').select('*').order('class').order('full_name'),
      supabase.from('fee_payments')
        .select('*, students(full_name, class, boarding_type)')
        .eq('academic_year', selectedYear)
        .eq('term', selectedTerm)
        .order('payment_date', { ascending: false }),
      supabase.from('fee_structure')
        .select('*')
        .eq('academic_year', selectedYear)
        .eq('term', selectedTerm),
      supabase.from('feedback').select('*').eq('recipient_type', 'secretary').order('created_at', { ascending: false }),
      supabase.from('student_debt_history').select('*').eq('is_cleared', false).order('created_at', { ascending: false })
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    if (paymentsRes.data) setFeePayments(paymentsRes.data as FeePayment[]);
    if (structureRes.data) setFeeStructure(structureRes.data as FeeStructure[]);
    
    // Enrich feedback with parent and student names
    if (feedbackRes.data) {
      const { data: parentsData } = await supabase.from('parents').select('id, full_name');
      const enrichedFeedback = feedbackRes.data.map(fb => {
        const parent = parentsData?.find(p => p.id === fb.parent_id);
        const student = studentsRes.data?.find(s => s.id === fb.student_id);
        return {
          ...fb,
          parentName: parent?.full_name || 'Parent',
          studentName: student?.full_name || 'Student',
          studentClass: student?.class || ''
        };
      });
      setFeedback(enrichedFeedback as FeedbackItem[]);
    }
    
    // Enrich debt history with student names
    if (debtHistoryRes.data && studentsRes.data) {
      const enrichedDebts = debtHistoryRes.data.map(debt => {
        const student = studentsRes.data?.find(s => s.id === debt.student_id);
        return {
          ...debt,
          studentName: student?.full_name || 'Unknown',
          studentClass: student?.class || ''
        };
      });
      setDebtHistory(enrichedDebts as DebtHistory[]);
    }
    
    setIsLoading(false);
  };
  
  const handleClearDebt = async (debtId: string) => {
    const { error } = await supabase
      .from('student_debt_history')
      .update({ 
        is_cleared: true, 
        cleared_by: 'Secretary',
        cleared_at: new Date().toISOString()
      })
      .eq('id', debtId);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to clear debt",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Debt cleared successfully",
      });
      fetchData();
    }
  };
  
  const handleMarkFeedbackReviewed = async (feedbackId: string) => {
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
      fetchData();
    }
  };

  const handleAddPayment = async () => {
    if (!selectedStudentId || !paymentAmount) {
      toast({
        title: "Error",
        description: "Please select a student and enter the payment amount",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await supabase.from('fee_payments').insert({
      student_id: selectedStudentId,
      amount: parseFloat(paymentAmount),
      payment_method: paymentMethod,
      receipt_number: receiptNumber || null,
      academic_year: selectedYear,
      term: selectedTerm,
      notes: paymentNotes || null,
      recorded_by: 'Secretary'
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Payment has been recorded",
      });
      setShowAddPaymentDialog(false);
      resetPaymentForm();
      fetchData();
    }
    
    setIsSubmitting(false);
  };

  const resetPaymentForm = () => {
    setSelectedStudentId('');
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setReceiptNumber('');
    setPaymentNotes('');
  };

  // Get expected fee for a student based on their class and boarding type
  const getStudentExpectedFee = (student: Student) => {
    const boardingType = student.boarding_type || 'day';
    const structure = feeStructure.find(f => 
      f.class === student.class && 
      f.boarding_type === boardingType
    );
    return structure?.total_fee || 0;
  };

  // Get paid amount for a student (already filtered by year/term in fetchData)
  const getStudentPaidAmount = (studentId: string) => {
    return feePayments
      .filter(p => p.student_id === studentId)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  // Get balance for a student
  const getStudentBalance = (student: Student) => {
    const expectedFee = getStudentExpectedFee(student);
    const paidAmount = getStudentPaidAmount(student.id);
    return expectedFee - paidAmount;
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim()) return;
    
    const userMessage = aiQuestion.trim();
    setAiQuestion('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);
    
    try {
      const response = await supabase.functions.invoke('fee-assistant', {
        body: { question: userMessage }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      const answer = response.data?.answer || 'Sorry, I could not process your question.';
      setChatHistory(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      console.error('AI error:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your question. Please try again.' 
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleClassExpand = (className: string) => {
    setExpandedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(className)) {
        newSet.delete(className);
      } else {
        newSet.add(className);
      }
      return newSet;
    });
  };

  const totalCollected = feePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const studentsWithDebt = students.filter(s => getStudentBalance(s) > 0).length;

  // Get unique classes
  const classes = [...new Set(students.map(s => s.class))].sort();

  // Group students by class
  const studentsByClass = classes.reduce((acc, cls) => {
    acc[cls] = students.filter(s => s.class === cls);
    return acc;
  }, {} as Record<string, Student[]>);

  const filteredStudents = students.filter(s => 
    (selectedClass === 'all' || s.class === selectedClass) &&
    (s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Secretary Dashboard</h1>
          <p className="text-muted-foreground mt-1">Fee and Payment Management</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowDebtManagement(!showDebtManagement)}>
            <History className="w-4 h-4 mr-2" />
            Madeni ya Zamani ({debtHistory.length})
          </Button>
          <Button variant="outline" onClick={() => navigate('/students')}>
            <GraduationCap className="w-4 h-4 mr-2" />
            Manage Students
          </Button>
          <Button className="btn-gradient" onClick={() => setShowAddPaymentDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Historical Debt Management */}
      {showDebtManagement && debtHistory.length > 0 && (
        <div className="card-elevated p-6 animate-fade-in border-2 border-warning/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-warning" />
              <h3 className="font-display font-semibold text-lg text-card-foreground">
                Madeni ya Mwaka Uliopita
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowDebtManagement(false)}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Wanafunzi hawa wana madeni kutoka mwaka uliopita. Unaweza kufuta deni baada ya kulipwa.
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Mwanafunzi</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Darasa</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Mwaka</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Muhula</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Deni</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Kitendo</th>
                </tr>
              </thead>
              <tbody>
                {debtHistory.map((debt) => (
                  <tr key={debt.id} className="border-b border-border/50 table-row-hover">
                    <td className="py-4 px-4 font-medium text-card-foreground">{debt.studentName}</td>
                    <td className="py-4 px-4 text-card-foreground">{debt.studentClass}</td>
                    <td className="py-4 px-4 text-card-foreground">{debt.academic_year}</td>
                    <td className="py-4 px-4 text-card-foreground">{debt.term}</td>
                    <td className="py-4 px-4 text-right text-destructive font-medium">
                      TZS {Number(debt.outstanding_balance).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success hover:text-success"
                        onClick={() => handleClearDebt(debt.id)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Futa Deni
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-3 bg-warning/10 rounded-lg">
            <p className="text-sm text-warning font-medium">
              Jumla ya Madeni ya Zamani: TZS {debtHistory.reduce((sum, d) => sum + Number(d.outstanding_balance), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Students"
          value={students.length.toString()}
          subtitle="Registered"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Total Collected"
          value={`TZS ${totalCollected.toLocaleString()}`}
          subtitle="This year"
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="With Outstanding"
          value={studentsWithDebt.toString()}
          subtitle="Students"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Today's Payments"
          value={feePayments.filter(p => p.payment_date === new Date().toISOString().split('T')[0]).length.toString()}
          subtitle="Records"
          icon={TrendingUp}
          variant="accent"
        />
      </div>

      {/* AI Assistant */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-lg text-card-foreground">AI Fee Assistant</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Ask questions about student fees, payments, and balances. For example: "Which students have outstanding balances?" or "How much has Class 1 paid?"
        </p>
        
        {chatHistory.length > 0 && (
          <div className="max-h-64 overflow-y-auto mb-4 space-y-3 p-4 bg-muted/30 rounded-lg">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-background border border-border'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-background border border-border p-3 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask about student fees..."
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAskAI();
              }
            }}
            className="min-h-[60px] resize-none"
          />
          <Button onClick={handleAskAI} disabled={aiLoading || !aiQuestion.trim()}>
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Parent Messages */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Parent Messages
          </h3>
          <Button variant="outline" size="sm" onClick={() => navigate('/feedback')}>
            View All
          </Button>
        </div>
        
        {feedback.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No messages from parents yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {feedback.slice(0, 5).map((fb) => (
              <div key={fb.id} className="py-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-card-foreground">{fb.parentName}</p>
                        <p className="text-sm text-muted-foreground">
                          About: {fb.studentName} ({fb.studentClass})
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {fb.status === 'pending' ? (
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
                    <p className="mt-2 text-card-foreground line-clamp-2">{fb.message}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(fb.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                      {fb.status === 'pending' && (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkFeedbackReviewed(fb.id)}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Mark Reviewed
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Students by Class */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground">Students by Class</h3>
          <div className="flex gap-2 flex-wrap">
            {/* Year Filter */}
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Term Filter */}
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term} value={term}>{term}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Class Filter */}
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
        
        {selectedClass === 'all' && !searchQuery ? (
          // Grouped view by class
          <div className="space-y-4">
            {classes.map((className) => {
              const classStudents = studentsByClass[className] || [];
              const isExpanded = expandedClasses.has(className);
              
              // Calculate total expected and paid for this class considering boarding types
              const classTotals = classStudents.reduce((acc, student) => {
                const expectedFee = getStudentExpectedFee(student);
                const paidAmount = getStudentPaidAmount(student.id);
                return {
                  expected: acc.expected + expectedFee,
                  paid: acc.paid + paidAmount
                };
              }, { expected: 0, paid: 0 });
              
              const classDebt = classTotals.expected - classTotals.paid;
              
              return (
                <div key={className} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleClassExpand(className)}
                    className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-card-foreground">{className}</span>
                      <span className="text-sm text-muted-foreground">{classStudents.length} students</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-success">Paid: TZS {classTotals.paid.toLocaleString()}</span>
                      {classDebt > 0 && (
                        <span className="text-sm text-destructive">Outstanding: TZS {classDebt.toLocaleString()}</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Expected</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Paid</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Balance</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classStudents.map((student) => {
                            const expectedFee = getStudentExpectedFee(student);
                            const paidAmount = getStudentPaidAmount(student.id);
                            const balance = expectedFee - paidAmount;
                            
                            return (
                              <tr key={student.id} className="border-b border-border/50 table-row-hover">
                                <td className="py-3 px-4 font-medium text-card-foreground">{student.full_name}</td>
                                <td className="py-3 px-4 text-card-foreground capitalize">{student.boarding_type || 'day'}</td>
                                <td className="py-3 px-4 text-right text-card-foreground">TZS {expectedFee.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-success font-medium">TZS {paidAmount.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right">
                                  {balance > 0 ? (
                                    <span className="text-destructive font-medium">TZS {balance.toLocaleString()}</span>
                                  ) : (
                                    <span className="text-success font-medium">None</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedStudentId(student.id);
                                      setShowAddPaymentDialog(true);
                                    }}
                                  >
                                    <Receipt className="w-3 h-3 mr-1" />
                                    Pay
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Filtered/searched view
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Class</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Expected Fee</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Paid</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Balance</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.slice(0, 20).map((student) => {
                  const expectedFee = getStudentExpectedFee(student);
                  const paidAmount = getStudentPaidAmount(student.id);
                  const balance = expectedFee - paidAmount;
                  
                  return (
                    <tr key={student.id} className="border-b border-border/50 table-row-hover">
                      <td className="py-4 px-4 font-medium text-card-foreground">{student.full_name}</td>
                      <td className="py-4 px-4 text-card-foreground">{student.class}</td>
                      <td className="py-4 px-4 text-right text-card-foreground">TZS {expectedFee.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-success font-medium">TZS {paidAmount.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right">
                        {balance > 0 ? (
                          <span className="text-destructive font-medium">TZS {balance.toLocaleString()}</span>
                        ) : (
                          <span className="text-success font-medium">None</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedStudentId(student.id);
                            setShowAddPaymentDialog(true);
                          }}
                        >
                          <Receipt className="w-3 h-3 mr-1" />
                          Pay
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Payments */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Recent Payments</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Student</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Class</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Method</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {feePayments.slice(0, 10).map((payment) => (
                <tr key={payment.id} className="border-b border-border/50 table-row-hover">
                  <td className="py-4 px-4 font-medium text-card-foreground">{payment.students?.full_name || 'N/A'}</td>
                  <td className="py-4 px-4 text-card-foreground">{payment.students?.class || 'N/A'}</td>
                  <td className="py-4 px-4 text-card-foreground">{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td className="py-4 px-4 text-card-foreground">{payment.payment_method}</td>
                  <td className="py-4 px-4 text-right font-medium text-success">TZS {Number(payment.amount).toLocaleString()}</td>
                </tr>
              ))}
              {feePayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No payments recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name} - {student.class}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Amount (TZS)</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Mobile Money">Mobile Money (M-Pesa/Tigo Pesa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Receipt Number (Optional)</Label>
              <Input
                placeholder="Enter receipt number"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input
                placeholder="Enter any notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPayment} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
