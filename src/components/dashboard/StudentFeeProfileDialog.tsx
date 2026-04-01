import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { Loader2, DollarSign, Calendar, Receipt, AlertTriangle, Users, Percent } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  class: string;
  stream: string | null;
  boarding_type?: string;
  custom_fee?: number | null;
  discount_notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  selectedYear: string;
  feeStructure: { class: string; boarding_type: string; total_fee: number }[];
  feePayments: { student_id: string; amount: number; payment_date: string; payment_method: string; receipt_number: string | null; notes: string | null }[];
  familyGroupMembers: { student_id: string; family_group_id: string }[];
  familyGroupInstallments: { family_group_id: string; amount: number; installment_number: number; due_date: string }[];
}

export function StudentFeeProfileDialog({ open, onOpenChange, student, selectedYear, feeStructure, feePayments, familyGroupMembers, familyGroupInstallments }: Props) {
  const { fetchTable } = useSecureQuery();
  const [installments, setInstallments] = useState<any[]>([]);
  const [customInstallments, setCustomInstallments] = useState<any[]>([]);
  const [debtHistory, setDebtHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    const load = async () => {
      setLoading(true);
      const [classInst, customInst, debts] = await Promise.all([
        fetchTable<any>('fee_installments', { class: student.class, academic_year: selectedYear, boarding_type: student.boarding_type || 'day' }),
        fetchTable<any>('student_custom_installments', { student_id: student.id, academic_year: selectedYear }),
        fetchTable<any>('student_debt_history', { student_id: student.id }),
      ]);
      setInstallments(classInst || []);
      setCustomInstallments(customInst || []);
      setDebtHistory(debts || []);
      setLoading(false);
    };
    load();
  }, [open, student, selectedYear, fetchTable]);

  if (!student) return null;

  const membership = familyGroupMembers.find(m => m.student_id === student.id);
  const isFamily = !!membership;
  const hasCustom = customInstallments.length > 0;
  const hasDiscount = student.custom_fee !== null && student.custom_fee !== undefined;

  // Determine installments to show
  let displayInstallments: { number: number; amount: number; due_date: string }[] = [];
  if (isFamily && membership) {
    displayInstallments = familyGroupInstallments
      .filter(i => i.family_group_id === membership.family_group_id)
      .map(i => ({ number: i.installment_number, amount: Number(i.amount), due_date: i.due_date }));
  } else if (hasCustom) {
    displayInstallments = customInstallments
      .sort((a: any, b: any) => a.installment_number - b.installment_number)
      .map((i: any) => ({ number: i.installment_number, amount: Number(i.amount), due_date: i.due_date }));
  } else {
    displayInstallments = installments
      .sort((a: any, b: any) => a.installment_number - b.installment_number)
      .map((i: any) => ({ number: i.installment_number, amount: Number(i.amount), due_date: i.due_date }));
  }

  const expectedFee = isFamily
    ? displayInstallments.reduce((s, i) => s + i.amount, 0)
    : hasDiscount
      ? Number(student.custom_fee)
      : (() => {
          const fs = feeStructure.find(f => f.class === student.class && f.boarding_type === (student.boarding_type || 'day'));
          return fs?.total_fee || 0;
        })();

  const studentPayments = feePayments.filter(p => p.student_id === student.id);
  const totalPaid = studentPayments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = (expectedFee || 0) - totalPaid;
  const unclearedDebts = debtHistory.filter((d: any) => !d.is_cleared);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Fee Profile - {student.full_name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5 overflow-y-auto flex-1 pr-1">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">Class</p>
                <p className="font-semibold text-card-foreground">{student.stream ? `${student.class} ${student.stream}` : student.class}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-semibold text-card-foreground capitalize">{student.boarding_type || 'day'}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">Expected Fee</p>
                <p className="font-bold text-primary">TZS {(expectedFee || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="font-bold text-success">TZS {totalPaid.toLocaleString()}</p>
              </div>
            </div>

            {/* Balance */}
            <div className={`p-3 rounded-lg border ${balance > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-success/5 border-success/20'}`}>
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className={`text-lg font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>
                {balance > 0 ? `TZS ${balance.toLocaleString()} outstanding` : 'Fully paid'}
              </p>
            </div>

            {/* Fee type badges */}
            <div className="flex gap-2 flex-wrap">
              {isFamily && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Users className="w-3 h-3" /> Family Group
                </span>
              )}
              {hasDiscount && !isFamily && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                  <Percent className="w-3 h-3" /> Special Case
                </span>
              )}
              {student.discount_notes && (
                <span className="text-xs text-muted-foreground italic">{student.discount_notes}</span>
              )}
            </div>

            {/* Installment Schedule */}
            {displayInstallments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Installment Schedule ({selectedYear})
                </h4>
                <div className="space-y-2">
                  {displayInstallments.map((inst) => {
                    const dueDate = new Date(inst.due_date + 'T12:00:00');
                    const isPast = dueDate < new Date();
                    return (
                      <div key={inst.number} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/50">
                        <div>
                          <span className="text-sm font-medium text-card-foreground">Installment #{inst.number}</span>
                          <span className={`ml-2 text-xs ${isPast ? 'text-warning' : 'text-muted-foreground'}`}>
                            Due: {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <span className="font-semibold text-card-foreground">TZS {inst.amount.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment History */}
            <div>
              <h4 className="text-sm font-semibold text-card-foreground mb-2 flex items-center gap-1">
                <Receipt className="w-4 h-4" /> Payment History
              </h4>
              {studentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded">No payments recorded yet</p>
              ) : (
                <div className="space-y-1">
                  {studentPayments
                    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
                    .map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/50 text-sm">
                        <div>
                          <span className="text-card-foreground">{new Date(p.payment_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.payment_method}</span>
                          {p.receipt_number && <span className="ml-1 text-xs text-muted-foreground">#{p.receipt_number}</span>}
                        </div>
                        <span className="font-semibold text-success">TZS {Number(p.amount).toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Outstanding Debts */}
            {unclearedDebts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-warning" /> Previous Debts
                </h4>
                <div className="space-y-1">
                  {unclearedDebts.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-2 rounded bg-warning/5 border border-warning/20 text-sm">
                      <span className="text-card-foreground">{d.academic_year} - {d.term}</span>
                      <span className="font-semibold text-destructive">TZS {Number(d.outstanding_balance).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
