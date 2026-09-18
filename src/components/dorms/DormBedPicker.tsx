import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { Dormitory, DormBed, DormAssignment, normalizeGender } from '@/types/dorm';
import { Loader2 } from 'lucide-react';

interface DormBedPickerProps {
  gender?: string | null;
  academicYear: string;
  dormitoryId: string;
  bedId: string;
  /** Assignment of the student being edited, so their own bed stays selectable */
  currentBedId?: string | null;
  onChange: (dormitoryId: string, bedId: string) => void;
}

export function DormBedPicker({
  gender,
  academicYear,
  dormitoryId,
  bedId,
  currentBedId,
  onChange,
}: DormBedPickerProps) {
  const { fetchTable } = useSecureQuery();
  const [dorms, setDorms] = useState<Dormitory[]>([]);
  const [beds, setBeds] = useState<DormBed[]>([]);
  const [assignments, setAssignments] = useState<DormAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [dormRows, bedRows, assignmentRows] = await Promise.all([
        fetchTable<Dormitory>('dormitories', undefined, { orderBy: { column: 'name', ascending: true } }),
        fetchTable<DormBed>('dorm_beds', undefined, { orderBy: { column: 'bed_number', ascending: true } }),
        fetchTable<DormAssignment>('dorm_assignments', { academic_year: academicYear }),
      ]);
      if (!active) return;
      setDorms(dormRows);
      setBeds(bedRows);
      setAssignments(assignmentRows);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchTable, academicYear]);

  const studentGender = normalizeGender(gender);
  const visibleDorms = useMemo(
    () => (studentGender ? dorms.filter((d) => d.gender === studentGender) : dorms),
    [dorms, studentGender],
  );

  const takenBedIds = useMemo(() => {
    const taken = new Set(assignments.map((a) => a.bed_id));
    if (currentBedId) taken.delete(currentBedId);
    return taken;
  }, [assignments, currentBedId]);

  const availableBeds = useMemo(
    () =>
      beds
        .filter((b) => b.dormitory_id === dormitoryId && !takenBedIds.has(b.id))
        .sort((a, b) => a.bed_number - b.bed_number),
    [beds, dormitoryId, takenBedIds],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading dormitories...
      </div>
    );
  }

  if (dorms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No dormitories yet. Create dormitories on the Dormitories page first.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Dormitory</Label>
        <Select value={dormitoryId} onValueChange={(v) => onChange(v, '')}>
          <SelectTrigger>
            <SelectValue placeholder="Select dormitory" />
          </SelectTrigger>
          <SelectContent>
            {visibleDorms.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name} ({d.gender === 'male' ? 'Boys' : 'Girls'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Bed Number</Label>
        <Select value={bedId} onValueChange={(v) => onChange(dormitoryId, v)} disabled={!dormitoryId}>
          <SelectTrigger>
            <SelectValue placeholder={dormitoryId ? 'Select bed' : 'Select dormitory first'} />
          </SelectTrigger>
          <SelectContent>
            {availableBeds.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                Bed {b.bed_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dormitoryId && availableBeds.length === 0 && (
          <p className="text-xs text-destructive">All beds in this dormitory are taken.</p>
        )}
      </div>
    </div>
  );
}
