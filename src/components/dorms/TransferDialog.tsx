import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSecureData } from '@/hooks/useSecureData';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { DormBedPicker } from './DormBedPicker';
import { DormData } from './dormContext';
import { DormAssignment, bedLabel } from '@/types/dorm';

export function TransferDialog({
  data,
  assignment,
  onClose,
}: {
  data: DormData;
  assignment: DormAssignment | null;
  onClose: () => void;
}) {
  const { update } = useSecureData();
  const [dormId, setDormId] = useState('');
  const [bedId, setBedId] = useState('');
  const [reason, setReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDormId('');
    setBedId('');
    setReason('');
    setApprovedBy(data.userName);
  }, [assignment, data.userName]);

  if (!assignment) return null;
  const student = data.studentById.get(assignment.student_id);
  const current = data.bedById.get(assignment.bed_id);

  const save = async () => {
    if (!bedId) return toast.error('Choose the new bed');
    if (bedId === assignment.bed_id) return toast.error('Choose a different bed');
    if (!reason.trim()) return toast.error('Enter the reason for transfer');
    setSaving(true);
    const res = await update(
      'dorm_assignments',
      {
        dormitory_id: dormId,
        bed_id: bedId,
        notes: `${reason.trim()}${approvedBy.trim() ? ` (approved by ${approvedBy.trim()})` : ''}`,
        assigned_by: data.userName,
      },
      { id: assignment.id },
    );
    setSaving(false);
    if (!res.success) return toast.error(res.error || 'Transfer failed');
    toast.success('Student transferred — old bed is now free');
    onClose();
    data.reload();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transfer {student?.full_name}</DialogTitle>
          <DialogDescription>
            Current: {data.dormById.get(assignment.dormitory_id)?.name} • Room {current?.room_number} • {bedLabel(current)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DormBedPicker
            gender={student?.gender}
            studentClass={student?.class}
            academicYear={data.selectedYear}
            dormitoryId={dormId}
            bedId={bedId}
            onChange={(d, b) => {
              setDormId(d);
              setBedId(b);
            }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reason for transfer</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Approved by</Label>
              <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
