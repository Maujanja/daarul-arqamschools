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
  const [room, setRoom] = useState<string>('');

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

  const freeBedsByDorm = useMemo(() => {
    const map = new Map<string, number>();
    beds.forEach((b) => {
      if (takenBedIds.has(b.id)) return;
      map.set(b.dormitory_id, (map.get(b.dormitory_id) || 0) + 1);
    });
    return map;
  }, [beds, takenBedIds]);

  const dormBeds = useMemo(() => beds.filter((b) => b.dormitory_id === dormitoryId), [beds, dormitoryId]);

  const rooms = useMemo(() => {
    const map = new Map<number, { total: number; free: number }>();
    dormBeds.forEach((b) => {
      const r = b.room_number ?? 0;
      const entry = map.get(r) || { total: 0, free: 0 };
      entry.total += 1;
      if (!takenBedIds.has(b.id)) entry.free += 1;
      map.set(r, entry);
    });
    return Array.from(map.entries())
      .map(([room_number, v]) => ({ room_number, ...v }))
      .sort((a, b) => a.room_number - b.room_number);
  }, [dormBeds, takenBedIds]);

  // Keep the room selector in sync with the selected bed (e.g. when editing a student)
  useEffect(() => {
    if (!bedId) return;
    const selected = beds.find((b) => b.id === bedId);
    if (selected && selected.room_number != null) setRoom(String(selected.room_number));
  }, [bedId, beds]);

  const availableBeds = useMemo(
    () =>
      dormBeds
        .filter((b) => !takenBedIds.has(b.id))
        .filter((b) => (room ? String(b.room_number ?? 0) === room : true))
        .sort((a, b) => a.bed_number - b.bed_number),
    [dormBeds, takenBedIds, room],
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Dormitory</Label>
          <Select
            value={dormitoryId}
            onValueChange={(v) => {
              setRoom('');
              onChange(v, '');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select dormitory" />
            </SelectTrigger>
            <SelectContent>
              {visibleDorms.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} ({d.gender === 'male' ? 'Boys' : 'Girls'}) — {freeBedsByDorm.get(d.id) || 0} free
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Room</Label>
          <Select
            value={room}
            onValueChange={(v) => {
              setRoom(v);
              onChange(dormitoryId, '');
            }}
            disabled={!dormitoryId}
          >
            <SelectTrigger>
              <SelectValue placeholder={dormitoryId ? 'Select room' : 'Select dormitory first'} />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.room_number} value={String(r.room_number)} disabled={r.free === 0}>
                  Room {r.room_number} — {r.free}/{r.total} free
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Bed</Label>
          <Select value={bedId} onValueChange={(v) => onChange(dormitoryId, v)} disabled={!dormitoryId}>
            <SelectTrigger>
              <SelectValue placeholder={dormitoryId ? 'Select bed' : 'Select dormitory first'} />
            </SelectTrigger>
            <SelectContent>
              {availableBeds.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.bed_code || `Bed ${b.bed_number}`}
                  {b.room_number ? ` • Room ${b.room_number}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dormitoryId && availableBeds.length === 0 && (
            <p className="text-xs text-destructive">No free beds here. Choose another room or dormitory.</p>
          )}
        </div>
      </div>
    </div>
  );
}
