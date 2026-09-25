import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSecureData } from '@/hooks/useSecureData';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';
import { DormData, bedIsFree } from './dormContext';
import { DormBed, isBoarding, isEligible, bedLabel } from '@/types/dorm';

type Strategy = 'fill' | 'even' | 'class';

export function AutoAllocateTab({ data }: { data: DormData }) {
  const { insert } = useSecureData();
  const [strategy, setStrategy] = useState<Strategy>('fill');
  const [running, setRunning] = useState(false);

  const plan = useMemo(() => {
    const assigned = new Set(data.assignments.map((a) => a.student_id));
    let pending = data.students.filter((s) => isBoarding(s) && !assigned.has(s.id));
    pending = [...pending].sort(
      (a, b) => a.class.localeCompare(b.class, undefined, { numeric: true }) || a.full_name.localeCompare(b.full_name),
    );
    const free = new Map<string, DormBed[]>();
    data.dorms.forEach((d) =>
      free.set(
        d.id,
        data.beds
          .filter((b) => b.dormitory_id === d.id && bedIsFree(data, b.id))
          .sort((a, b) => a.bed_number - b.bed_number),
      ),
    );
    const rows: { studentId: string; dormId: string; bed: DormBed }[] = [];
    const unplaced: string[] = [];
    // for "class" strategy keep each class in the same dormitory where possible
    const classDorm = new Map<string, string>();
    pending.forEach((s) => {
      const eligible = data.dorms.filter((d) => isEligible(s, d) && (free.get(d.id)?.length || 0) > 0);
      if (!eligible.length) return unplaced.push(s.id);
      let dorm = eligible[0];
      if (strategy === 'even') {
        dorm = [...eligible].sort((a, b) => (free.get(b.id)!.length) - (free.get(a.id)!.length))[0];
      } else if (strategy === 'class') {
        const key = `${s.class}|${s.gender}`;
        const prev = eligible.find((d) => d.id === classDorm.get(key));
        dorm = prev || eligible[0];
        classDorm.set(key, dorm.id);
      }
      const bed = free.get(dorm.id)!.shift()!;
      rows.push({ studentId: s.id, dormId: dorm.id, bed });
    });
    return { rows, unplaced };
  }, [data, strategy]);

  const run = async () => {
    if (!plan.rows.length) return;
    setRunning(true);
    let ok = 0;
    for (let i = 0; i < plan.rows.length; i += 50) {
      const chunk = plan.rows.slice(i, i + 50).map((r) => ({
        student_id: r.studentId,
        dormitory_id: r.dormId,
        bed_id: r.bed.id,
        academic_year: data.selectedYear,
        assigned_by: data.userName,
        notes: 'Auto allocation',
      }));
      const res = await insert('dorm_assignments', chunk);
      if (res.success) ok += chunk.length;
      else toast.error(res.error || 'Some allocations failed');
    }
    setRunning(false);
    toast.success(`${ok} students allocated`);
    data.reload();
  };

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 flex flex-col sm:flex-row gap-4 sm:items-end">
        <div className="space-y-2">
          <Label>Allocation strategy</Label>
          <Select value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fill">Fill one dormitory first</SelectItem>
              <SelectItem value="even">Distribute evenly</SelectItem>
              <SelectItem value="class">Distribute by class</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={run} disabled={!data.canManage || running || !plan.rows.length}>
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          Auto Allocate {plan.rows.length} students
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Only boarding students without a bed are included. Gender and section always match; beds under maintenance,
        reserved or out of service are skipped.
        {plan.unplaced.length > 0 && (
          <span className="text-destructive"> {plan.unplaced.length} students have no eligible free space — add them to the Waiting List.</span>
        )}
      </p>
      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3">Student</th>
              <th className="text-left p-3">Class</th>
              <th className="text-left p-3">Dormitory</th>
              <th className="text-left p-3">Bed space</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => {
              const s = data.studentById.get(r.studentId);
              return (
                <tr key={r.studentId} className="border-t border-border">
                  <td className="p-3">{s?.full_name}</td>
                  <td className="p-3 text-muted-foreground">{s?.class} {s?.stream || ''}</td>
                  <td className="p-3">{data.dormById.get(r.dormId)?.name}</td>
                  <td className="p-3">{bedLabel(r.bed)}</td>
                </tr>
              );
            })}
            {plan.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  Nothing to allocate — every boarding student already has a bed or no space is free.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
