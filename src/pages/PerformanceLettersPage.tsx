import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PerformanceLetterCard } from '@/components/teacher-performance/PerformanceLetterCard';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useTeacherPerformanceLetters } from '@/hooks/useTeacherPerformanceLetters';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, FileBadge, RefreshCw } from 'lucide-react';

const SERIES = Array.from({ length: 50 }, (_, index) => `Series ${index + 1}`);

const SECTIONS: Record<string, string[]> = {
  nursery: ['Baby Class', 'Kindergarten I', 'Kindergarten II'],
  primary: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7'],
  secondary: ['Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'],
};

const SECTION_LABELS: Record<string, string> = {
  nursery: 'Nursery',
  primary: 'Primary',
  secondary: 'Secondary',
};

const baseClass = (value: string) => value.trim().replace(/\s+[A-B](?:[1-2])?$/i, '');

export default function PerformanceLettersPage() {
  const { user } = useAuth();
  const { academicYears, currentYear } = useAcademicYears();
  const [year, setYear] = useState('');
  const [term, setTerm] = useState('Series 1');
  const [section, setSection] = useState('all');
  const [className, setClassName] = useState('all');
  const [teacherId, setTeacherId] = useState('all');
  useEffect(() => { if (currentYear) setYear(currentYear); }, [currentYear]);
  const { letters, loading, error, refresh } = useTeacherPerformanceLetters(year, term);

  const sectionOptions = useMemo(() => {
    if (user?.role === 'head_nursery') return ['nursery'];
    if (user?.role === 'head_primary') return ['primary'];
    if (user?.role === 'head_secondary') return ['secondary'];
    return ['nursery', 'primary', 'secondary'];
  }, [user?.role]);

  const classOptions = useMemo(() => {
    const allowed = section === 'all'
      ? sectionOptions.flatMap((key) => SECTIONS[key])
      : SECTIONS[section] || [];
    const present = new Set(letters.flatMap((letter) => letter.classes.map(baseClass)));
    return allowed.filter((item) => present.has(item));
  }, [letters, section, sectionOptions]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    letters.forEach((letter) => map.set(letter.teacherId, letter.teacherName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [letters]);

  useEffect(() => { setClassName('all'); }, [section]);

  const filtered = useMemo(() => letters.filter((letter) => {
    const classes = letter.classes.map(baseClass);
    if (section !== 'all' && !classes.some((item) => (SECTIONS[section] || []).includes(item))) return false;
    if (className !== 'all' && !classes.includes(className)) return false;
    if (teacherId !== 'all' && letter.teacherId !== teacherId) return false;
    return true;
  }), [letters, section, className, teacherId]);

  const heading = user?.role === 'teacher' ? 'My Performance Letters' : 'Teacher Performance Letters';
  const isTeacher = user?.role === 'teacher';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl md:text-3xl font-bold">{heading}</h1><p className="mt-1 text-muted-foreground">Green: A–B · Yellow: C · Red: D–F</p></div>
          <Button variant="outline" className="gap-2" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
        <div className="grid gap-4 border border-border bg-card p-4 rounded-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium">Academic Year</label>
            <Select value={year} onValueChange={setYear}><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger><SelectContent>{academicYears.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Section</label>
            <Select value={section} onValueChange={setSection}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sections</SelectItem>{sectionOptions.map((item) => <SelectItem key={item} value={item}>{SECTION_LABELS[item]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Class</label>
            <Select value={className} onValueChange={setClassName}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All classes</SelectItem>{classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Series Test</label>
            <Select value={term} onValueChange={setTerm}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SERIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          </div>
          {!isTeacher && (
            <div>
              <label className="mb-2 block text-sm font-medium">Teacher</label>
              <Select value={teacherId} onValueChange={setTeacherId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All teachers</SelectItem>{teacherOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
        </div>
        {loading ? <div className="flex min-h-[280px] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" />Calculating teacher averages...</div> : error ? <div className="border border-destructive/40 bg-destructive/10 p-5 text-destructive rounded-md">{error}</div> : filtered.length > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((letter) => <PerformanceLetterCard key={`${letter.teacherId}-${letter.term}-${letter.academicYear}`} letter={letter} />)}</div> : <div className="flex min-h-[280px] flex-col items-center justify-center border border-dashed border-border text-center rounded-md"><FileBadge className="h-12 w-12 text-muted-foreground/50" /><h2 className="mt-4 font-semibold">No letters available</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">No letters match the selected filters.</p></div>}
      </div>
    </DashboardLayout>
  );
}
