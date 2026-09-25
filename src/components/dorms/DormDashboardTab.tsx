import { useMemo } from 'react';
import { AlertTriangle, BedDouble, Building2, DoorOpen, Users } from 'lucide-react';
import { DormData, dormStats } from './dormContext';
import { SECTION_LABEL, isBoarding, normalizeGender, sectionOfClass } from '@/types/dorm';

export function DormDashboardTab({ data }: { data: DormData }) {
  const { dorms, students, assignments } = data;

  const s = useMemo(() => {
    const boarders = students.filter(isBoarding);
    const assigned = new Set(assignments.map((a) => a.student_id));
    const perDorm = dorms.map((d) => ({ d, st: dormStats(data, d.id) }));
    const totalSpaces = perDorm.reduce((n, x) => n + x.st.total, 0);
    const occupied = assignments.length;
    const warnings: { level: 'warn' | 'full'; text: string }[] = [];
    perDorm.forEach(({ d, st }) => {
      if (!st.total) return;
      if (st.pct >= 100) warnings.push({ level: 'full', text: `${d.name} is full (100%).` });
      else if (st.pct >= 90) warnings.push({ level: 'warn', text: `${d.name} is ${st.pct}% full.` });
      const rooms = new Map<number, { t: number; o: number }>();
      data.beds
        .filter((b) => b.dormitory_id === d.id)
        .forEach((b) => {
          const r = rooms.get(b.room_number || 0) || { t: 0, o: 0 };
          r.t += 1;
          if (data.assignmentByBed.has(b.id)) r.o += 1;
          rooms.set(b.room_number || 0, r);
        });
      const fullRooms = [...rooms.entries()].filter(([, v]) => v.t > 0 && v.o >= v.t).map(([k]) => k);
      if (fullRooms.length && st.pct < 100)
        warnings.push({ level: 'warn', text: `${d.name}: room ${fullRooms.join(', ')} full.` });
    });
    const unassigned = boarders.filter((b) => !assigned.has(b.id)).length;
    if (unassigned) warnings.push({ level: 'warn', text: `${unassigned} boarding students have no bed.` });
    return {
      boarders: boarders.length,
      rooms: dorms.reduce((n, d) => n + (d.room_count || 0), 0),
      totalSpaces,
      occupied,
      pct: totalSpaces ? Math.round((occupied / totalSpaces) * 1000) / 10 : 0,
      boys: boarders.filter((b) => normalizeGender(b.gender) === 'male').length,
      girls: boarders.filter((b) => normalizeGender(b.gender) === 'female').length,
      primary: boarders.filter((b) => sectionOfClass(b.class) === 'primary').length,
      senior: boarders.filter((b) => sectionOfClass(b.class) === 'secondary').length,
      perDorm,
      warnings,
    };
  }, [data, dorms, students, assignments]);

  const cards = [
    { label: 'Boarding students', value: s.boarders, icon: Users },
    { label: 'Dormitories', value: dorms.length, icon: Building2 },
    { label: 'Rooms', value: s.rooms, icon: DoorOpen },
    { label: 'Bed spaces', value: s.totalSpaces, icon: BedDouble },
    { label: 'Occupied', value: s.occupied },
    { label: 'Available', value: s.totalSpaces - s.occupied },
    { label: 'Occupancy', value: `${s.pct}%` },
    { label: 'Boys / Girls', value: `${s.boys} / ${s.girls}` },
    { label: 'Primary / Senior', value: `${s.primary} / ${s.senior}` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card-elevated p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {s.warnings.length > 0 && (
        <div className="card-elevated p-4 space-y-2">
          {s.warnings.map((w, i) => (
            <p key={i} className={`text-sm flex items-center gap-2 ${w.level === 'full' ? 'text-destructive' : 'text-warning'}`}>
              <AlertTriangle className="w-4 h-4 shrink-0" /> {w.text}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {s.perDorm.map(({ d, st }) => (
          <div key={d.id} className="card-elevated p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{d.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {SECTION_LABEL[d.section || 'primary']} • {d.gender === 'male' ? 'Boys' : 'Girls'} • {d.room_count} rooms
                  {d.is_active === false ? ' • Inactive' : ''}
                </p>
              </div>
              <span className={`text-sm font-bold ${st.pct >= 100 ? 'text-destructive' : st.pct >= 90 ? 'text-warning' : 'text-primary'}`}>
                {st.pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, st.pct)}%` }} />
            </div>
            <p className="text-sm">
              Capacity {st.total} • Occupied {st.occupied} • Available {st.available}
            </p>
            <p className="text-xs text-muted-foreground">
              Upper free {st.upperFree} • Lower free {st.lowerFree}
              {st.blocked ? ` • ${st.blocked} not usable` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
