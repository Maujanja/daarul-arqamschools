import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { DormData, dormStats } from './dormContext';
import { POSITION_LABEL, SECTION_LABEL, isBoarding, normalizeGender, sectionOfClass } from '@/types/dorm';
import { ReportRow, exportReportExcel, exportReportPdf } from '@/utils/dormReports';

export function ReportsTab({ data }: { data: DormData }) {
  const studentList = (filter: (sid: string) => boolean): ReportRow[] =>
    data.assignments
      .filter((a) => filter(a.student_id))
      .map((a) => {
        const s = data.studentById.get(a.student_id);
        const b = data.bedById.get(a.bed_id);
        return {
          'Student Name': s?.full_name || '',
          'Adm. No.': s?.roll_number || '',
          Class: `${s?.class || ''} ${s?.stream || ''}`.trim(),
          Gender: s?.gender || '',
          Dormitory: data.dormById.get(a.dormitory_id)?.name || '',
          Room: b?.room_number ?? '',
          Bed: b?.bed_code || '',
          Position: POSITION_LABEL[b?.bed_position || 'single'],
        };
      })
      .sort((x, y) => String(x.Dormitory).localeCompare(String(y.Dormitory)) || String(x.Bed).localeCompare(String(y.Bed)));

  const g = (sid: string) => normalizeGender(data.studentById.get(sid)?.gender);
  const sec = (sid: string) => sectionOfClass(data.studentById.get(sid)?.class);
  const assigned = new Set(data.assignments.map((a) => a.student_id));

  const reports: { title: string; rows: () => ReportRow[] }[] = [
    {
      title: 'Dormitory Occupancy Report',
      rows: () =>
        data.dorms.map((d) => {
          const st = dormStats(data, d.id);
          return {
            Dormitory: d.name,
            Section: SECTION_LABEL[d.section || 'primary'],
            Gender: d.gender === 'male' ? 'Boys' : 'Girls',
            Rooms: d.room_count || 0,
            Capacity: st.total,
            Occupied: st.occupied,
            Available: st.available,
            'Occupancy %': `${st.pct}%`,
          };
        }),
    },
    {
      title: 'Room Occupancy Report',
      rows: () => {
        const out: ReportRow[] = [];
        data.dorms.forEach((d) => {
          const map = new Map<number, { c: number; o: number }>();
          data.beds
            .filter((b) => b.dormitory_id === d.id)
            .forEach((b) => {
              const r = map.get(b.room_number || 0) || { c: 0, o: 0 };
              r.c += 1;
              if (data.assignmentByBed.has(b.id)) r.o += 1;
              map.set(b.room_number || 0, r);
            });
          [...map.entries()]
            .sort((a, b) => a[0] - b[0])
            .forEach(([room, v]) =>
              out.push({ Dormitory: d.name, Room: room, Capacity: v.c, Occupied: v.o, Available: v.c - v.o }),
            );
        });
        return out;
      },
    },
    { title: 'Student Dormitory List', rows: () => studentList(() => true) },
    { title: 'Boys Boarding Report', rows: () => studentList((s) => g(s) === 'male') },
    { title: 'Girls Boarding Report', rows: () => studentList((s) => g(s) === 'female') },
    { title: 'Primary Boarding Report', rows: () => studentList((s) => sec(s) === 'primary') },
    { title: 'Senior Boarding Report', rows: () => studentList((s) => sec(s) === 'secondary') },
    {
      title: 'Unallocated Boarding Students Report',
      rows: () =>
        data.students
          .filter((s) => isBoarding(s) && !assigned.has(s.id))
          .map((s) => ({
            'Student Name': s.full_name,
            'Adm. No.': s.roll_number,
            Class: `${s.class} ${s.stream || ''}`.trim(),
            Gender: s.gender || '',
            Section: SECTION_LABEL[sectionOfClass(s.class)],
          })),
    },
    {
      title: 'Waiting List Report',
      rows: () =>
        data.waiting
          .filter((w) => w.status === 'waiting')
          .sort((a, b) => a.priority - b.priority)
          .map((w) => {
            const s = data.studentById.get(w.student_id);
            return {
              'Student Name': s?.full_name || '',
              'Adm. No.': s?.roll_number || '',
              Gender: s?.gender || '',
              Class: s?.class || '',
              Parent: s?.parent_name || s?.parent_phone || '',
              'Date Added': new Date(w.created_at).toLocaleDateString('en-GB'),
              Priority: w.priority,
              Reason: w.reason || '',
            };
          }),
    },
    {
      title: 'Dormitory Bed Register',
      rows: () =>
        [...data.beds]
          .sort(
            (a, b) =>
              (data.dormById.get(a.dormitory_id)?.name || '').localeCompare(data.dormById.get(b.dormitory_id)?.name || '') ||
              a.bed_number - b.bed_number,
          )
          .map((b) => {
            const a = data.assignmentByBed.get(b.id);
            return {
              Dormitory: data.dormById.get(b.dormitory_id)?.name || '',
              Room: b.room_number ?? '',
              'Bed Code': b.bed_code || '',
              Position: POSITION_LABEL[b.bed_position || 'single'],
              Status: a ? 'Occupied' : (b.status || 'available').replace(/_/g, ' '),
              Student: a ? data.studentById.get(a.student_id)?.full_name || '' : '',
            };
          }),
    },
  ];

  const subtitle = `Academic Year ${data.selectedYear} • Printed ${new Date().toLocaleDateString('en-GB')}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {reports.map((r) => (
        <div key={r.title} className="card-elevated p-4 flex items-center justify-between gap-2">
          <span className="font-medium text-sm">{r.title}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => exportReportPdf(r.title, subtitle, r.rows())}>
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportReportExcel(r.title, r.rows())}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
