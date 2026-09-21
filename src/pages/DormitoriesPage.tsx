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
import { Dormitory, DormBed, DormAssignment, normalizeGender } from '@/types/dorm';
import { toast } from 'sonner';
import { BedDouble, Download, Eye, Loader2, Plus, Trash2, Upload, Search, Pencil } from 'lucide-react';

interface StudentRow {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
  stream: string | null;
  gender: string | null;
  boarding_type: string | null;
}

const emptyDormForm = { id: '', name: '', section: 'primary', gender: 'male', rooms: '11', bedsPerRoom: '8', notes: '' };

export default function DormitoriesPage() {
  const { user } = useAuth();
  const { fetchTable } = useSecureQuery();
  const { insert, update, remove } = useSecureData();
  const { academicYears, currentYear } = useAcademicYears();

  const role = user?.role || '';
  const canManage = role === 'admin' || role === 'secretary';

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

  useEffect(() => {
    if (!selectedYear && currentYear) setSelectedYear(currentYear);
  }, [currentYear, selectedYear]);

  const loadData = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    const [dormRows, bedRows, assignmentRows, studentRows] = await Promise.all([
      fetchTable<Dormitory>('dormitories', undefined, { orderBy: { column: 'name', ascending: true } }),
      fetchTable<DormBed>('dorm_beds'),
      fetchTable<DormAssignment>('dorm_assignments', { academic_year: selectedYear }),
      fetchTable<StudentRow>('students', undefined, { orderBy: { column: 'full_name', ascending: true } }),
    ]);
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
      };
    });
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => (dormFilter === 'all' ? true : r.assignment.dormitory_id === dormFilter))
      .filter((r) =>
        term
          ? r.name.toLowerCase().includes(term) ||
            r.roll.toLowerCase().includes(term) ||
            r.dorm.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => a.dorm.localeCompare(b.dorm) || Number(a.bed) - Number(b.bed));
  }, [assignments, studentById, bedById, dormById, search, dormFilter]);

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
            section: dorm.section || 'primary',
            gender: dorm.gender,
            rooms: String(dorm.room_count || 11),
            bedsPerRoom: String(Math.max(1, Math.ceil(dorm.capacity / (dorm.room_count || 11)))),
            notes: dorm.notes || '',
          }
        : emptyDormForm,
    );
    setShowDormDialog(true);
  };

  const saveDorm = async () => {
    const rooms = Number(dormForm.rooms);
    const bedsPerRoom = Number(dormForm.bedsPerRoom);
    const capacity = rooms * bedsPerRoom;
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
    if (capacity > 500) {
      toast.error('Total beds (rooms × beds per room) cannot exceed 500');
      return;
    }
    setSaving(true);
    const payload = {
      name: dormForm.name.trim(),
      section: dormForm.section,
      gender: dormForm.gender,
      room_count: rooms,
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

  if (!canManage) {
    return (
      <DashboardLayout>
        <div className="card-elevated p-8 text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="text-muted-foreground mt-2">Only Admin and Secretary can manage dormitories.</p>
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
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Template
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={assignments.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>
        </div>

        <Tabs defaultValue="assignments">
          <TabsList>
            <TabsTrigger value="assignments">Bed Assignments</TabsTrigger>
            <TabsTrigger value="dorms">Dormitories</TabsTrigger>
          </TabsList>

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
              <Button onClick={() => setShowAssignDialog(true)}>
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
              />
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
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => unassign(row.assignment)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {assignmentRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
                      onClick={() => {
                        setAssignStudentId(s.id);
                        setAssignDormId('');
                        setAssignBedId('');
                        setShowAssignDialog(true);
                      }}
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
              <Button onClick={() => openDormDialog()}>
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
                          {d.section || 'primary'} • {d.gender === 'male' ? 'Boys' : 'Girls'} dormitory • {d.room_count || 11} rooms
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="View occupants" onClick={() => setViewDorm(d)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openDormDialog(d)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteDorm(d)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm">
                      {used}/{d.capacity} beds occupied • {d.capacity - used} free
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
                    <SelectItem value="secondary">Secondary</SelectItem>
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
                <Label>Beds per room</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={dormForm.bedsPerRoom}
                  onChange={(e) => setDormForm({ ...dormForm, bedsPerRoom: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Total beds: {(Number(dormForm.rooms) || 0) * (Number(dormForm.bedsPerRoom) || 0)} — beds are created automatically across {Number(dormForm.rooms) || 0} rooms.
            </p>
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
    </DashboardLayout>
  );
}
