import { useEffect, useMemo, useState } from 'react';
import { BedDouble, Check, DoorOpen, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSecureData } from '@/hooks/useSecureData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DormData } from './dormContext';
import {
  BED_STATUS_LABEL,
  BedStatus,
  DormBed,
  POSITION_LABEL,
  isBoarding,
  isEligible,
} from '@/types/dorm';

type DisplayStatus = BedStatus | 'occupied';

const SPACE_STYLE: Record<DisplayStatus, string> = {
  available: 'border-success/50 bg-success/10 text-success hover:bg-success/20',
  occupied: 'border-primary/60 bg-primary/15 text-primary hover:bg-primary/25',
  reserved: 'border-warning/60 bg-warning/15 text-warning hover:bg-warning/25',
  maintenance: 'border-destructive/60 bg-destructive/15 text-destructive hover:bg-destructive/25',
  out_of_service: 'border-muted-foreground/35 bg-muted text-muted-foreground hover:bg-muted',
};

const LEGEND_DOT: Record<DisplayStatus, string> = {
  available: 'bg-success',
  occupied: 'bg-primary',
  reserved: 'bg-warning',
  maintenance: 'bg-destructive',
  out_of_service: 'bg-muted-foreground',
};

function BedSpace({
  bed,
  data,
  selected,
  onSelect,
  compact = false,
}: {
  bed: DormBed;
  data: DormData;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const assignment = data.assignmentByBed.get(bed.id);
  const student = assignment ? data.studentById.get(assignment.student_id) : undefined;
  const status: DisplayStatus = assignment ? 'occupied' : bed.status || 'available';
  const position = POSITION_LABEL[bed.bed_position || 'single'];

  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      aria-label={`${bed.bed_code || `Bed ${bed.bed_number}`}, ${position}, ${BED_STATUS_LABEL[status]}${student ? `, ${student.full_name}` : ''}`}
      onClick={onSelect}
      className={cn(
        'relative w-full min-w-0 flex-col items-stretch justify-between gap-1 overflow-hidden border px-2 text-left whitespace-normal transition-transform duration-200 motion-safe:hover:-translate-y-0.5',
        compact ? 'h-[52px] py-1' : 'h-[76px] py-2',
        SPACE_STYLE[status],
        selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
      )}
    >
      <span className="flex w-full items-center justify-between gap-1 text-[10px] font-semibold uppercase">
        <span>{position}</span>
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="w-full truncate text-xs font-semibold text-foreground">
        {student?.full_name || BED_STATUS_LABEL[status]}
      </span>
    </Button>
  );
}

function BunkUnit({
  bunkNumber,
  beds,
  data,
  selectedBedId,
  onSelect,
  compact = false,
}: {
  bunkNumber: number;
  beds: DormBed[];
  data: DormData;
  selectedBedId: string;
  onSelect: (bed: DormBed) => void;
  compact?: boolean;
}) {
  const ordered = [...beds].sort((a, b) => {
    const rank = { upper: 0, single: 0, lower: 1 };
    return rank[a.bed_position || 'single'] - rank[b.bed_position || 'single'];
  });

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className={cn('flex items-center justify-between border-b border-border bg-muted/60 px-2', compact ? 'h-6' : 'h-8')}>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
          B{String(bunkNumber).padStart(2, '0')}
        </span>
        <span className="text-[10px] text-muted-foreground">{ordered.length > 1 ? 'Bunk bed' : 'Single bed'}</span>
      </div>
      <div className="grid gap-1 p-1.5">
        {ordered.map((bed) => (
          <BedSpace
            key={bed.id}
            bed={bed}
            data={data}
            selected={selectedBedId === bed.id}
            onSelect={() => onSelect(bed)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

function HorizontalBunk({
  bunkNumber,
  beds,
  data,
  selectedBedId,
  onSelect,
}: {
  bunkNumber: number;
  beds: DormBed[];
  data: DormData;
  selectedBedId: string;
  onSelect: (bed: DormBed) => void;
}) {
  const ordered = [...beds].sort((a, b) => {
    const rank = { upper: 0, single: 0, lower: 1 };
    return rank[a.bed_position || 'single'] - rank[b.bed_position || 'single'];
  });

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex h-6 items-center justify-between border-b border-border bg-muted/60 px-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
          B{String(bunkNumber).padStart(2, '0')}
        </span>
        <span className="text-[10px] text-muted-foreground">{ordered.length > 1 ? 'Bunk bed' : 'Single bed'}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 p-1.5">
        {ordered.map((bed) => (
          <BedSpace
            key={bed.id}
            bed={bed}
            data={data}
            selected={selectedBedId === bed.id}
            onSelect={() => onSelect(bed)}
            compact
          />
        ))}
      </div>
    </div>
  );
}

function PartitionedRoomMap({
  bunks,
  data,
  selectedBedId,
  onSelect,
}: {
  bunks: [number, DormBed[]][];
  data: DormData;
  selectedBedId: string;
  onSelect: (bed: DormBed) => void;
}) {
  const firstHalf = bunks.slice(0, 3);
  const secondHalf = bunks.slice(3, 6);

  const renderHalf = (half: [number, DormBed[]][], second = false) => {
    const positions = second
      ? ['Half-wall side', 'Window side', 'Shared wall side']
      : ['Shared wall side', 'Window side', 'Half-wall side'];
    const windowBunk = half[1];
    const sideBunks = half.filter((_, index) => index !== 1);

    return (
      <section className="relative min-w-0 bg-card/40 p-3 pt-8">
        <div className="absolute inset-x-3 top-1 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>Window</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        {windowBunk && (
          <div className="absolute inset-x-3 top-7 z-10">
            <HorizontalBunk
              bunkNumber={windowBunk[0]}
              beds={windowBunk[1]}
              data={data}
              selectedBedId={selectedBedId}
              onSelect={onSelect}
            />
          </div>
        )}
        <div className="grid grid-cols-2 items-start gap-8 pt-[128px]">
          {sideBunks.map(([bunk, beds], index) => {
            const originalIndex = index === 0 ? 0 : 2;
            return (
              <div key={bunk} className="min-w-0 space-y-1.5">
                <p className="truncate text-center text-[10px] font-medium text-muted-foreground">
                  {positions[originalIndex]}
                </p>
                <BunkUnit
                  bunkNumber={bunk}
                  beds={beds}
                  data={data}
                  selectedBedId={selectedBedId}
                  onSelect={onSelect}
                  compact
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="min-w-[860px] overflow-hidden rounded-md border-2 border-border bg-muted/20">
      <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]">
        {renderHalf(firstHalf)}
        <div className="relative flex min-h-[280px] flex-col items-center justify-center border-x-4 border-border bg-muted/70">
          <span className="rounded-sm bg-background px-1 py-2 text-[10px] font-semibold uppercase text-muted-foreground [writing-mode:vertical-rl] rotate-180">
            Half wall
          </span>
          <span className="absolute bottom-0 h-14 w-full border-t-2 border-dashed border-border bg-card" aria-label="Passage through half wall" />
        </div>
        {renderHalf(secondHalf, true)}
      </div>
      <div className="flex h-12 items-center border-t-2 border-border bg-card px-4">
        <div className="flex w-28 items-center justify-center gap-1 rounded-t-md border-x-2 border-t-2 border-border bg-background py-2 text-[10px] font-semibold uppercase text-muted-foreground">
          <DoorOpen className="h-3.5 w-3.5" /> Entrance
        </div>
        <p className="ml-4 text-xs text-muted-foreground">First half after entrance</p>
        <p className="ml-auto text-xs text-muted-foreground">Second half</p>
      </div>
    </div>
  );
}

export function RoomsTab({ data }: { data: DormData }) {
  const { insert, update } = useSecureData();
  const [dormId, setDormId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dormId && data.dorms[0]) setDormId(data.dorms[0].id);
  }, [data.dorms, dormId]);

  const selectedDorm = data.dormById.get(dormId);

  const rooms = useMemo(() => {
    const map = new Map<number, DormBed[]>();
    data.beds
      .filter((bed) => bed.dormitory_id === dormId)
      .forEach((bed) => {
        const room = bed.room_number || 0;
        map.set(room, [...(map.get(room) || []), bed]);
      });
    return [...map.entries()]
      .map(([number, beds]) => ({
        number,
        beds,
        occupied: beds.filter((bed) => data.assignmentByBed.has(bed.id)).length,
        available: beds.filter(
          (bed) => !data.assignmentByBed.has(bed.id) && (bed.status || 'available') === 'available',
        ).length,
      }))
      .sort((a, b) => a.number - b.number);
  }, [data.assignmentByBed, data.beds, dormId]);

  useEffect(() => {
    if (!rooms.length) {
      setRoomNumber('');
      return;
    }
    if (!rooms.some((room) => String(room.number) === roomNumber)) setRoomNumber(String(rooms[0].number));
  }, [rooms, roomNumber]);

  useEffect(() => {
    setSelectedBedId('');
    setStudentId('');
  }, [dormId, roomNumber]);

  const selectedRoom = rooms.find((room) => String(room.number) === roomNumber);
  const selectedBed = selectedRoom?.beds.find((bed) => bed.id === selectedBedId);
  const selectedAssignment = selectedBed ? data.assignmentByBed.get(selectedBed.id) : undefined;
  const selectedStudent = selectedAssignment ? data.studentById.get(selectedAssignment.student_id) : undefined;
  const selectedStatus: DisplayStatus = selectedAssignment ? 'occupied' : selectedBed?.status || 'available';

  const bunks = useMemo(() => {
    const map = new Map<number, DormBed[]>();
    (selectedRoom?.beds || [])
      .sort((a, b) => a.bed_number - b.bed_number)
      .forEach((bed) => {
        const bunk = bed.bunk_number || bed.bed_number;
        map.set(bunk, [...(map.get(bunk) || []), bed]);
      });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [selectedRoom]);

  const leftBunks = bunks.filter((_, index) => index % 2 === 0);
  const rightBunks = bunks.filter((_, index) => index % 2 === 1);
  const assignedStudentIds = useMemo(
    () => new Set(data.assignments.map((assignment) => assignment.student_id)),
    [data.assignments],
  );

  const eligibleStudents = useMemo(
    () =>
      data.students
        .filter((student) => !assignedStudentIds.has(student.id))
        .filter((student) => isBoarding(student))
        .filter((student) => (selectedDorm ? isEligible(student, selectedDorm) : false))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [assignedStudentIds, data.students, selectedDorm],
  );

  const setStatus = async (status: BedStatus) => {
    if (!selectedBed) return;
    setSaving(true);
    const result = await update('dorm_beds', { status }, { id: selectedBed.id });
    setSaving(false);
    if (!result.success) return toast.error(result.error || 'Failed to update bed');
    toast.success('Bed status updated');
    data.reload();
  };

  const assignStudent = async () => {
    if (!selectedBed || !studentId || selectedStatus !== 'available') return;
    setSaving(true);
    const result = await insert('dorm_assignments', {
      student_id: studentId,
      dormitory_id: dormId,
      bed_id: selectedBed.id,
      academic_year: data.selectedYear,
      assigned_by: data.userName || null,
      notes: 'Assigned from room map',
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error || 'Failed to assign bed');
    toast.success('Student assigned to the selected bed space');
    setStudentId('');
    setSelectedBedId('');
    data.reload();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Dormitory</Label>
          <Select value={dormId} onValueChange={setDormId}>
            <SelectTrigger><SelectValue placeholder="Select dormitory" /></SelectTrigger>
            <SelectContent>
              {data.dorms.map((dorm) => <SelectItem key={dorm.id} value={dorm.id}>{dorm.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Room</Label>
          <Select value={roomNumber} onValueChange={setRoomNumber} disabled={!rooms.length}>
            <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.number} value={String(room.number)}>
                  Room {String(room.number).padStart(2, '0')} — {room.available} spaces available
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3">
        {(Object.keys(LEGEND_DOT) as DisplayStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('h-2.5 w-2.5 rounded-full', LEGEND_DOT[status])} />
            {BED_STATUS_LABEL[status]}
          </span>
        ))}
      </div>

      {selectedRoom ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 overflow-x-auto pb-2">
            <div className="min-w-[560px] rounded-md border border-border bg-muted/20 p-3 sm:p-5">
              <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-semibold">Room {String(selectedRoom.number).padStart(2, '0')} layout</h3>
                  <p className="text-xs text-muted-foreground">Select a bed space to view or allocate it</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{selectedRoom.occupied}/{selectedRoom.beds.length} occupied</p>
                  <p>{selectedRoom.available} available</p>
                </div>
              </div>

              {bunks.length >= 2 ? (
                <PartitionedRoomMap
                  bunks={bunks}
                  data={data}
                  selectedBedId={selectedBedId}
                  onSelect={(bed) => setSelectedBedId(bed.id)}
                />
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] gap-3 sm:gap-5">
                  <div className="grid content-start gap-3">
                    {leftBunks.map(([bunk, beds]) => (
                      <BunkUnit key={bunk} bunkNumber={bunk} beds={beds} data={data} selectedBedId={selectedBedId} onSelect={(bed) => setSelectedBedId(bed.id)} />
                    ))}
                  </div>
                  <div className="flex min-h-[280px] flex-col items-center">
                    <div className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background py-2 text-[10px] font-semibold uppercase text-muted-foreground">
                      <DoorOpen className="h-3.5 w-3.5" /> Door
                    </div>
                    <div className="my-2 h-full w-px flex-1 border-l border-dashed border-border" />
                    <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase text-muted-foreground">Central aisle</span>
                    <div className="my-2 h-full w-px flex-1 border-l border-dashed border-border" />
                  </div>
                  <div className="grid content-start gap-3">
                    {rightBunks.map(([bunk, beds]) => (
                      <BunkUnit key={bunk} bunkNumber={bunk} beds={beds} data={data} selectedBedId={selectedBedId} onSelect={(bed) => setSelectedBedId(bed.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="min-h-[300px] border-l-0 border-border xl:border-l xl:pl-5">
            {selectedBed ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Selected space</p>
                    <h3 className="mt-1 text-lg font-semibold">{selectedBed.bed_code || `Bed ${selectedBed.bed_number}`}</h3>
                    <p className="text-sm text-muted-foreground">B{String(selectedBed.bunk_number || selectedBed.bed_number).padStart(2, '0')} • {POSITION_LABEL[selectedBed.bed_position || 'single']}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Close selected bed" onClick={() => setSelectedBedId('')}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className={cn('rounded-md border px-3 py-2 text-sm font-semibold', SPACE_STYLE[selectedStatus])}>
                  {BED_STATUS_LABEL[selectedStatus]}
                </div>

                {selectedStudent && (
                  <div className="flex gap-3 border-y border-border py-4">
                    <UserRound className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold">{selectedStudent.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedStudent.roll_number}</p>
                      <p className="text-sm text-muted-foreground">{selectedStudent.class}{selectedStudent.stream ? ` ${selectedStudent.stream}` : ''}</p>
                    </div>
                  </div>
                )}

                {data.canManage && !selectedAssignment && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Bed status</Label>
                      <Select value={selectedBed.status || 'available'} onValueChange={(value) => setStatus(value as BedStatus)} disabled={saving}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(['available', 'reserved', 'maintenance', 'out_of_service'] as BedStatus[]).map((status) => (
                            <SelectItem key={status} value={status}>{BED_STATUS_LABEL[status]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedStatus === 'available' && (
                      <div className="space-y-3 border-t border-border pt-4">
                        <div className="space-y-2">
                          <Label>Assign boarding student</Label>
                          <Select value={studentId} onValueChange={setStudentId}>
                            <SelectTrigger><SelectValue placeholder="Select eligible student" /></SelectTrigger>
                            <SelectContent>
                              {eligibleStudents.map((student) => (
                                <SelectItem key={student.id} value={student.id}>
                                  {student.full_name} — {student.class}{student.stream ? ` ${student.stream}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!eligibleStudents.length && <p className="text-xs text-muted-foreground">No eligible unallocated boarding students.</p>}
                        </div>
                        <Button type="button" className="w-full" disabled={!studentId || saving} onClick={assignStudent}>
                          <BedDouble className="h-4 w-4" /> Assign this space
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center border-y border-dashed border-border px-5 text-center">
                <BedDouble className="mb-3 h-8 w-8 text-muted-foreground" />
                <h3 className="font-semibold">Select a bed space</h3>
                <p className="mt-1 text-sm text-muted-foreground">Tap any Upper, Lower or Single space on the room map.</p>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">No rooms found in this dormitory.</div>
      )}
    </div>
  );
}