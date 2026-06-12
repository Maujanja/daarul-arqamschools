import { useState, useEffect, useCallback } from 'react';
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
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useAuth } from '@/contexts/AuthContext';
import { StudentAvatarUpload } from '@/components/StudentAvatarUpload';
import * as XLSX from 'xlsx';
import { FamilyGroupsManager } from './FamilyGroupsManager';

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
  Trash2,
  Settings,
  Percent,
  Edit,
  Camera,
  Upload,
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { StudentFeeProfileDialog } from '@/components/dashboard/StudentFeeProfileDialog';
import { BeemBalanceCard } from '@/components/dashboard/BeemBalanceCard';

interface Student {
  id: string;
  full_name: string;
  class: string;
  stream: string | null;
  roll_number: string;
  boarding_type?: string;
  custom_fee?: number | null;
  discount_notes?: string | null;
  avatar_url?: string | null;
  parent_phone?: string | null;
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

interface FeeInstallment {
  id: string;
  class: string;
  academic_year: string;
  boarding_type: string;
  installment_number: number;
  amount: number;
  due_date: string;
}

interface StudentCustomInstallment {
  id: string;
  student_id: string;
  academic_year: string;
  installment_number: number;
  amount: number;
  due_date: string;
  notes: string | null;
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

// Fixed installment due dates (month-day)
const ALL_INSTALLMENT_DUE_DATES = [
  { number: 1, month: 0, day: 1, label: 'Installment 1 (Jan 1)' },
  { number: 2, month: 2, day: 30, label: 'Installment 2 (Mar 30)' },
  { number: 3, month: 5, day: 30, label: 'Installment 3 (Jun 30)' },
  { number: 4, month: 8, day: 15, label: 'Installment 4 (Sep 15)' },
];

// Classes with only 3 installments (no Sep 15)
const THREE_INSTALLMENT_CLASSES = ['Primary 4', 'Primary 7', 'Senior 2', 'Senior 4'];

function getInstallmentDueDatesForClass(className: string) {
  if (THREE_INSTALLMENT_CLASSES.includes(className)) {
    return ALL_INSTALLMENT_DUE_DATES.filter(i => i.number <= 3);
  }
  return ALL_INSTALLMENT_DUE_DATES;
}

function getInstallmentDueDate(academicYear: string, installmentNumber: number): string {
  const parts = academicYear.split('-');
  const startYear = parseInt(parts[0]);
  const endYear = parts.length > 1 ? parseInt(parts[1]) : startYear;
  const inst = ALL_INSTALLMENT_DUE_DATES.find(i => i.number === installmentNumber);
  if (!inst) return `${startYear}-01-01`;
  // Months 0-5 (Jan-Jun) use end year, months 6-11 (Jul-Dec) use start year
  const useYear = inst.month <= 5 ? endYear : startYear;
  // Use manual string formatting to avoid timezone shifts from toISOString()
  const mm = String(inst.month + 1).padStart(2, '0');
  const dd = String(inst.day).padStart(2, '0');
  return `${useYear}-${mm}-${dd}`;
}

export function FeeDashboard({ isAdminMode = false }: { isAdminMode?: boolean } = {}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fetchTable } = useSecureQuery();
  const { insert, update, remove } = useSecureData();
  const { academicYears, currentYear, loading: yearsLoading } = useAcademicYears();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  
  // Filter state for academic year only (no term filter for Secretary)
  const [selectedYear, setSelectedYear] = useState(currentYear || '');
  
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
  
  // Fee structure management
  const [showFeeStructureDialog, setShowFeeStructureDialog] = useState(false);
  const [editingFeeStructure, setEditingFeeStructure] = useState<FeeStructure | null>(null);
  const [newFeeClass, setNewFeeClass] = useState('');
  const [newBoardingType, setNewBoardingType] = useState('day');
  const [newFeeYear, setNewFeeYear] = useState('');
  const [newTotalFee, setNewTotalFee] = useState('');
  
  // Installments state
  const [feeInstallments, setFeeInstallments] = useState<FeeInstallment[]>([]);
  const [installmentAmounts, setInstallmentAmounts] = useState<Record<number, string>>({1: '', 2: '', 3: '', 4: ''});
  const [installmentClass, setInstallmentClass] = useState('');
  const [installmentBoardingType, setInstallmentBoardingType] = useState('day');
  
  // Student custom installments
  const [showCustomInstallmentDialog, setShowCustomInstallmentDialog] = useState(false);
  const [selectedStudentForInstallment, setSelectedStudentForInstallment] = useState<Student | null>(null);
  const [studentCustomInstallments, setStudentCustomInstallments] = useState<StudentCustomInstallment[]>([]);
  const [customInstallmentRows, setCustomInstallmentRows] = useState<{amount: string; due_date: string; notes: string}[]>([]);

  // Family group data for fee calculations
  const [familyGroupMembers, setFamilyGroupMembers] = useState<{student_id: string; family_group_id: string}[]>([]);
  const [familyGroupInstallments, setFamilyGroupInstallments] = useState<{family_group_id: string; amount: number; installment_number: number; due_date: string}[]>([]);
  
  // Student discount management
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [selectedStudentForDiscount, setSelectedStudentForDiscount] = useState<Student | null>(null);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountNotes, setDiscountNotes] = useState('');
  const [specialCasePhone, setSpecialCasePhone] = useState('');
  
  // Student photo management
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [selectedStudentForPhoto, setSelectedStudentForPhoto] = useState<Student | null>(null);

  // Student fee profile
  const [showFeeProfile, setShowFeeProfile] = useState(false);
  const [feeProfileStudent, setFeeProfileStudent] = useState<Student | null>(null);

  // Set initial year when currentYear loads
  useEffect(() => {
    if (currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);

  useEffect(() => {
    if (selectedYear) {
      fetchData();
    }
  }, [selectedYear]);

  const fetchData = useCallback(async () => {
    if (!selectedYear) return;
    
    setIsLoading(true);
    
    try {
      // Fetch data using secure queries
      const [studentsRes, paymentsRes, structureRes, feedbackRes, debtHistoryRes, parentsRes, installmentsRes, familyMembersRes, familyInstRes] = await Promise.all([
        fetchTable<Student>('students'),
        fetchTable<FeePayment>('fee_payments', { academic_year: selectedYear }),
        fetchTable<FeeStructure>('fee_structure', { academic_year: selectedYear }),
        fetchTable<any>('feedback', { recipient_type: 'secretary' }),
        fetchTable<any>('student_debt_history', { is_cleared: false }),
        fetchTable<any>('parents'),
        fetchTable<FeeInstallment>('fee_installments', { academic_year: selectedYear }),
        fetchTable<any>('family_group_members', { academic_year: selectedYear }),
        fetchTable<any>('family_group_installments', { academic_year: selectedYear }),
      ]);

      setStudents(studentsRes || []);
      setFeePayments(paymentsRes || []);
      setFeeStructure(structureRes || []);
      setFeeInstallments(installmentsRes || []);
      setFamilyGroupMembers(familyMembersRes || []);
      setFamilyGroupInstallments(familyInstRes || []);
      
      // Enrich feedback with parent and student names
      if (feedbackRes) {
        const enrichedFeedback = feedbackRes.map((fb: any) => {
          const parent = parentsRes?.find((p: any) => p.id === fb.parent_id);
          const student = studentsRes?.find((s: any) => s.id === fb.student_id);
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
      if (debtHistoryRes && studentsRes) {
        const enrichedDebts = debtHistoryRes.map((debt: any) => {
          const student = studentsRes.find((s: any) => s.id === debt.student_id);
          return {
            ...debt,
            studentName: student?.full_name || 'Unknown',
            studentClass: student?.class || ''
          };
        });
        setDebtHistory(enrichedDebts as DebtHistory[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, fetchTable, toast]);
  
  const handleClearDebt = async (debtId: string) => {
    const result = await update(
      'student_debt_history',
      { 
        is_cleared: true, 
        cleared_by: 'Accountant',
        cleared_at: new Date().toISOString()
      },
      { id: debtId }
    );
    
    if (!result.success) {
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
    const result = await update(
      'feedback',
      { status: 'reviewed' },
      { id: feedbackId }
    );
    
    if (!result.success) {
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
    
    const result = await insert('fee_payments', {
      student_id: selectedStudentId,
      amount: parseFloat(paymentAmount),
      payment_method: paymentMethod,
      receipt_number: receiptNumber || null,
      academic_year: selectedYear,
      term: 'Annual',
      notes: paymentNotes || null,
      recorded_by: 'Accountant'
    });

    if (!result.success) {
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

  // Get expected fee for a student based on: family group > custom fee > class fee structure
  const getStudentExpectedFee = (student: Student) => {
    // 1. Check if student is in a family group - use family group installments
    const membership = familyGroupMembers.find(m => m.student_id === student.id);
    if (membership) {
      const groupInsts = familyGroupInstallments.filter(i => i.family_group_id === membership.family_group_id);
      if (groupInsts.length > 0) {
        return groupInsts.reduce((sum, i) => sum + Number(i.amount), 0);
      }
    }
    
    // 2. If student has custom fee (special case/discount), use that
    if (student.custom_fee !== null && student.custom_fee !== undefined) {
      return Number(student.custom_fee);
    }
    
    // 3. Default: class fee structure
    const boardingType = student.boarding_type || 'day';
    const structure = feeStructure.find(f => 
      f.class === student.class && 
      f.boarding_type === boardingType
    );
    return structure?.total_fee || 0;
  };

  // Fee structure management functions
  const handleSaveFeeStructure = async () => {
    const yearToUse = newFeeYear || selectedYear;
    
    if (!newFeeClass || !newTotalFee || !yearToUse) {
      toast({ title: "Error", description: "Please fill in class, year, and fee amount", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (editingFeeStructure) {
        // Update existing - also allow updating the year
        const result = await update(
          'fee_structure',
          { 
            total_fee: parseFloat(newTotalFee),
            academic_year: yearToUse
          },
          { id: editingFeeStructure.id }
        );
        
        if (!result.success) throw new Error(result.error);
        toast({ title: "Success", description: "Fee structure updated" });
      } else {
        // Insert new with selected year
        const result = await insert('fee_structure', {
          class: newFeeClass,
          boarding_type: newBoardingType,
          total_fee: parseFloat(newTotalFee),
          tuition_fee: parseFloat(newTotalFee),
          academic_year: yearToUse,
          term: 'Annual'
        });
        
        if (!result.success) throw new Error(result.error);
        toast({ title: "Success", description: `Fee structure added for ${yearToUse}` });
      }
      
      setShowFeeStructureDialog(false);
      setEditingFeeStructure(null);
      setNewFeeClass('');
      setNewBoardingType('day');
      setNewTotalFee('');
      setNewFeeYear('');
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeeStructure = async (id: string) => {
    const result = await remove('fee_structure', { id });
    if (!result.success) {
      toast({ title: "Error", description: "Failed to delete fee structure", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Fee structure deleted" });
      fetchData();
    }
  };

  const openEditFeeStructure = (fs: FeeStructure) => {
    setEditingFeeStructure(fs);
    setNewFeeClass(fs.class);
    setNewBoardingType(fs.boarding_type);
    setNewTotalFee(fs.total_fee.toString());
    setNewFeeYear(fs.academic_year);
    setShowFeeStructureDialog(true);
    // Scroll edit form into view after state update
    setTimeout(() => {
      document.getElementById('fee-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // Installment management functions
  const handleSaveInstallments = async () => {
    const yearToUse = newFeeYear || selectedYear;
    if (!installmentClass || !yearToUse) {
      toast({ title: "Error", description: "Please select class and year", variant: "destructive" });
      return;
    }

    const hasAnyAmount = Object.values(installmentAmounts).some(v => v && parseFloat(v) > 0);
    if (!hasAnyAmount) {
      toast({ title: "Error", description: "Please enter at least one installment amount", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Delete existing installments for this class/year/boarding combo
      await remove('fee_installments', { 
        class: installmentClass, 
        academic_year: yearToUse, 
        boarding_type: installmentBoardingType 
      });

      // Insert new installments
      const records = getInstallmentDueDatesForClass(installmentClass)
        .filter(inst => installmentAmounts[inst.number] && parseFloat(installmentAmounts[inst.number]) > 0)
        .map(inst => ({
          class: installmentClass,
          academic_year: yearToUse,
          boarding_type: installmentBoardingType,
          installment_number: inst.number,
          amount: parseFloat(installmentAmounts[inst.number]),
          due_date: getInstallmentDueDate(yearToUse, inst.number),
        }));

      if (records.length > 0) {
        const result = await insert('fee_installments', records);
        if (!result.success) throw new Error(result.error);
      }

      // Auto-update total fee in fee_structure
      const totalFee = records.reduce((sum, r) => sum + r.amount, 0);
      if (totalFee > 0) {
        // Check if fee_structure exists
        const existingStructure = feeStructure.find(
          fs => fs.class === installmentClass && fs.boarding_type === installmentBoardingType && fs.academic_year === yearToUse
        );
        if (existingStructure) {
          await update('fee_structure', { total_fee: totalFee }, { id: existingStructure.id });
        } else {
          await insert('fee_structure', {
            class: installmentClass,
            boarding_type: installmentBoardingType,
            total_fee: totalFee,
            tuition_fee: totalFee,
            academic_year: yearToUse,
            term: 'Annual'
          });
        }
      }

      toast({ title: "Success", description: `Installments saved for ${installmentClass} (${installmentBoardingType})` });
      setInstallmentAmounts({1: '', 2: '', 3: '', 4: ''});
      setInstallmentClass('');
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadInstallmentsForClass = (cls: string, boardingType: string) => {
    const existing = feeInstallments.filter(
      fi => fi.class === cls && fi.boarding_type === boardingType
    );
    const amounts: Record<number, string> = {1: '', 2: '', 3: '', 4: ''};
    existing.forEach(fi => {
      amounts[fi.installment_number] = fi.amount.toString();
    });
    setInstallmentAmounts(amounts);
  };

  // Student custom installment functions
  const openCustomInstallmentDialog = async (student: Student) => {
    setSelectedStudentForInstallment(student);
    setShowCustomInstallmentDialog(true);
    
    // Load discount info into same dialog
    setDiscountAmount(student.custom_fee?.toString() || '');
    setDiscountNotes(student.discount_notes || '');
    setSpecialCasePhone(student.parent_phone || '');
    
    // Fetch existing custom installments for this student
    const existing = await fetchTable<StudentCustomInstallment>('student_custom_installments', {
      student_id: student.id,
      academic_year: selectedYear,
    });
    
    setStudentCustomInstallments(existing || []);
    
    if (existing && existing.length > 0) {
      setCustomInstallmentRows(
        existing.sort((a, b) => a.installment_number - b.installment_number).map(ci => ({
          amount: ci.amount.toString(),
          due_date: ci.due_date,
          notes: ci.notes || '',
        }))
      );
    } else {
      // Default rows with standard due dates based on student's class
      const studentClass = student.class || '';
      const classDates = getInstallmentDueDatesForClass(studentClass);
      setCustomInstallmentRows(
        classDates.map(inst => ({
          amount: '',
          due_date: getInstallmentDueDate(selectedYear, inst.number),
          notes: '',
        }))
      );
    }
  };

  const handleSaveCustomInstallments = async () => {
    if (!selectedStudentForInstallment) return;
    
    const validRows = customInstallmentRows.filter(r => r.amount && parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      toast({ title: "Error", description: "Please enter at least one installment", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Delete existing custom installments
      await remove('student_custom_installments', {
        student_id: selectedStudentForInstallment.id,
        academic_year: selectedYear,
      });

      // Insert new
      const records = validRows.map((row, idx) => ({
        student_id: selectedStudentForInstallment.id,
        academic_year: selectedYear,
        installment_number: idx + 1,
        amount: parseFloat(row.amount),
        due_date: row.due_date,
        notes: row.notes || null,
      }));

      const result = await insert('student_custom_installments', records);
      if (!result.success) throw new Error(result.error);

      // Update student custom_fee to total of all custom installments
      const totalCustomFee = records.reduce((sum, r) => sum + r.amount, 0);
      await update('students', { 
        custom_fee: totalCustomFee,
        discount_notes: discountNotes || `Special installments (${records.length} installments)`,
        parent_phone: specialCasePhone.trim() || null,
      }, { id: selectedStudentForInstallment.id });

      toast({ title: "Success", description: `Special case saved for ${selectedStudentForInstallment.full_name}` });
      setShowCustomInstallmentDialog(false);
      setDiscountAmount('');
      setDiscountNotes('');
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCustomInstallmentRow = () => {
    const parts = selectedYear.split('-');
    const endYear = parts.length > 1 ? parts[1] : parts[0];
    setCustomInstallmentRows(prev => [...prev, { amount: '', due_date: `${endYear}-01-01`, notes: '' }]);
  };

  const removeCustomInstallmentRow = (index: number) => {
    setCustomInstallmentRows(prev => prev.filter((_, i) => i !== index));
  };

  const openDiscountDialog = (student: Student) => {
    setSelectedStudentForDiscount(student);
    setDiscountAmount(student.custom_fee?.toString() || '');
    setDiscountNotes(student.discount_notes || '');
    setShowDiscountDialog(true);
  };

  const handleSaveDiscount = async () => {
    if (!selectedStudentForDiscount) return;

    setIsSubmitting(true);
    
    try {
      const customFee = discountAmount ? parseFloat(discountAmount) : null;
      
      const result = await update(
        'students',
        { 
          custom_fee: customFee,
          discount_notes: discountNotes || null
        },
        { id: selectedStudentForDiscount.id }
      );
      
      if (!result.success) throw new Error(result.error);
      
      toast({ 
        title: "Success", 
        description: customFee ? `Custom fee set: TZS ${customFee.toLocaleString()}` : "Discount removed" 
      });
      
      setShowDiscountDialog(false);
      setSelectedStudentForDiscount(null);
      setDiscountAmount('');
      setDiscountNotes('');
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (!selectedStudentForDiscount) return;
    
    setIsSubmitting(true);
    
    try {
      const result = await update(
        'students',
        { custom_fee: null, discount_notes: null },
        { id: selectedStudentForDiscount.id }
      );
      
      if (!result.success) throw new Error(result.error);
      
      toast({ title: "Success", description: "Discount removed" });
      
      setShowDiscountDialog(false);
      setSelectedStudentForDiscount(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle student avatar update
  const handleAvatarChange = async (studentId: string, newUrl: string | null) => {
    try {
      const result = await update(
        'students',
        { avatar_url: newUrl },
        { id: studentId }
      );
      
      if (!result.success) throw new Error(result.error);
      
      // Update local state
      setStudents(prev => prev.map(s => 
        s.id === studentId ? { ...s, avatar_url: newUrl } : s
      ));
      
      if (selectedStudentForPhoto) {
        setSelectedStudentForPhoto({ ...selectedStudentForPhoto, avatar_url: newUrl });
      }
      
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openPhotoDialog = (student: Student) => {
    setSelectedStudentForPhoto(student);
    setShowPhotoDialog(true);
  };


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
        body: {
          question: userMessage,
          userId: user?.id,
          userRole: user?.role,
        },
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

  // Template download class selection
  const [showTemplateClassDialog, setShowTemplateClassDialog] = useState(false);
  const [templateClass, setTemplateClass] = useState('');

  const ALL_CLASSES = ['Baby Class', 'Kindergarten I', 'Kindergarten II', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7', 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'];

  // Download Excel template for fee payments - filtered by class
  const handleDownloadTemplate = () => {
    if (students.length === 0) {
      toast({ title: "Error", description: "No students loaded yet. Please wait for data to load.", variant: "destructive" });
      return;
    }
    setTemplateClass('');
    setShowTemplateClassDialog(true);
  };

  const handleConfirmDownloadTemplate = () => {
    if (!templateClass) {
      toast({ title: "Error", description: "Please select a class first.", variant: "destructive" });
      return;
    }

    try {
      const classStudents = students
        .filter(s => s.class === templateClass)
        .sort((a, b) => a.roll_number.localeCompare(b.roll_number));

      if (classStudents.length === 0) {
        toast({ title: "Error", description: `No students found in ${templateClass}.`, variant: "destructive" });
        return;
      }

      const templateData: (string | number)[][] = [
        ['Roll Number', 'Student Name', 'Class', 'Amount', 'Payment Method', 'Receipt Number', 'Notes']
      ];

      classStudents.forEach(s => {
        templateData.push([
          s.roll_number,
          s.full_name,
          s.class,
          0,
          'Cash',
          '',
          ''
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 25 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fee Payments');
      XLSX.writeFile(wb, `Fee_Payment_Template_${templateClass}_${selectedYear}.xlsx`, { bookType: 'xlsx' });

      toast({ title: "Success", description: `Template for ${templateClass} downloaded. Fill amounts and upload.` });
      setShowTemplateClassDialog(false);
    } catch (error) {
      console.error('Template download error:', error);
      toast({ title: "Error", description: "Failed to download template. Please try again.", variant: "destructive" });
    }
  };

  // Upload Excel fee payments
  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSubmitting(true);
      toast({ title: "Processing", description: "Reading Excel file..." });

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      // Filter rows with amount > 0
      const validRows = rows.filter(row => {
        const amount = Number(row['Amount']);
        const rollNumber = String(row['Roll Number'] || '').trim();
        return amount > 0 && rollNumber;
      });

      if (validRows.length === 0) {
        toast({ title: "Error", description: "No valid payment rows found. Ensure Amount > 0.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      // Match roll numbers to student IDs
      const paymentRecords: Record<string, unknown>[] = [];
      const errors: string[] = [];

      for (const row of validRows) {
        const rollNumber = String(row['Roll Number']).trim();
        const student = students.find(s => s.roll_number === rollNumber);
        
        if (!student) {
          errors.push(`Roll number "${rollNumber}" not found`);
          continue;
        }

        paymentRecords.push({
          student_id: student.id,
          amount: Number(row['Amount']),
          payment_method: String(row['Payment Method'] || 'Cash').trim(),
          receipt_number: row['Receipt Number'] ? String(row['Receipt Number']).trim() : null,
          notes: row['Notes'] ? String(row['Notes']).trim() : null,
          academic_year: selectedYear,
          term: 'Annual',
          recorded_by: 'Accountant (Excel Upload)',
        });
      }

      if (paymentRecords.length > 0) {
        const result = await insert('fee_payments', paymentRecords);
        if (!result.success) throw new Error(result.error);
      }

      const msg = `${paymentRecords.length} payments uploaded successfully.` + 
        (errors.length > 0 ? ` ${errors.length} skipped: ${errors.slice(0, 3).join(', ')}` : '');
      
      toast({ title: "Success", description: msg });
      fetchData();
    } catch (error: any) {
      console.error('Excel upload error:', error);
      toast({ title: "Error", description: error.message || "Failed to process Excel file", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      // Reset file input
      e.target.value = '';
    }
  };

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
          <h1 className="text-3xl font-display font-bold text-foreground">
            {isAdminMode ? 'Fee & Payment Management' : 'Accountant Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdminMode ? 'Admin Accountant Operations' : 'Fee and Payment Management'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowFeeStructureDialog(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Manage Fees
          </Button>
          <Button variant="outline" onClick={() => setShowDebtManagement(!showDebtManagement)}>
            <History className="w-4 h-4 mr-2" />
            Previous Debts ({debtHistory.length})
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download Template
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUploadExcel}
                className="hidden"
                disabled={isSubmitting}
              />
            </label>
          </Button>
          <Button variant="outline" onClick={() => navigate('/announcements')}>
            <GraduationCap className="w-4 h-4 mr-2" />
            Announcements
          </Button>
          <Button className="btn-gradient" onClick={() => setShowAddPaymentDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Beem SMS Balance */}
      <BeemBalanceCard />

      {/* Historical Debt Management */}
      {showDebtManagement && debtHistory.length > 0 && (
        <div className="card-elevated p-6 animate-fade-in border-2 border-warning/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-warning" />
              <h3 className="font-display font-semibold text-lg text-card-foreground">
                Previous Outstanding Debts
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowDebtManagement(false)}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            These students have outstanding debts from previous years/series. Click "Clear Debt" when paid.
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Student</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Class</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Year</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Series</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Debt</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
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
                        Clear Debt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-3 bg-warning/10 rounded-lg">
            <p className="text-sm text-warning font-medium">
              Total Outstanding Debts: TZS {debtHistory.reduce((sum, d) => sum + Number(d.outstanding_balance), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Family Fee Groups */}
      <FamilyGroupsManager
        selectedYear={selectedYear}
        students={students}
        onDataChanged={fetchData}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Students"
          value={students.length.toString()}
          subtitle="Registered"
          icon={Users}
          variant="primary"
          bgStyle="silk"
        />
        <StatCard
          title="Total Collected"
          value={`TZS ${totalCollected.toLocaleString()}`}
          subtitle={`${selectedYear}`}
          icon={DollarSign}
          variant="success"
          bgStyle="cherries"
        />
        <StatCard
          title="With Outstanding"
          value={studentsWithDebt.toString()}
          subtitle="Students"
          icon={AlertTriangle}
          variant="warning"
          bgStyle="silk"
        />
        <StatCard
          title="Today's Payments"
          value={feePayments.filter(p => p.payment_date === new Date().toISOString().split('T')[0]).length.toString()}
          subtitle="Records"
          icon={TrendingUp}
          variant="accent"
          bgStyle="cherries"
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
                            const hasDiscount = student.custom_fee !== null && student.custom_fee !== undefined;
                            const isInFamilyGroup = familyGroupMembers.some(m => m.student_id === student.id);
                            
                            return (
                              <tr key={student.id} className="border-b border-border/50 table-row-hover">
                                <td className="py-3 px-4 font-medium text-card-foreground">
                                  <div className="flex items-center gap-3">
                                    <StudentAvatarUpload
                                      studentId={student.id}
                                      studentName={student.full_name}
                                      currentAvatarUrl={student.avatar_url}
                                      onAvatarChange={(url) => handleAvatarChange(student.id, url)}
                                      size="sm"
                                      editable={false}
                                    />
                                    <div>
                                      <span>{student.full_name}</span>
                                      {student.stream && (
                                        <span className="ml-1 text-xs text-muted-foreground">({student.stream})</span>
                                      )}
                                      {isInFamilyGroup && (
                                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                          <Users className="w-3 h-3" />
                                          Family
                                        </span>
                                      )}
                                      {hasDiscount && !isInFamilyGroup && (
                                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                                          <Percent className="w-3 h-3" />
                                          Discount
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
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
                                <td className="py-3 px-2 sm:px-4 text-right">
                                  <div className="flex gap-1 justify-end flex-wrap">
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-8 w-8"
                                      onClick={() => { setFeeProfileStudent(student); setShowFeeProfile(true); }}
                                      title="View Fee Profile"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-8 w-8"
                                      onClick={() => openPhotoDialog(student)}
                                      title="Manage Photo"
                                    >
                                      <Camera className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-8 w-8"
                                      onClick={() => openCustomInstallmentDialog(student)}
                                      title="Special Case (Custom Fee & Installments)"
                                    >
                                      <Settings className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-8"
                                      onClick={() => {
                                        setSelectedStudentId(student.id);
                                        setShowAddPaymentDialog(true);
                                      }}
                                    >
                                      <Receipt className="w-3 h-3 sm:mr-1" />
                                      <span className="hidden sm:inline">Pay</span>
                                    </Button>
                                  </div>
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
                      <td className="py-4 px-4 text-card-foreground">{student.stream ? `${student.class} ${student.stream}` : student.class}</td>
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
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name} - {student.stream ? `${student.class} ${student.stream}` : student.class}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Installment info for selected student */}
            {selectedStudentId && (() => {
              const student = students.find(s => s.id === selectedStudentId);
              if (!student) return null;
              
              // Check family group first, then custom installments, then class installments
              const membership = familyGroupMembers.find(m => m.student_id === selectedStudentId);
              let insts: {installment_number: number; amount: number; due_date: string}[] = [];
              let isFamilyGroup = false;
              
              if (membership) {
                const groupInsts = familyGroupInstallments.filter(i => i.family_group_id === membership.family_group_id);
                if (groupInsts.length > 0) {
                  insts = groupInsts;
                  isFamilyGroup = true;
                }
              }
              
              if (insts.length === 0) {
                const customInsts = studentCustomInstallments.filter(
                  ci => ci.student_id === selectedStudentId && ci.academic_year === selectedYear
                );
                const classInsts = feeInstallments.filter(
                  fi => fi.class === student.class && fi.boarding_type === (student.boarding_type || 'day') && fi.academic_year === selectedYear
                );
                insts = customInsts.length > 0 ? customInsts : classInsts;
              }
              
              if (insts.length === 0) return null;
              
              const sortedInsts = [...insts].sort((a, b) => a.installment_number - b.installment_number);
              
              // Calculate paid amount for this student
              const studentPayments = feePayments.filter(
                fp => fp.student_id === selectedStudentId && fp.academic_year === selectedYear
              );
              const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
              
              // Find current installment
              let cumulative = 0;
              let currentInstNum = -1;
              let carryOver = 0;
              for (const inst of sortedInsts) {
                cumulative += Number(inst.amount);
                if (cumulative > totalPaid) {
                  currentInstNum = inst.installment_number;
                  const prevCum = cumulative - Number(inst.amount);
                  carryOver = Math.max(0, prevCum - totalPaid);
                  break;
                }
              }
              
              return (
                <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                  <p className="text-sm font-medium text-card-foreground">
                    Installment Status {isFamilyGroup && <span className="text-xs text-primary ml-1">(Family Group)</span>}
                  </p>
                  {currentInstNum > 0 ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current Installment:</span>
                        <span className="font-semibold text-primary">#{currentInstNum} of {sortedInsts.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Installment Amount:</span>
                        <span className="font-medium">TZS {Number(sortedInsts.find(i => i.installment_number === currentInstNum)?.amount || 0).toLocaleString()}</span>
                      </div>
                      {carryOver > 0 && (
                        <div className="flex justify-between text-sm text-destructive">
                          <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Unpaid from previous:</span>
                          <span className="font-medium">TZS {carryOver.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm border-t border-border pt-1">
                        <span className="text-muted-foreground">Total Paid:</span>
                        <span className="font-medium text-success">TZS {totalPaid.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-success font-medium">✓ All installments paid</p>
                  )}
                </div>
              );
            })()}
            
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

      {/* Fee Structure & Installments Management Dialog */}
      <Dialog open={showFeeStructureDialog} onOpenChange={setShowFeeStructureDialog}>
        <DialogContent className="left-0 top-0 w-screen h-[var(--app-viewport-height)] max-h-[var(--app-viewport-height)] translate-x-0 translate-y-0 rounded-none border-0 sm:left-[50%] sm:top-[50%] sm:w-[95vw] sm:h-auto sm:max-h-[85vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border max-w-4xl flex flex-col p-0 sm:p-0 gap-0">
          <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-2 shrink-0">
            <DialogTitle className="text-base sm:text-lg">Manage Fees & Installments - {selectedYear}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2 sm:py-4 px-4 sm:px-6 overflow-y-auto flex-1 min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Current Fee Structure - Card layout on mobile, table on desktop */}
            <div>
              <h4 className="font-medium mb-3 text-sm sm:text-base">Current Fee Structure & Installments</h4>
              {feeStructure.length > 0 ? (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Class</th>
                          <th className="text-left py-2 px-3">Type</th>
                          <th className="text-right py-2 px-3">Total Fee</th>
                          <th className="text-right py-2 px-3">Inst. 1 (Jan 1)</th>
                          <th className="text-right py-2 px-3">Inst. 2 (Mar 30)</th>
                          <th className="text-right py-2 px-3">Inst. 3 (Jun 30)</th>
                          <th className="text-right py-2 px-3">Inst. 4 (Sep 15)</th>
                          <th className="text-right py-2 px-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeStructure.map((fs) => {
                          const classInstallments = feeInstallments.filter(
                            fi => fi.class === fs.class && fi.boarding_type === fs.boarding_type
                          );
                          return (
                            <tr key={fs.id} className="border-b">
                              <td className="py-2 px-3">{fs.class}</td>
                              <td className="py-2 px-3 capitalize">{fs.boarding_type}</td>
                              <td className="py-2 px-3 text-right font-medium">{Number(fs.total_fee).toLocaleString()}</td>
                              {[1,2,3,4].map(num => {
                                const inst = classInstallments.find(ci => ci.installment_number === num);
                                return (
                                  <td key={num} className="py-2 px-3 text-right text-muted-foreground">
                                    {inst ? `TZS ${Number(inst.amount).toLocaleString()}` : '-'}
                                  </td>
                                );
                              })}
                              <td className="py-2 px-3 text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="outline" onClick={() => {
                                    setInstallmentClass(fs.class);
                                    setInstallmentBoardingType(fs.boarding_type);
                                    loadInstallmentsForClass(fs.class, fs.boarding_type);
                                    setNewFeeYear(fs.academic_year);
                                    setTimeout(() => document.getElementById('installment-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                                  }}>
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteFeeStructure(fs.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card layout */}
                  <div className="md:hidden space-y-3">
                    {feeStructure.map((fs) => {
                      const classInstallments = feeInstallments.filter(
                        fi => fi.class === fs.class && fi.boarding_type === fs.boarding_type
                      );
                      return (
                        <div key={fs.id} className="border border-border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm text-card-foreground">{fs.class}</p>
                              <p className="text-xs text-muted-foreground capitalize">{fs.boarding_type} • Total: TZS {Number(fs.total_fee).toLocaleString()}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => {
                                setInstallmentClass(fs.class);
                                setInstallmentBoardingType(fs.boarding_type);
                                loadInstallmentsForClass(fs.class, fs.boarding_type);
                                setNewFeeYear(fs.academic_year);
                                setTimeout(() => document.getElementById('installment-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                              }}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={() => handleDeleteFeeStructure(fs.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {getInstallmentDueDatesForClass(fs.class).map(instDef => {
                              const inst = classInstallments.find(ci => ci.installment_number === instDef.number);
                              return (
                                <div key={instDef.number} className="flex justify-between bg-muted/40 rounded px-2 py-1">
                                  <span className="text-muted-foreground">Inst. {instDef.number}</span>
                                  <span className="font-medium">{inst ? `${Number(inst.amount).toLocaleString()}` : '-'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No fee structure set for this year.</p>
              )}
            </div>

            {/* Set Installments Form */}
            <div id="installment-edit-form" className="border-t pt-4 bg-accent/10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 rounded-lg">
              <h4 className="font-medium mb-3 text-sm sm:text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {installmentClass ? `Set Installments: ${installmentClass} (${installmentBoardingType})` : 'Set Installments for a Class'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Academic Year</Label>
                  <Select value={newFeeYear || selectedYear} onValueChange={setNewFeeYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Class</Label>
                  <Select value={installmentClass} onValueChange={(v) => {
                    setInstallmentClass(v);
                    loadInstallmentsForClass(v, installmentBoardingType);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_CLASSES.map((cls) => (
                        <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Type</Label>
                  <Select value={installmentBoardingType} onValueChange={(v) => {
                    setInstallmentBoardingType(v);
                    if (installmentClass) loadInstallmentsForClass(installmentClass, v);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="boarding">Boarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {installmentClass && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    {getInstallmentDueDatesForClass(installmentClass).map(inst => (
                      <div key={inst.number} className="space-y-1.5">
                        <Label className="text-xs leading-tight">{inst.label}</Label>
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={installmentAmounts[inst.number]}
                          onChange={(e) => setInstallmentAmounts(prev => ({...prev, [inst.number]: e.target.value}))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Total: TZS {Object.values(installmentAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0).toLocaleString()}
                    </p>
                    <Button onClick={handleSaveInstallments} disabled={isSubmitting} className="w-full sm:w-auto">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Installments
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="p-4 sm:p-6 pt-2 sm:pt-2 shrink-0 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setShowFeeStructureDialog(false); setEditingFeeStructure(null); setInstallmentClass(''); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Custom Installments Dialog */}
      <Dialog open={showCustomInstallmentDialog} onOpenChange={setShowCustomInstallmentDialog}>
        <DialogContent className="left-0 top-0 w-screen h-[var(--app-viewport-height)] max-h-[var(--app-viewport-height)] translate-x-0 translate-y-0 rounded-none border-0 sm:left-[50%] sm:top-[50%] sm:w-[95vw] sm:h-auto sm:max-h-[85vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border max-w-2xl flex flex-col p-0 sm:p-0 gap-0">
          <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Settings className="w-5 h-5 text-primary" />
              Special Case - Custom Fee & Installments
            </DialogTitle>
          </DialogHeader>
          {selectedStudentForInstallment && (
            <div className="space-y-4 py-2 sm:py-4 px-4 sm:px-6 overflow-y-auto flex-1 min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm sm:text-base">{selectedStudentForInstallment.full_name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {selectedStudentForInstallment.class} • {selectedStudentForInstallment.boarding_type || 'Day'} • {selectedYear}
                </p>
              </div>

              {/* Discount/Reason Section */}
              <div className="space-y-2 border border-border rounded-lg p-3">
                <Label className="text-xs sm:text-sm font-semibold">Reason / Notes</Label>
                <Input
                  placeholder="e.g. Staff child, Scholarship, Special arrangement"
                  value={discountNotes}
                  onChange={(e) => setDiscountNotes(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Explain why this student is a special case (e.g. staff child, scholarship, special arrangement)
                </p>
              </div>

              {/* Parent Phone for SMS reminders */}
              <div className="space-y-2 border border-border rounded-lg p-3">
                <Label className="text-xs sm:text-sm font-semibold">Parent Phone Number</Label>
                <Input
                  placeholder="e.g. 255712345678 or 0712345678"
                  value={specialCasePhone}
                  onChange={(e) => setSpecialCasePhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required to send automated SMS reminders when each installment due date arrives.
                </p>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                Set the fee amount for each installment and its due date. The custom fee will be calculated from the total of all installments.
              </p>

              <div className="space-y-3">
                {customInstallmentRows.map((row, index) => (
                  <div key={index} className="border border-border rounded-lg p-3 space-y-2 sm:space-y-0 sm:flex sm:items-end sm:gap-2">
                    <div className="flex items-center justify-between sm:hidden">
                      <span className="text-xs font-semibold text-muted-foreground">Installment #{index + 1}</span>
                      {customInstallmentRows.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeCustomInstallmentRow(index)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-muted-foreground w-6 pb-2">#{index + 1}</span>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:gap-2">
                      <div className="space-y-1 sm:flex-1">
                        <Label className="text-xs">Amount (TZS)</Label>
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={row.amount}
                          onChange={(e) => {
                            const updated = [...customInstallmentRows];
                            updated[index].amount = e.target.value;
                            setCustomInstallmentRows(updated);
                          }}
                        />
                      </div>
                      <div className="space-y-1 sm:flex-1">
                        <Label className="text-xs">Due Date (Month & Day)</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={12}
                            placeholder="MM"
                            className="w-16"
                            value={row.due_date ? new Date(row.due_date + 'T00:00:00').getMonth() + 1 : 1}
                            onChange={(e) => {
                              const updated = [...customInstallmentRows];
                              const currentDate = new Date(row.due_date + 'T00:00:00');
                              const year = parseInt(selectedYear.split('-')[0]);
                              let newMonth = Math.max(1, Math.min(12, parseInt(e.target.value) || 1));
                              const maxDay = new Date(year, newMonth, 0).getDate();
                              const day = Math.min(currentDate.getDate(), maxDay);
                              const mm = String(newMonth).padStart(2, '0');
                              const dd = String(day).padStart(2, '0');
                              updated[index].due_date = `${year}-${mm}-${dd}`;
                              setCustomInstallmentRows(updated);
                            }}
                          />
                          <span className="flex items-center text-muted-foreground">/</span>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            placeholder="DD"
                            className="w-16"
                            value={row.due_date ? new Date(row.due_date + 'T00:00:00').getDate() : 1}
                            onChange={(e) => {
                              const updated = [...customInstallmentRows];
                              const currentDate = new Date(row.due_date + 'T00:00:00');
                              const year = parseInt(selectedYear.split('-')[0]);
                              const month = currentDate.getMonth() + 1;
                              const maxDay = new Date(year, month, 0).getDate();
                              let day = Math.max(1, Math.min(maxDay, parseInt(e.target.value) || 1));
                              const mm = String(month).padStart(2, '0');
                              const dd = String(day).padStart(2, '0');
                              updated[index].due_date = `${year}-${mm}-${dd}`;
                              setCustomInstallmentRows(updated);
                            }}
                          />
                          <span className="flex items-center text-xs text-muted-foreground">/ {selectedYear.split('-')[0]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="sm:flex-1 space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        placeholder="Optional"
                        value={row.notes}
                        onChange={(e) => {
                          const updated = [...customInstallmentRows];
                          updated[index].notes = e.target.value;
                          setCustomInstallmentRows(updated);
                        }}
                      />
                    </div>
                    <div className="hidden sm:block">
                      {customInstallmentRows.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeCustomInstallmentRow(index)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={addCustomInstallmentRow}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Installment
                </Button>
                <p className="text-sm font-medium text-primary">
                  Custom Fee (Total): TZS {customInstallmentRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 p-4 sm:p-6 pt-2 sm:pt-2 shrink-0 border-t">
            {selectedStudentForInstallment?.custom_fee !== null && selectedStudentForInstallment?.custom_fee !== undefined && (
              <Button variant="outline" className="w-full sm:w-auto text-destructive" onClick={async () => {
                if (!selectedStudentForInstallment) return;
                setIsSubmitting(true);
                try {
                  // Remove custom installments
                  if (studentCustomInstallments.length > 0) {
                    for (const ci of studentCustomInstallments) {
                      await remove('student_custom_installments', { id: ci.id });
                    }
                  }
                  // Remove custom fee
                  await update('students', { custom_fee: null, discount_notes: null }, { id: selectedStudentForInstallment.id });
                  toast({ title: "Success", description: "Special case removed" });
                  setShowCustomInstallmentDialog(false);
                  fetchData();
                } catch (error: any) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                } finally {
                  setIsSubmitting(false);
                }
              }} disabled={isSubmitting}>
                Remove Special Case
              </Button>
            )}
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowCustomInstallmentDialog(false)}>Cancel</Button>
            <Button className="w-full sm:w-auto" onClick={handleSaveCustomInstallments} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Special Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Discount Dialog removed - merged into Special Case dialog above */}

      {/* Student Photo Management Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Manage Student Photo
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedStudentForPhoto && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center gap-4">
                <StudentAvatarUpload
                  studentId={selectedStudentForPhoto.id}
                  studentName={selectedStudentForPhoto.full_name}
                  currentAvatarUrl={selectedStudentForPhoto.avatar_url}
                  onAvatarChange={(url) => handleAvatarChange(selectedStudentForPhoto.id, url)}
                  size="xl"
                  editable={true}
                />
                <div className="text-center">
                  <p className="font-medium text-lg">{selectedStudentForPhoto.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedStudentForPhoto.class} • {selectedStudentForPhoto.boarding_type || 'Day'}
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Instructions:</strong> Click the camera icon to upload a new photo. 
                  Supported formats: JPG, PNG, GIF. Maximum size: 5MB.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhotoDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Class Selection Dialog */}
      <Dialog open={showTemplateClassDialog} onOpenChange={setShowTemplateClassDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Class for Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Choose the class to generate a fee payment template for:</p>
            <Select value={templateClass} onValueChange={setTemplateClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CLASSES.map(cls => (
                  <SelectItem key={cls} value={cls}>
                    {cls} ({students.filter(s => s.class === cls).length} students)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateClassDialog(false)}>Cancel</Button>
            <Button onClick={handleConfirmDownloadTemplate}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Fee Profile Dialog */}
      <StudentFeeProfileDialog
        open={showFeeProfile}
        onOpenChange={setShowFeeProfile}
        student={feeProfileStudent}
        selectedYear={selectedYear}
        feeStructure={feeStructure}
        feePayments={feePayments}
        familyGroupMembers={familyGroupMembers}
        familyGroupInstallments={familyGroupInstallments}
      />
    </div>
  );
}
