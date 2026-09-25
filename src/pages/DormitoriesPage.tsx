import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DormBedPicker } from '@/components/dorms/DormBedPicker';
import { Dormitory, DormBed, DormAssignment, DormHistory, DormWaiting, normalizeGender, sectionOfClass, SECTION_LABEL, POSITION_LABEL, NO_SPACE_MESSAGE } from '@/types/dorm';
import { DormData } from '@/components/dorms/dormContext';
import { DormDashboardTab } from '@/components/dorms/DormDashboardTab';
import { RoomsTab } from '@/components/dorms/RoomsTab';
import { AutoAllocateTab } from '@/components/dorms/AutoAllocateTab';
import { WaitingListTab } from '@/components/dorms/WaitingListTab';
import { NewYearTab } from '@/components/dorms/NewYearTab';
import { ReportsTab } from '@/components/dorms/ReportsTab';
import { TransferDialog } from '@/components/dorms/TransferDialog';
import { toast } from 'sonner';
import { ArrowRightLeft, BedDouble, Download, Eye, Loader2, Plus, Trash2, Upload, Search, Pencil } from 'lucide-react';

interface StudentRow {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
  stream: string | null;
  gender: string | null;
  boarding_type: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
}

const emptyDormForm = { id: '', name: '', code: '', section: 'primary', gender: 'male', rooms: '8', bedsPerRoom: '6', bedType: 'double', partitions: false, active: true, notes: '' };

export default function DormitoriesPage() {
  const { user } = useAuth();
  const { fetchTable } = useSecureQuery();
  const { insert, update, remove } = useSecureData();
  const { academicYears, currentYear } = useAcademicYears();

  const role = user?.role || '';
  const canManage = role === 'admin' || role === 'secretary';
  const canView = canManage || role === 'accountant' || role.startsWith('head_');
  const isAdmin = role === 'admin';

  const [selectedYear, setSelectedYear] = useState('');
  const [dorms, setDorms] = useState<Dormitory[]>([]);
  const [beds, setBeds] = useState<DormBed[]>([]);
  const [assignments, setAssignments] = useState<DormAssignment[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dormForm, setDormForm] = useState(emptyDormForm);
  const [showDormDialog, setShowDormDialog] = useState(false);

  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignDormId, setAssignDormId] = useState('');
  const [assignBedId, setAssignBedId] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  const [search, setSearch] = useState('');
  const [dormFilter, setDormFilter] = useState('all');
  const [viewDorm, setViewDorm] = useState<Dormitory | null>(null);
  const [history, setHistory] = useState<DormHistory[]>([]);
  const [waiting, setWaiting] = useState<DormWaiting[]>([]);
  const [genderFilter, setGenderFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [transferAssignment, setTransferAssignment] = useState<DormAssignment | null>(null);
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    if (!selectedYear && currentYear) setSelectedYear(currentYear);
  }, [currentYear, selectedYear]);

  const loadData = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    const [dormRows, bedRows, assignmentRows, studentRows, historyRows, waitingRows] = await Promise.all([
      fetchTable<Dormitory>('dormitories', undefined, { orderBy: { column: 'name', ascending: true } }),
      fetchTable<DormBed>('dorm_beds'),
      fetchTable<DormAssignment>('dorm_assignments', { academic_year: selectedYear }),
      fetchTable<StudentRow>('students', undefined, { orderBy: { column: 'full_name', ascending: true } }),
      fetchTable<DormHistory>('dorm_allocation_history', undefined, { orderBy: { column: 'created_at', ascending: false }, limit: 1000 }),
      fetchTable<DormWaiting>('dorm_waiting_list', { academic_year: selectedYear }),
    ]);
    setHistory(historyRows);
    setWaiting(waitingRows);
    setDorms(dormRows);
    setBeds(bedRows);
    setAssignments(assignmentRows);
    setStudents(studentRows);
    setLoading(false);
  }, [fetchTable, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const bedById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const dormById = useMemo(() => new Map(dorms.map((d) => [d.id, d])), [dorms]);

  const occupancy = useMemo(() => {
    const counts = new Map<string, number>();
    assignments.forEach((a) => counts.set(a.dormitory_id, (counts.get(a.dormitory_id) || 0) + 1));
    return counts;
  }, [assignments]);

  const boardingStudents = useMemo(
    () => students.filter((s) => (s.boarding_type || 'day') === 'boarding'),
    [students],
  );

  const assignedStudentIds = useMemo(() => new Set(assignments.map((a) => a.student_id)), [assignments]);

  const unassignedBoarders = useMemo(
    () => boardingStudents.filter((s) => !assignedStudentIds.has(s.id)),
    [boardingStudents, assignedStudentIds],
  );

  const assignmentRows = useMemo(() => {
    const rows = assignments.map((a) => {
      const student = studentById.get(a.student_id);
      const bed = bedById.get(a.bed_id);
      const dorm = dormById.get(a.dormitory_id);
      return {
        assignment: a,
        name: student?.full_name || 'Unknown student',
        roll: student?.roll_number || '-',
        class: student ? `${student.class}${student.stream ? ` ${student.stream}` : ''}` : '-',
        gender: student?.gender || '-',
        dorm: dorm?.name || '-',
        bed: bed?.bed_number ?? 0,
        bedLabel: bed?.bed_code || (bed ? `Bed ${bed.bed_number}` : '-'),
        room: bed?.room_number ?? null,
        position: bed?.bed_position || 'single',
        allocated: a.allocated_at || '',
        sgender: normalizeGender(student?.gender),
        section: sectionOfClass(student?.class),
      };
    });
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => (dormFilter === 'all' ? true : r.assignment.dormitory_id === dormFilter))
      .filter((r) => (genderFilter === 'all' ? true : r.sgender === genderFilter))
      .filter((r) => (sectionFilter === 'all' ? true : r.section === sectionFilter))
      .filter((r) =>
        term
          ? r.name.toLowerCase().includes(term) ||
            r.roll.toLowerCase().includes(term) ||
            r.dorm.toLowerCase().includes(term) ||
            r.class.toLowerCase().includes(term) ||
            r.bedLabel.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => a.dorm.localeCompare(b.dorm) || Number(a.bed) - Number(b.bed));
  }, [assignments, studentById, bedById, dormById, search, dormFilter, genderFilter, sectionFilter]);

  const viewDormRows = useMemo(() => {
    if (!viewDorm) return [];
    return assignments
      .filter((a) => a.dormitory_id === viewDorm.id)
      .map((a) => {
        const student = studentById.get(a.student_id);
        const bed = bedById.get(a.bed_id);
        return {
          id: a.id,
          name: student?.full_name || 'Unknown student',
          roll: student?.roll_number || '-',
          cls: student ? `${student.class}${student.stream ? ` ${student.stream}` : ''}` : '-',
          bed: bed?.bed_number ?? 0,
          bedLabel: bed?.bed_code || (bed ? `Bed ${bed.bed_number}` : '-'),
          room: bed?.room_number ?? null,
        };
      })
      .sort((a, b) => a.bed - b.bed);
  }, [viewDorm, assignments, studentById, bedById]);

  /* ---------------- dormitory CRUD ---------------- */

  const openDormDialog = (dorm?: Dormitory) => {
    setDormForm(
      dorm
        ? {
            id: dorm.id,
            name: dorm.name,
            code: dorm.code || '',
            section: dorm.section || 'primary',
            gender: dorm.gender,
            rooms: String(dorm.room_count || 1),
            bedsPerRoom: String(dorm.beds_per_room || 1),
            bedType: dorm.bed_type || 'double',
            partitions: !!dorm.partitions_enabled,
            active: dorm.is_active !== false,
            notes: dorm.notes || '',
          }
        : emptyDormForm,
    );
    setShowDormDialog(true);
  };

  const saveDorm = async () => {
    const rooms = Number(dormForm.rooms);
    const bedsPerRoom = Number(dormForm.bedsPerRoom);
    const capacity = rooms * bedsPerRoom * (dormForm.bedType === 'double' ? 2 : 1);
    if (!dormForm.name.trim()) {
      toast.error('Enter the dormitory name');
      return;
    }
    if (!Number.isFinite(rooms) || rooms < 1 || rooms > 100) {
      toast.error('Rooms must be between 1 and 100');
      return;
    }
    if (!Number.isFinite(bedsPerRoom) || bedsPerRoom < 1 || bedsPerRoom > 50) {
      toast.error('Beds per room must be between 1 and 50');
      return;
    }
    if (capacity > 2000) {
      toast.error('Total bed spaces cannot exceed 2000');
      return;
    }
    setSaving(true);
    const payload = {
      name: dormForm.name.trim(),
      section: dormForm.section,
      gender: dormForm.gender,
      room_count: rooms,
      beds_per_room: bedsPerRoom,
      bed_type: dormForm.bedType,
      code: dormForm.code.trim().toUpperCase() || null,
      partitions_enabled: dormForm.partitions,
      is_active: dormForm.active,
      capacity,
      notes: dormForm.notes.trim() || null,
    };
    const result = dormForm.id
      ? await update('dormitories', payload, { id: dormForm.id })
      : await insert('dormitories', payload);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error || 'Failed to save dormitory');
      return;
    }
    toast.success(dormForm.id ? 'Dormitory updated' : 'Dormitory created with its beds');
    setShowDormDialog(false);
    loadData();
  };

  const deleteDorm = async (dorm: Dormitory) => {
    if ((occupancy.get(dorm.id) || 0) > 0) {
      toast.error('Move the students out of this dormitory before deleting it');
      return;
    }
    const result = await remove('dormitories', { id: dorm.id });
    if (!result.success) {
      toast.error(result.error || 'Failed to delete dormitory');
      return;
    }
    toast.success('Dormitory deleted');
    loadData();
  };

  /* ---------------- assignments ---------------- */

  const saveAssignment = async () => {
    if (!assignStudentId || !assignDormId || !assignBedId) {
      toast.error('Select the student, dormitory and bed');
      return;
    }
    setSaving(true);
    const existing = assignments.find((a) => a.student_id === assignStudentId);
    const payload = {
      student_id: assignStudentId,
      dormitory_id: assignDormId,
      bed_id: assignBedId,
      academic_year: selectedYear,
      assigned_by: user?.name || null,
      notes: existing ? 'Changed from allocation screen' : null,
    };
    const result = existing
      ? await update('dorm_assignments', payload, { id: existing.id })
      : await insert('dorm_assignments', payload);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error || 'Failed to save bed assignment');
      return;
    }
    toast.success('Bed assigned');
    const w = waiting.find((x) => x.student_id === assignStudentId && x.status === 'waiting');
    if (w) await update('dorm_waiting_list', { status: 'allocated' }, { id: w.id });
    setShowAssignDialog(false);
    setAssignStudentId('');
    setAssignDormId('');
    setAssignBedId('');
    loadData();
  };

  const unassign = async (assignment: DormAssignment) => {
    const result = await remove('dorm_assignments', { id: assignment.id });
    if (!result.success) {
      toast.error(result.error || 'Failed to remove assignment');
      return;
    }
    toast.success('Assignment removed');
    loadData();
  };

  /* ---------------- excel ---------------- */


  const exportExcel = () => {
    const rows = assignments
      .map((a) => {
        const student = studentById.get(a.student_id);
        const bed = bedById.get(a.bed_id);
        return {
          'STUDENT NAME': student?.full_name || '',
          'ROLL NUMBER': student?.roll_number || '',
          CLASS: student?.class || '',
          STREAM: student?.stream || '',
          SEX: (student?.gender || '').toUpperCase().slice(0, 1),
          'DORMITORY NAME': dormById.get(a.dormitory_id)?.name || '',
          'ROOM NUMBER': bed?.room_number ?? '',
          'BED NUMBER': bed?.bed_code || bed?.bed_number || '',
          'ACADEMIC YEAR': a.academic_year,
        };
      })
      .sort(
        (a, b) =>
          a['DORMITORY NAME'].localeCompare(b['DORMITORY NAME']) ||
          String(a['BED NUMBER']).localeCompare(String(b['BED NUMBER'])),
      );

    const summary = dorms.map((d) => ({
      Dormitory: d.name,
      Gender: d.gender === 'male' ? 'Boys' : 'Girls',
      Beds: d.capacity,
      Occupied: occupancy.get(d.id) || 0,
      Free: d.capacity - (occupancy.get(d.id) || 0),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Assignments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Dormitories');
    XLSX.writeFile(wb, `dormitories-${selectedYear}.xlsx`);
  };

  const downloadTemplate = () => {
    const rows = [
      {
        'S/N': '001',
        SEX: 'M',
        'FIRST NAME': 'AKBAR',
        'MIDDLE NAME': 'OTHMAN',
        'SUR NAME': 'JUMA',
        'DORMITORY NAME': "LOWER BOY'S APPARTMENT",
        'ROOM NUMBER': 1,
        'BED NUMBER': 'DAS/PR/BOYS/001',
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Dormitory');
    XLSX.writeFile(wb, 'dormitory-template.xlsx');
  };

  const pick = (row: Record<string, unknown>, keys: string[]): string => {
    for (const key of Object.keys(row)) {
      const k = key.trim().toLowerCase();
      if (keys.some((needle) => k.includes(needle))) {
        const value = row[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
      }
    }
    return '';
  };

  const normName = (value: string) => value.replace(/[^a-z ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  const dormGenderFromName = (name: string): 'male' | 'female' | null => {
    const n = name.toLowerCase();
    if (/(girl|female|wasichana|ladies|women)/.test(n)) return 'female';
    if (/(boy|male|wavulana|men|gents)/.test(n)) return 'male';
    return null;
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      if (rows.length === 0) {
        toast.error('The file has no rows');
        return;
      }

      const byRoll = new Map(students.map((s) => [s.roll_number.trim().toLowerCase(), s]));
      const byFullName = new Map<string, StudentRow>();
      const byShortName = new Map<string, StudentRow>();
      students.forEach((s) => {
        const parts = normName(s.full_name).split(' ').filter(Boolean);
        byFullName.set(parts.join(' '), s);
        if (parts.length >= 2) byShortName.set(`${parts[0]} ${parts[parts.length - 1]}`, s);
      });

      type Parsed = {
        student: StudentRow;
        dormName: string;
        bedNumber: number;
        bedCode: string;
        roomNumber: number | null;
        gender: 'male' | 'female';
      };
      const dormNeeds = new Map<string, { gender: 'male' | 'female'; maxBed: number; display: string }>();
      const parsed: Parsed[] = [];
      const skipped: string[] = [];

      for (const row of rows) {
        const roll = pick(row, ['roll', 'namba ya usajili']);
        const first = pick(row, ['first name', 'jina la kwanza']);
        const middle = pick(row, ['middle name', 'jina la kati']);
        const sur = pick(row, ['sur name', 'surname', 'last name', 'jina la ukoo']);
        const single = pick(row, ['student name', 'full name', 'jina kamili']);
        const composed = single || [first, middle, sur].filter(Boolean).join(' ');
        const dormName = pick(row, ['dorm', 'bweni', 'hostel']);
        const bedCode = pick(row, ['bed', 'kitanda']);
        const roomRaw = pick(row, ['room', 'chumba']);
        const sexRaw = pick(row, ['sex', 'gender', 'jinsia']);
        const bedDigits = String(bedCode).match(/(\d+)\s*$/)?.[1] || String(bedCode).replace(/[^0-9]/g, '');
        const bedNumber = Number(bedDigits);
        const roomNumber = Number(String(roomRaw).replace(/[^0-9]/g, ''));

        const key = normName(composed);
        const parts = key.split(' ').filter(Boolean);
        const student =
          (roll && byRoll.get(roll.toLowerCase())) ||
          byFullName.get(key) ||
          (parts.length >= 2 ? byShortName.get(`${parts[0]} ${parts[parts.length - 1]}`) : undefined) ||
          null;

        if (!student) {
          skipped.push(`${composed || roll || '(blank row)'} — student not found`);
          continue;
        }
        if (!dormName || !Number.isFinite(bedNumber) || bedNumber < 1) {
          skipped.push(`${student.full_name} — dormitory or bed number missing`);
          continue;
        }

        const dormKey = dormName.trim().toLowerCase();
        const gender =
          dormGenderFromName(dormName) ||
          normalizeGender(sexRaw) ||
          normalizeGender(student.gender) ||
          'male';
        const studentGender = normalizeGender(student.gender);
        if (studentGender && studentGender !== gender) {
          skipped.push(`${student.full_name} — recorded as ${studentGender}, dormitory is for ${gender}`);
          continue;
        }

        const need = dormNeeds.get(dormKey);
        dormNeeds.set(dormKey, {
          gender: need?.gender || gender,
          maxBed: Math.max(need?.maxBed || 0, bedNumber),
          display: need?.display || dormName.trim(),
        });
        parsed.push({
          student,
          dormName: dormName.trim(),
          bedNumber,
          bedCode: String(bedCode).trim(),
          roomNumber: Number.isFinite(roomNumber) && roomNumber > 0 ? roomNumber : null,
          gender,
        });
      }

      if (parsed.length === 0) {
        toast.error('No matching students were found in the file');
        if (skipped.length) console.warn('Skipped rows:', skipped);
        return;
      }

      // Create missing dormitories / grow their bed count
      const dormByName = new Map(dorms.map((d) => [d.name.trim().toLowerCase(), d]));
      for (const [key, need] of dormNeeds) {
        const existing = dormByName.get(key);
        if (!existing) {
          const res = await insert('dormitories', {
            name: need.display,
            gender: need.gender,
            capacity: need.maxBed,
          });
          if (!res.success) throw new Error(res.error || `Failed to create dormitory ${need.display}`);
        } else if (existing.capacity < need.maxBed) {
          const res = await update('dormitories', { capacity: need.maxBed }, { id: existing.id });
          if (!res.success) throw new Error(res.error || `Failed to expand dormitory ${need.display}`);
        }
      }

      // Reload dormitories + beds so the new bed ids are known
      const [freshDorms, freshBeds] = await Promise.all([
        fetchTable<Dormitory>('dormitories'),
        fetchTable<DormBed>('dorm_beds'),
      ]);
      const freshDormByName = new Map(freshDorms.map((d) => [d.name.trim().toLowerCase(), d]));
      const bedLookup = new Map(freshBeds.map((b) => [`${b.dormitory_id}|${b.bed_number}`, b]));

      const existingByStudent = new Map(assignments.map((a) => [a.student_id, a]));
      const inserts: Record<string, unknown>[] = [];
      const updates: { id: string; payload: Record<string, unknown> }[] = [];
      const bedMeta: { id: string; payload: Record<string, unknown> }[] = [];

      for (const item of parsed) {
        const dorm = freshDormByName.get(item.dormName.toLowerCase());
        const bed = dorm ? bedLookup.get(`${dorm.id}|${item.bedNumber}`) : undefined;
        if (!dorm || !bed) {
          skipped.push(`${item.student.full_name} — bed ${item.bedNumber} not available`);
          continue;
        }
        if (bed.bed_code !== item.bedCode || (bed.room_number ?? null) !== item.roomNumber) {
          bedMeta.push({ id: bed.id, payload: { bed_code: item.bedCode, room_number: item.roomNumber } });
        }
        const payload = {
          student_id: item.student.id,
          dormitory_id: dorm.id,
          bed_id: bed.id,
          academic_year: selectedYear,
          assigned_by: user?.name || null,
        };
        const existing = existingByStudent.get(item.student.id);
        if (existing) updates.push({ id: existing.id, payload });
        else inserts.push(payload);
      }

      // Anyone listed in a dormitory file is a boarding student
      const toBoarding = [...new Set(
        parsed.filter((p) => (p.student.boarding_type || 'day') !== 'boarding').map((p) => p.student.id),
      )];
      for (const id of toBoarding) {
        await update('students', { boarding_type: 'boarding' }, { id });
      }

      for (const meta of bedMeta) {
        await update('dorm_beds', meta.payload, { id: meta.id });
      }

      let failed = 0;
      for (let i = 0; i < inserts.length; i += 50) {
        const chunk = inserts.slice(i, i + 50);
        const res = await insert('dorm_assignments', chunk);
        if (!res.success) {
          for (const single of chunk) {
            const one = await insert('dorm_assignments', single);
            if (!one.success) failed += 1;
          }
        }
      }
      for (const item of updates) {
        const res = await update('dorm_assignments', item.payload, { id: item.id });
        if (!res.success) failed += 1;
      }

      toast.success(
        `Imported ${inserts.length + updates.length - failed} students` +
          (failed ? `, ${failed} failed` : '') +
          (skipped.length ? `, ${skipped.length} skipped` : ''),
      );
      if (skipped.length) console.warn('Skipped rows:', skipped);
      loadData();
    } catch (error: unknown) {
      console.error('Dorm import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const dormData: DormData = {
    dorms, beds, assignments, students, history, waiting, selectedYear, canManage,
    userName: user?.name || '',
    reload: loadData,
    studentById, bedById, dormById,
    assignmentByBed: new Map(assignments.map((a) => [a.bed_id, a])),
  };

  const openAllocate = (studentId: string) => {
    setAssignStudentId(studentId);
    setAssignDormId('');
    setAssignBedId('');
    setShowAssignDialog(true);
  };

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="card-elevated p-8 text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="text-muted-foreground mt-2">You do not have access to dormitories.</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalBeds = dorms.reduce((sum, d) => sum + d.capacity, 0);
  const totalOccupied = assignments.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <BedDouble className="w-6 h-6 text-primary" /> Dormitories &amp; Beds
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {totalOccupied} of {totalBeds} beds occupied • {unassignedBoarders.length} boarding students without a bed
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Academic year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Template
            </Button>}
            <Button variant="outline" onClick={exportExcel} disabled={assignments.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="assignments">Allocation</TabsTrigger>
            {canManage && <TabsTrigger value="auto">Auto Allocate</TabsTrigger>}
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="waiting">Waiting List</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            {canManage && <TabsTrigger value="year">New Year</TabsTrigger>}
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="dorms">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DormDashboardTab data={dormData} /></TabsContent>
          <TabsContent value="auto"><AutoAllocateTab data={dormData} /></TabsContent>
          <TabsContent value="rooms"><RoomsTab data={dormData} /></TabsContent>
          <TabsContent value="waiting">
            <WaitingListTab data={dormData} onAllocate={(id) => { setTab('assignments'); openAllocate(id); }} />
          </TabsContent>
          <TabsContent value="year"><NewYearTab data={dormData} years={academicYears} /></TabsContent>
          <TabsContent value="reports"><ReportsTab data={dormData} /></TabsContent>
          <TabsContent value="history">
            <div className="card-elevated overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Student</th>
                    <th className="text-left p-3">Year</th>
                    <th className="text-left p-3">Action</th>
                    <th className="text-left p-3">From</th>
                    <th className="text-left p-3">To</th>
                    <th className="text-left p-3">Reason</th>
                    <th className="text-left p-3">By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="p-3 whitespace-nowrap">{new Date(h.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="p-3">{studentById.get(h.student_id)?.full_name || '-'}</td>
                      <td className="p-3">{h.academic_year}</td>
                      <td className="p-3 capitalize">{h.action}</td>
                      <td className="p-3 text-muted-foreground">{h.from_dormitory ? `${h.from_dormitory} • ${h.from_bed}` : '-'}</td>
                      <td className="p-3">{h.to_dormitory ? `${h.to_dormitory} • ${h.to_bed}` : '-'}</td>
                      <td className="p-3 text-muted-foreground">{h.reason || '-'}</td>
                      <td className="p-3 text-muted-foreground">{h.performed_by || '-'}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student, roll number or dormitory"
                  className="pl-9"
                />
              </div>
              <Select value={dormFilter} onValueChange={setDormFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dormitories</SelectItem>
                  {dorms.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genders</SelectItem>
                  <SelectItem value="male">Boys</SelectItem>
                  <SelectItem value="female">Girls</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Senior</SelectItem>
                  <SelectItem value="nursery">Nursery</SelectItem>
                </SelectContent>
              </Select>
              {canManage && <><Button onClick={() => setShowAssignDialog(true)}>
                <Plus className="w-4 h-4 mr-2" /> Assign Bed
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Import Excel
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              /></>}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="card-elevated overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-3">Student</th>
                      <th className="text-left p-3">Roll No.</th>
                      <th className="text-left p-3">Class</th>
                      <th className="text-left p-3">Dormitory</th>
                      <th className="text-left p-3">Room</th>
                      <th className="text-left p-3">Bed</th>
                      <th className="text-left p-3">Position</th>
                      <th className="text-left p-3">Allocated</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentRows.map((row) => (
                      <tr key={row.assignment.id} className="border-t border-border">
                        <td className="p-3 font-medium">{row.name}</td>
                        <td className="p-3 text-muted-foreground">{row.roll}</td>
                        <td className="p-3 text-muted-foreground">{row.class}</td>
                        <td className="p-3">{row.dorm}</td>
                        <td className="p-3 text-muted-foreground">{row.room ?? '-'}</td>
                        <td className="p-3">{row.bedLabel}</td>
                        <td className="p-3">{POSITION_LABEL[row.position]}</td>
                        <td className="p-3 text-muted-foreground">{row.allocated ? new Date(row.allocated).toLocaleDateString('en-GB') : '-'}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {canManage && (
                            <>
                              <Button size="sm" variant="ghost" title="Transfer" onClick={() => setTransferAssignment(row.assignment)}>
                                <ArrowRightLeft className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => unassign(row.assignment)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {assignmentRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                          No bed assignments yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {unassignedBoarders.length > 0 && (
              <div className="card-elevated p-4">
                <h3 className="font-semibold mb-2">Boarding students without a bed ({unassignedBoarders.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {unassignedBoarders.map((s) => (
                    <button
                      key={s.id}
                      disabled={!canManage}
                      onClick={() => openAllocate(s.id)}
                      className="px-3 py-1 rounded-full bg-muted text-xs hover:bg-primary/10"
                    >
                      {s.full_name} • {s.class}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="dorms" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openDormDialog()} disabled={!isAdmin}>
                <Plus className="w-4 h-4 mr-2" /> New Dormitory
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dorms.map((d) => {
                const used = occupancy.get(d.id) || 0;
                return (
                  <div key={d.id} className="card-elevated p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{d.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">
                          {d.code ? `${d.code} • ` : ''}{SECTION_LABEL[d.section || 'primary']} • {d.gender === 'male' ? 'Boys' : 'Girls'} • {d.room_count} rooms × {d.beds_per_room} {d.bed_type === 'double' ? 'bunk beds (upper + lower)' : 'single beds'}{d.is_active === false ? ' • INACTIVE' : ''}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="View occupants" onClick={() => setViewDorm(d)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openDormDialog(d)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteDorm(d)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm">
                      {used}/{d.capacity} spaces occupied • {d.capacity - used} free
                    </p>
                    {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                  </div>
                );
              })}
              {dorms.length === 0 && !loading && (
                <p className="text-muted-foreground">No dormitories yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* View dormitory occupants dialog */}
      <Dialog open={!!viewDorm} onOpenChange={(open) => !open && setViewDorm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewDorm?.name}</DialogTitle>
            <DialogDescription>
              {viewDorm
                ? `${viewDorm.gender === 'male' ? 'Boys' : 'Girls'} dormitory • ${viewDormRows.length}/${viewDorm.capacity} beds occupied • ${viewDorm.capacity - viewDormRows.length} free`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {viewDormRows.length === 0 && (
              <p className="text-sm text-muted-foreground">No students assigned to this dormitory yet.</p>
            )}
            {viewDormRows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.roll} • {r.cls}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{r.bedLabel}</p>
                  {r.room != null && <p>Room {r.room}</p>}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDorm(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dormitory dialog */}
      <Dialog open={showDormDialog} onOpenChange={setShowDormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dormForm.id ? 'Edit Dormitory' : 'New Dormitory'}</DialogTitle>
<DialogDescription>Set the section, gender, rooms and beds per room — beds are created automatically across the rooms.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dormitory name</Label>
              <Input
                value={dormForm.name}
                onChange={(e) => setDormForm({ ...dormForm, name: e.target.value })}
                placeholder="e.g. Al-Farouq"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={dormForm.section} onValueChange={(v) => setDormForm({ ...dormForm, section: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nursery">Nursery</SelectItem>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Senior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>For</Label>
                <Select value={dormForm.gender} onValueChange={(v) => setDormForm({ ...dormForm, gender: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Boys</SelectItem>
                    <SelectItem value="female">Girls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number of rooms</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={dormForm.rooms}
                  onChange={(e) => setDormForm({ ...dormForm, rooms: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{dormForm.bedType === 'double' ? 'Bunk beds per room' : 'Beds per room'}</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={dormForm.bedsPerRoom}
                  onChange={(e) => setDormForm({ ...dormForm, bedsPerRoom: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bed type</Label>
                <Select value={dormForm.bedType} onValueChange={(v) => setDormForm({ ...dormForm, bedType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="double">Double Decker (upper + lower)</SelectItem>
                    <SelectItem value="single">Single Bed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Short code (for bed codes)</Label>
                <Input value={dormForm.code} onChange={(e) => setDormForm({ ...dormForm, code: e.target.value })} placeholder="e.g. PM" />
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dormForm.active} onChange={(e) => setDormForm({ ...dormForm, active: e.target.checked })} /> Active
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dormForm.partitions} onChange={(e) => setDormForm({ ...dormForm, partitions: e.target.checked })} /> Rooms have partitions
              </label>
            </div>
            {(() => {
              const r = Number(dormForm.rooms) || 0;
              const b = Number(dormForm.bedsPerRoom) || 0;
              const per = dormForm.bedType === 'double' ? 2 : 1;
              return (
                <p className="text-xs text-muted-foreground">
                  {per === 2 ? `Upper spaces ${r * b} • Lower spaces ${r * b} • ` : ''}{b * per} per room • Total capacity {r * b * per}. Bed codes like {(dormForm.code || 'XX').toUpperCase()}-R01-B01{per === 2 ? '-U' : ''} are created automatically.
                </p>
              );
            })()}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={dormForm.notes}
                onChange={(e) => setDormForm({ ...dormForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDormDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveDorm} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Dormitory &amp; Bed</DialogTitle>
            <DialogDescription>Only boarding students can be given a bed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select
                value={assignStudentId}
                onValueChange={(v) => {
                  setAssignStudentId(v);
                  setAssignDormId('');
                  setAssignBedId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {boardingStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name} • {s.class}
                      {s.stream ? ` ${s.stream}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignStudentId && (
              <DormBedPicker
                gender={studentById.get(assignStudentId)?.gender}
                studentClass={studentById.get(assignStudentId)?.class}
                academicYear={selectedYear}
                dormitoryId={assignDormId}
                bedId={assignBedId}
                currentBedId={assignments.find((a) => a.student_id === assignStudentId)?.bed_id || null}
                onChange={(dormId, bedId) => {
                  setAssignDormId(dormId);
                  setAssignBedId(bedId);
                }}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveAssignment} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransferDialog data={dormData} assignment={transferAssignment} onClose={() => setTransferAssignment(null)} />
    </DashboardLayout>
  );
}
