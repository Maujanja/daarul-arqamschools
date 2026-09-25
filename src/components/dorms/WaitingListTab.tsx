import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSecureData } from '@/hooks/useSecureData';
import { toast } from 'sonner';
import { BellRing, Plus, Trash2 } from 'lucide-react';
import { DormData, bedIsFree } from './dormContext';
import { SECTION_LABEL, isBoarding, isEligible, sectionOfClass } from '@/types/dorm';

export function WaitingListTab({ data, onAllocate }: { data: DormData; onAllocate: (studentId: string) => void }) {
  const { insert, update, remove } = useSecureData();
  const [studentId, setStudentId] = useState('');
  const [priority, setPriority] = useState('3');
  const [reason, setReason] = useState('');

  const assigned = useMemo(() => new Set(data.assignments.map((a) => a.student_id)), [data.assignments]);
  const waiting = useMemo(
    () =>
      data.waiting
        .filter((w) => w.status === 'waiting')
        .sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at)),
    [data.waiting],
  );
  const onList = new Set(waiting.map((w) => w.student_id));
  const candidates = data.students.filter((s) => isBoarding(s) && !assigned.has(s.id) && !onList.has(s.id));

  const hasSpace = (sid: string) => {
    const s = data.studentById.get(sid);
    return data.dorms.some(
      (d) => isEligible(s, d) && data.beds.some((b) => b.dormitory_id === d.id && bedIsFree(data, b.id)),
    );
  };

  const add = async () => {
    if (!studentId) return toast.error('Select a student');
    const res = await insert('dorm_waiting_list', {
      student_id: studentId,
      academic_year: data.selectedYear,
      priority: Number(priority),
      reason: reason.trim() || null,
      added_by: data.userName,
    });
    if (!res.success) return toast.error(res.error || 'Failed to add');
    toast.success('Added to waiting list');
    setStudentId('');
    setReason('');
    data.reload();
  };

  return (
    <div className="space-y-4">
      {data.canManage && (
        <div className="card-elevated p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-2 sm:col-span-2">
            <Label>Student (boarding, no bed)</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name} • {s.class}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority (1 = highest)</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Dormitory full" />
          </div>
          <Button onClick={add} className="sm:col-span-4 sm:w-fit">
            <Plus className="w-4 h-4 mr-2" /> Add to waiting list
          </Button>
        </div>
      )}

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">Student</th>
              <th className="text-left p-3">Adm. No.</th>
              <th className="text-left p-3">Gender</th>
              <th className="text-left p-3">Class</th>
              <th className="text-left p-3">Section</th>
              <th className="text-left p-3">Parent</th>
              <th className="text-left p-3">Added</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Reason</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {waiting.map((w, i) => {
              const s = data.studentById.get(w.student_id);
              const space = hasSpace(w.student_id);
              return (
                <tr key={w.id} className="border-t border-border">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3 font-medium">
                    {s?.full_name || '-'}
                    {space && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-primary">
                        <BellRing className="w-3 h-3" /> Bed available
                      </span>
                    )}
                  </td>
                  <td className="p-3">{s?.roll_number}</td>
                  <td className="p-3 capitalize">{s?.gender}</td>
                  <td className="p-3">{s?.class}</td>
                  <td className="p-3">{SECTION_LABEL[sectionOfClass(s?.class)]}</td>
                  <td className="p-3">{s?.parent_name || s?.parent_phone || '-'}</td>
                  <td className="p-3">{new Date(w.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="p-3">{w.priority}</td>
                  <td className="p-3 text-muted-foreground">{w.reason || '-'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {data.canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!space}
                          onClick={async () => {
                            await update('dorm_waiting_list', { status: 'allocated' }, { id: w.id });
                            onAllocate(w.student_id);
                          }}
                        >
                          Allocate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await remove('dorm_waiting_list', { id: w.id });
                            data.reload();
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {waiting.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-muted-foreground">
                  The waiting list is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
