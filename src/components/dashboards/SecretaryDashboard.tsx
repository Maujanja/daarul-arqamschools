import { useState, useEffect } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  DollarSign, 
  Plus, 
  Search,
  Loader2,
  Receipt,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  class: string;
  roll_number: string;
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
  };
}

interface FeeStructure {
  id: string;
  class: string;
  academic_year: string;
  term: string;
  total_fee: number;
}

export function SecretaryDashboard() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add payment dialog
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [studentsRes, paymentsRes, structureRes] = await Promise.all([
      supabase.from('students').select('*').order('full_name'),
      supabase.from('fee_payments').select('*, students(full_name, class)').order('payment_date', { ascending: false }),
      supabase.from('fee_structure').select('*')
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    if (paymentsRes.data) setFeePayments(paymentsRes.data as FeePayment[]);
    if (structureRes.data) setFeeStructure(structureRes.data);
    
    setIsLoading(false);
  };

  const handleAddPayment = async () => {
    if (!selectedStudentId || !paymentAmount) {
      toast({
        title: "Kosa",
        description: "Chagua mwanafunzi na weka kiasi cha malipo",
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
      academic_year: '2024-2025',
      term: 'Term 1',
      notes: paymentNotes || null,
      recorded_by: 'Secretary'
    });

    if (error) {
      toast({
        title: "Kosa",
        description: "Imeshindikana kurekodi malipo",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Imefanikiwa",
        description: "Malipo yamerekodwa",
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

  const getStudentBalance = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return 0;
    
    const structure = feeStructure.find(f => f.class === student.class);
    const expectedFee = structure?.total_fee || 0;
    
    const paidAmount = feePayments
      .filter(p => p.student_id === studentId)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    return expectedFee - paidAmount;
  };

  const totalCollected = feePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const studentsWithDebt = students.filter(s => getStudentBalance(s.id) > 0).length;

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-3xl font-display font-bold text-foreground">Dashibodi ya Katibu</h1>
          <p className="text-muted-foreground mt-1">Usimamizi wa Ada na Malipo</p>
        </div>
        <Button className="btn-gradient" onClick={() => setShowAddPaymentDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Rekodi Malipo
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Wanafunzi Wote"
          value={students.length.toString()}
          subtitle="Wamesajiliwa"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Jumla Iliyokusanywa"
          value={`TZS ${totalCollected.toLocaleString()}`}
          subtitle="Mwaka huu"
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="Wenye Madeni"
          value={studentsWithDebt.toString()}
          subtitle="Wanafunzi"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Malipo ya Leo"
          value={feePayments.filter(p => p.payment_date === new Date().toISOString().split('T')[0]).length.toString()}
          subtitle="Rekodi"
          icon={TrendingUp}
          variant="accent"
        />
      </div>

      {/* Students with Balance */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground">Hali ya Malipo ya Wanafunzi</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tafuta mwanafunzi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Jina</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Darasa</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ada Inayohitajika</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Kilicholipwa</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Deni</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Hatua</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.slice(0, 10).map((student) => {
                const structure = feeStructure.find(f => f.class === student.class);
                const expectedFee = structure?.total_fee || 0;
                const paidAmount = feePayments
                  .filter(p => p.student_id === student.id)
                  .reduce((sum, p) => sum + Number(p.amount), 0);
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
                        <span className="text-success font-medium">Hakuna</span>
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
                        Lipa
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Malipo ya Hivi Karibuni</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Mwanafunzi</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Darasa</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tarehe</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Njia</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Kiasi</th>
              </tr>
            </thead>
            <tbody>
              {feePayments.slice(0, 10).map((payment) => (
                <tr key={payment.id} className="border-b border-border/50 table-row-hover">
                  <td className="py-4 px-4 font-medium text-card-foreground">{payment.students?.full_name || 'N/A'}</td>
                  <td className="py-4 px-4 text-card-foreground">{payment.students?.class || 'N/A'}</td>
                  <td className="py-4 px-4 text-card-foreground">{new Date(payment.payment_date).toLocaleDateString('sw-TZ')}</td>
                  <td className="py-4 px-4 text-card-foreground">{payment.payment_method}</td>
                  <td className="py-4 px-4 text-right font-medium text-success">TZS {Number(payment.amount).toLocaleString()}</td>
                </tr>
              ))}
              {feePayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Hakuna malipo yaliyorekodiwa
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
            <DialogTitle>Rekodi Malipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mwanafunzi</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chagua mwanafunzi" />
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
              <Label>Kiasi (TZS)</Label>
              <Input
                type="number"
                placeholder="Weka kiasi"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Njia ya Malipo</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Taslimu</SelectItem>
                  <SelectItem value="Bank Transfer">Benki</SelectItem>
                  <SelectItem value="Mobile Money">Simu (M-Pesa/Tigo Pesa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nambari ya Risiti (Hiari)</Label>
              <Input
                placeholder="Weka nambari ya risiti"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Maelezo (Hiari)</Label>
              <Input
                placeholder="Weka maelezo yoyote"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPaymentDialog(false)}>
              Ghairi
            </Button>
            <Button onClick={handleAddPayment} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Inahifadhi...
                </>
              ) : (
                'Hifadhi Malipo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
