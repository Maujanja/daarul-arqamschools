import { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSecureData } from '@/hooks/useSecureData';
import { toast } from 'sonner';
import { DormData } from './dormContext';
import { BED_STATUS_LABEL, BedStatus, POSITION_LABEL } from '@/types/dorm';

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-primary/10 text-primary',
  occupied: 'bg-accent/20 text-accent-foreground',
  reserved: 'bg-warning/20 text-warning',
  maintenance: 'bg-destructive/15 text-destructive',
  out_of_service: 'bg-muted text-muted-foreground',
};

export function RoomsTab({ data }: { data: DormData }) {
  const { update } = useSecureData();
  const [dormId, setDormId] = useState('');

  useEffect(() => {
    if (!dormId && data.dorms[0]) setDormId(data.dorms[0].id);
  }, [data.dorms, dormId]);

  const rooms = useMemo(() => {
    const map = new Map<number, typeof data.beds>();
    data.beds
      .filter((b) => b.dormitory_id === dormId)
      .sort((a, b) => a.bed_number - b.bed_number)
      .forEach((b) => {
        const r = b.room_number || 0;
        map.set(r, [...(map.get(r) || []), b]);
      });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [data.beds, dormId]);

  const setStatus = async (bedId: string, status: BedStatus) => {
    const res = await update('dorm_beds', { status }, { id: bedId });
    if (!res.success) return toast.error(res.error || 'Failed to update bed');
    toast.success('Bed status updated');
    data.reload();
  };

  return (
    <div className="space-y-4">
      <Select value={dormId} onValueChange={setDormId}>
        <SelectTrigger className="w-full sm:w-[320px]">
          <SelectValue placeholder="Select dormitory" />
        </SelectTrigger>
        <SelectContent>
          {data.dorms.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rooms.map(([room, beds]) => {
          const occupied = beds.filter((b) => data.assignmentByBed.has(b.id)).length;
          return (
            <div key={room} className="card-elevated p-4">
              <div className="flex justify-between mb-2">
                <h3 className="font-semibold">Room {String(room).padStart(2, '0')}</h3>
                <span className="text-xs text-muted-foreground">
                  Capacity {beds.length} • {occupied} occupied • {beds.length - occupied} free
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left py-1">Bed</th>
                    <th className="text-left py-1">Position</th>
                    <th className="text-left py-1">Status</th>
                    <th className="text-left py-1">Student</th>
                  </tr>
                </thead>
                <tbody>
                  {beds.map((b) => {
                    const a = data.assignmentByBed.get(b.id);
                    const student = a ? data.studentById.get(a.student_id) : undefined;
                    const status = a ? 'occupied' : b.status || 'available';
                    return (
                      <tr key={b.id} className="border-t border-border">
                        <td className="py-1.5">B{String(b.bunk_number || b.bed_number).padStart(2, '0')}</td>
                        <td className="py-1.5">{POSITION_LABEL[b.bed_position || 'single']}</td>
                        <td className="py-1.5">
                          {data.canManage && !a ? (
                            <Select value={status} onValueChange={(v) => setStatus(b.id, v as BedStatus)}>
                              <SelectTrigger className={`h-7 text-xs w-[130px] ${STATUS_STYLE[status]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(['available', 'reserved', 'maintenance', 'out_of_service'] as BedStatus[]).map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {BED_STATUS_LABEL[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[status]}`}>
                              {BED_STATUS_LABEL[status as BedStatus]}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5">{student ? student.full_name : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
