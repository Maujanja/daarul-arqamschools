import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { classes as ALL_CLASSES } from '@/data/mockData';
import { getTestsForClass, getTestDisplayName, getFilterLabel } from '@/utils/seniorGrading';
import { CalendarDays, Lock, Unlock, Loader2, ShieldCheck } from 'lucide-react';

interface MarksWindow {
  id: string;
  class: string;
  term: string;
  academic_year: string;
  is_open: boolean;
  opened_by: string | null;
  opened_at: string | null;
  closed_at: string | null;
  exam_date: string | null;
}

const SECTION_BASE_CLASSES: Record<string, string[]> = {
  head_nursery: ['Baby Class', 'Kindergarten I', 'Kindergarten II'],
  head_primary: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7'],
  head_secondary: ['Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'],
};

export default function MarksWindowsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fetchTable } = useSecureQuery();
  const { insert, update } = useSecureData();
  const { academicYears, currentYear } = useAcademicYears();

  const role = user?.role || '';
  const canManage = role === 'admin' || role.startsWith('head_');
  const allowedClasses = useMemo(
    () => (role === 'admin' ? ALL_CLASSES : SECTION_BASE_CLASSES[role] || []),
    [role]
  );

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [windows, setWindows] = useState<MarksWindow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingTerm, setSavingTerm] = useState<string | null>(null);
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedClass && allowedClasses.length > 0) setSelectedClass(allowedClasses[0]);
  }, [allowedClasses, selectedClass]);

  useEffect(() => {
    if (!selectedYear && currentYear) setSelectedYear(currentYear);
  }, [currentYear, selectedYear]);

  const loadWindows = useCallback(async () => {
    if (!selectedClass || !selectedYear) return;
    setIsLoading(true);
    const rows = await fetchTable<MarksWindow>('marks_entry_windows', {
      class: selectedClass,
      academic_year: selectedYear,
    }, { limit: 200 });
    setWindows(rows);
    setDateDrafts(Object.fromEntries(rows.map((row) => [row.term, row.exam_date || ''])));
    setIsLoading(false);
  }, [selectedClass, selectedYear, fetchTable]);

  useEffect(() => {
    loadWindows();
  }, [loadWindows]);

  const seriesList = useMemo(
    () => (selectedClass ? getTestsForClass(selectedClass) : []),
    [selectedClass]
  );

  const windowFor = (term: string) => windows.find((w) => w.term === term);

  const toggleSeries = async (term: string, open: boolean) => {
    setSavingTerm(term);
    try {
      const existing = windowFor(term);
      const examDate = dateDrafts[term] || existing?.exam_date || '';
      if (open && !examDate) {
        toast({ title: 'Examination date required', description: `Set the date for ${getTestDisplayName(term, selectedClass)} before opening it.`, variant: 'destructive' });
        return;
      }
      const now = new Date().toISOString();
      const payload = {
        is_open: open,
        opened_by: user?.name || role,
        opened_at: open ? now : existing?.opened_at || null,
        closed_at: open ? null : now,
        exam_date: examDate || null,
      };

      const result = existing
        ? await update('marks_entry_windows', payload, { id: existing.id })
        : await insert('marks_entry_windows', {
            class: selectedClass,
            term,
            academic_year: selectedYear,
            ...payload,
          });

      if (!result.success) throw new Error(result.error || 'Operation failed');

      toast({
        title: open ? 'Series Imefunguliwa' : 'Series Imefungwa',
        description: `${getTestDisplayName(term, selectedClass)} — ${selectedClass} (${selectedYear})`,
      });
      await loadWindows();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update series',
        variant: 'destructive',
      });
    } finally {
      setSavingTerm(null);
    }
  };

  const saveSeriesDate = async (term: string) => {
    const examDate = dateDrafts[term];
    if (!examDate) {
      toast({ title: 'Examination date required', description: 'Choose the date when this Series was or will be held.', variant: 'destructive' });
      return;
    }
    setSavingTerm(term);
    try {
      const existing = windowFor(term);
      const result = existing
        ? await update('marks_entry_windows', { exam_date: examDate }, { id: existing.id })
        : await insert('marks_entry_windows', { class: selectedClass, term, academic_year: selectedYear, is_open: false, exam_date: examDate });
      if (!result.success) throw new Error(result.error || 'Unable to save date');
      toast({ title: 'Examination date saved', description: `${getTestDisplayName(term, selectedClass)} — ${new Date(`${examDate}T12:00:00`).toLocaleDateString('en-GB')}` });
      await loadWindows();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unable to save date', variant: 'destructive' });
    } finally {
      setSavingTerm(null);
    }
  };

  if (!canManage) {
    return (
      <DashboardLayout>
        <div className="card-elevated p-8 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Only Admin and Head of School can manage series opening.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-card-foreground">Series Control</h1>
          <p className="text-muted-foreground">Set the examination date, then open or close {selectedClass ? getFilterLabel(selectedClass).toLowerCase() : 'series'} for marks entry.</p>
        </div>

        <div className="card-elevated p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Class</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {allowedClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Academic Year</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Series</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                     <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Examination Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Opened By</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Open / Close</th>
                  </tr>
                </thead>
                <tbody>
                  {seriesList.map((series) => {
                    const term = series.value;
                    const win = windowFor(term);
                    const open = win?.is_open === true;
                    return (
                      <tr key={term} className="border-b border-border/50">
                        <td className="py-4 px-4 font-medium text-card-foreground">
                          {series.label}
                        </td>
                        <td className="py-4 px-4">
                          {open ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                              <Unlock className="w-3 h-3" /> Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                              <Lock className="w-3 h-3" /> Closed
                            </span>
                          )}
                        </td>
                         <td className="py-4 px-4">
                           <div className="flex min-w-[190px] items-center gap-2">
                             <input
                               type="date"
                               value={dateDrafts[term] || ''}
                               onChange={(event) => setDateDrafts((current) => ({ ...current, [term]: event.target.value }))}
                               className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                               aria-label={`${series.label} examination date`}
                             />
                             <Button size="icon" variant="outline" onClick={() => void saveSeriesDate(term)} disabled={savingTerm === term} title="Save examination date">
                               {savingTerm === term ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                             </Button>
                           </div>
                         </td>
                        <td className="py-4 px-4 text-sm text-muted-foreground">{win?.opened_by || '—'}</td>
                        <td className="py-4 px-4 text-center">
                          {savingTerm === term ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" />
                          ) : (
                            <Switch checked={open} onCheckedChange={(checked) => toggleSeries(term, checked)} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={loadWindows} disabled={isLoading}>Refresh</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
