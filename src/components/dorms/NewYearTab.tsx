import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSecureData } from '@/hooks/useSecureData';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { DormData } from './dormContext';
import { DormAssignment, isBoarding, isEligible } from '@/types/dorm';

export function NewYearTab({ data, years }: { data: DormData; years: string[] }) {
  const { insert, remove } = useSecureData();
  const { fetchTable } = useSecureQuery();
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);

  const carryForward = async () => {
    if (!from || from === data.selectedYear) return toast.error('Choose a different previous year');
    setBusy(true);
    const prev = await fetchTable<DormAssignment>('dorm_assignments', { academic_year: from });
    const already = new Set(data.assignments.map((a) => a.student_id));
    const used = new Set(data.assignments.map((a) => a.bed_id));
    const rows = prev
      .filter((a) => {
        const s = data.studentById.get(a.student_id);
        const d = data.dormById.get(a.dormitory_id);
        return s && d && isBoarding(s) && isEligible(s, d) && !already.has(a.student_id) && !used.has(a.bed_id);
      })
      .map((a) => ({
        student_id: a.student_id,
        dormitory_id: a.dormitory_id,
        bed_id: a.bed_id,
        academic_year: data.selectedYear,
        assigned_by: data.userName,
        notes: `Carried forward from ${from}`,
      }));
    let ok = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const res = await insert('dorm_assignments', rows.slice(i, i + 50));
      if (res.success) ok += Math.min(50, rows.length - i);
    }
    setBusy(false);
    toast.success(`${ok} students carried forward. ${prev.length - ok} skipped (left boarding, changed section or bed taken).`);
    data.reload();
  };

  const clearYear = async () => {
    if (!confirm(`Remove all ${data.assignments.length} allocations for ${data.selectedYear}? History is kept.`)) return;
    setBusy(true);
    for (const a of data.assignments) await remove('dorm_assignments', { id: a.id });
    setBusy(false);
    toast.success('Allocations cleared — history kept');
    data.reload();
  };

  const totalSpaces = data.beds.length;
  const free = totalSpaces - data.assignments.length;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card-elevated p-4">
        <h3 className="font-semibold mb-1">Allocation for {data.selectedYear}</h3>
        <p className="text-sm text-muted-foreground">
          {data.assignments.length} allocated • {free} of {totalSpaces} spaces free. Change the year at the top of the page
          to start a new year's allocation — previous years stay untouched.
        </p>
      </div>
      <div className="card-elevated p-4 space-y-3">
        <h3 className="font-semibold">Carry forward boarding students</h3>
        <p className="text-sm text-muted-foreground">
          Copies each student's bed from a previous year into {data.selectedYear}, if they are still boarding and still fit the dormitory.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="space-y-2">
            <Label>From year</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Previous year" />
              </SelectTrigger>
              <SelectContent>
                {years.filter((y) => y !== data.selectedYear).map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={carryForward} disabled={!data.canManage || busy || !from}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Carry forward
          </Button>
        </div>
      </div>
      <div className="card-elevated p-4 space-y-3">
        <h3 className="font-semibold">Clear allocations</h3>
        <p className="text-sm text-muted-foreground">
          Frees every bed for {data.selectedYear} so you can reallocate (use Auto Allocate afterwards). History records remain.
        </p>
        <Button variant="destructive" onClick={clearYear} disabled={!data.canManage || busy || !data.assignments.length}>
          Clear {data.selectedYear} allocations
        </Button>
      </div>
    </div>
  );
}
