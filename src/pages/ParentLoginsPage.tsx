import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Users } from 'lucide-react';
import { parseClassStream } from '@/utils/classStreams';

interface ParentLoginEvent {
  id: string;
  parent_name: string | null;
  student_id: string | null;
  student_name: string;
  class: string;
  stream: string | null;
  roll_number: string | null;
  month_key: string;
  logged_in_at: string;
}

const SECTION_BASE_CLASSES: Record<string, string[]> = {
  head_nursery: ['Baby Class', 'Kindergarten I', 'Kindergarten II'],
  head_primary: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7'],
  head_secondary: ['Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'],
};

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function ParentLoginsPage() {
  const { user } = useAuth();
  const { fetchTable } = useSecureQuery();

  const role = user?.role || '';
  const canView = role === 'admin' || role.startsWith('head_');
  const sectionClasses = role === 'admin' ? null : SECTION_BASE_CLASSES[role] || [];

  const [events, setEvents] = useState<ParentLoginEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');

  const load = useCallback(async () => {
    if (!canView) return;
    setIsLoading(true);
    const rows = await fetchTable<ParentLoginEvent>('parent_login_events', undefined, {
      limit: 3000,
      orderBy: { column: 'logged_in_at', ascending: false },
    });
    setEvents(rows);
    setIsLoading(false);
  }, [canView, fetchTable]);

  useEffect(() => {
    load();
  }, [load]);

  const scopedEvents = useMemo(() => {
    if (!sectionClasses) return events;
    return events.filter((e) => sectionClasses.includes(parseClassStream(e.class).baseClass));
  }, [events, sectionClasses]);

  const months = useMemo(() => {
    const set = new Set(scopedEvents.map((e) => e.month_key));
    return Array.from(set).sort().reverse();
  }, [scopedEvents]);

  useEffect(() => {
    if (!selectedMonth && months.length > 0) setSelectedMonth(months[0]);
  }, [months, selectedMonth]);

  const monthEvents = useMemo(
    () => scopedEvents.filter((e) => e.month_key === selectedMonth),
    [scopedEvents, selectedMonth]
  );

  const classOptions = useMemo(() => {
    const set = new Set(monthEvents.map((e) => e.class));
    return Array.from(set).sort();
  }, [monthEvents]);

  const filteredEvents = useMemo(
    () => (selectedClass === 'all' ? monthEvents : monthEvents.filter((e) => e.class === selectedClass)),
    [monthEvents, selectedClass]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, {
      key: string;
      studentName: string;
      parentName: string;
      className: string;
      stream: string | null;
      rollNumber: string | null;
      visits: number;
      last: string;
    }>();

    filteredEvents.forEach((e) => {
      const key = e.student_id || `${e.student_name}-${e.class}`;
      const existing = map.get(key);
      if (existing) {
        existing.visits += 1;
        if (e.logged_in_at > existing.last) existing.last = e.logged_in_at;
      } else {
        map.set(key, {
          key,
          studentName: e.student_name,
          parentName: e.parent_name || `Parent of ${e.student_name}`,
          className: e.class,
          stream: e.stream,
          rollNumber: e.roll_number,
          visits: 1,
          last: e.logged_in_at,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.visits - a.visits);
  }, [filteredEvents]);

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="card-elevated p-8 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Only Admin and Head of School can view parent logins.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-card-foreground">Parent Dashboard Logins</h1>
          <p className="text-muted-foreground">Wazazi walioingia kwenye dashboard za wanafunzi wao kwa kila mwezi.</p>
        </div>

        <div className="card-elevated p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Class</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classOptions.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={isLoading} className="w-full">Refresh</Button>
          </div>
        </div>

        <div className="card-elevated p-6 flex items-center gap-4">
          <Users className="w-8 h-8 text-primary" />
          <div>
            <p className="text-2xl font-bold text-card-foreground">{grouped.length}</p>
            <p className="text-sm text-muted-foreground">
              Wazazi walioingia {selectedMonth ? monthLabel(selectedMonth) : ''} • {filteredEvents.length} logins
            </p>
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Hakuna mzazi aliyeingia kwa kipindi hiki.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Student</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Roll No</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Class</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Parent</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Logins</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((row) => (
                    <tr key={row.key} className="border-b border-border/50">
                      <td className="py-4 px-4 font-medium text-card-foreground">{row.studentName}</td>
                      <td className="py-4 px-4 font-mono text-sm text-muted-foreground">{row.rollNumber || '—'}</td>
                      <td className="py-4 px-4 text-sm text-card-foreground">
                        {row.className}{row.stream ? ` ${row.stream}` : ''}
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">{row.parentName}</td>
                      <td className="py-4 px-4 text-center font-semibold text-primary">{row.visits}</td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {new Date(row.last).toLocaleString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
