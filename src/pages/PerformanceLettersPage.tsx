import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PerformanceLetterCard } from '@/components/teacher-performance/PerformanceLetterCard';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useTeacherPerformanceLetters } from '@/hooks/useTeacherPerformanceLetters';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, FileBadge, RefreshCw, Search } from 'lucide-react';

const SERIES = Array.from({ length: 50 }, (_, index) => `Series ${index + 1}`);

export default function PerformanceLettersPage() {
  const { user } = useAuth();
  const { academicYears, currentYear } = useAcademicYears();
  const [year, setYear] = useState('');
  const [term, setTerm] = useState('Series 1');
  const [search, setSearch] = useState('');
  useEffect(() => { if (currentYear) setYear(currentYear); }, [currentYear]);
  const { letters, loading, error, refresh } = useTeacherPerformanceLetters(year, term);
  const filtered = useMemo(() => letters.filter((letter) => letter.teacherName.toLowerCase().includes(search.toLowerCase())), [letters, search]);
  const heading = user?.role === 'teacher' ? 'My Performance Letters' : 'Teacher Performance Letters';
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl md:text-3xl font-bold">{heading}</h1><p className="mt-1 text-muted-foreground">Green: A–B · Yellow: C · Red: D–F</p></div>
          <Button variant="outline" className="gap-2" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
        <div className="grid gap-4 border border-border bg-card p-4 rounded-md sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="mb-2 block text-sm font-medium">Academic Year</label><Select value={year} onValueChange={setYear}><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger><SelectContent>{academicYears.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-2 block text-sm font-medium">Series Test</label><Select value={term} onValueChange={setTerm}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SERIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          {user?.role !== 'teacher' && <div><label className="mb-2 block text-sm font-medium">Teacher</label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teacher" /></div></div>}
        </div>
        {loading ? <div className="flex min-h-[280px] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" />Calculating teacher averages...</div> : error ? <div className="border border-destructive/40 bg-destructive/10 p-5 text-destructive rounded-md">{error}</div> : filtered.length > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((letter) => <PerformanceLetterCard key={`${letter.teacherId}-${letter.term}-${letter.academicYear}`} letter={letter} />)}</div> : <div className="flex min-h-[280px] flex-col items-center justify-center border border-dashed border-border text-center rounded-md"><FileBadge className="h-12 w-12 text-muted-foreground/50" /><h2 className="mt-4 font-semibold">No letters available</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">No valid marks were found for this series and academic year.</p></div>}
      </div>
    </DashboardLayout>
  );
}
