import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Headphones, Loader2, RefreshCw, TrendingUp, Volume2 } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTestDisplayName } from '@/utils/seniorGrading';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { StudentProgress } from '../../../supabase/functions/_shared/student-progress';

interface Props { token?: string; studentId: string; year: string; selectedTerm: string }
interface Report { progress: StudentProgress; narration: string; studentName: string }
async function invokeProgress(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('parent-progress', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.json().catch(() => ({}));
      throw new Error(details.error || 'Unable to load progress. Please try again.');
    }
    throw new Error('Unable to reach the progress service. Please try again.');
  }
  return data;
}

export function ChildProgress({ token, studentId, year, selectedTerm }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('all');
  const [subject, setSubject] = useState('all');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [needsPlay, setNeedsPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const region = useRef<HTMLElement>(null);
  const requestId = useRef(0);
  const voiceId = useRef(0);
  const openedFromNotification = useRef(false);
  const request = useCallback((action: string) => ({ action, sessionToken: token, year,
    ...(scope === 'selected' ? { throughTerm: selectedTerm } : {}) }), [token, year, scope, selectedTerm]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setReport(null); setError('');
    if (!token) { setError('Please sign out and sign in again to view child progress.'); return; }
    setLoading(true);
    try { const data = await invokeProgress(request('report')); if (id === requestId.current) setReport(data); }
    catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : 'Unable to load progress.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [token, request]);

  useEffect(() => { void load(); return () => { requestId.current++; }; }, [load, studentId]);
  useEffect(() => {
    voiceId.current++; audioRef.current?.pause(); setAudioUrl(''); setNeedsPlay(false); setSpeaking(false);
  }, [year, scope, selectedTerm, studentId]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => () => { voiceId.current++; audioRef.current?.pause(); }, []);
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;
    audioRef.current.play().catch(() => setNeedsPlay(true));
  }, [audioUrl]);

  const listen = useCallback(async () => {
    setError('');
    if (audioUrl) { audioRef.current?.play().catch(() => setNeedsPlay(true)); return; }
    const id = ++voiceId.current;
    setSpeaking(true);
    try {
      const blob = await invokeProgress(request('speak'));
      if (!(blob instanceof Blob) || !blob.type.startsWith('audio/mpeg')) throw new Error('No playable MP3 was returned.');
      if (id === voiceId.current) setAudioUrl(URL.createObjectURL(blob));
    } catch (e) { if (id === voiceId.current) setError(e instanceof Error ? e.message : 'Voice report unavailable.'); }
    finally { if (id === voiceId.current) setSpeaking(false); }
  }, [audioUrl, request]);

  const show = () => {
    setOpen(true);
    if (report?.progress.latest) void listen();
    window.setTimeout(() => region.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 50);
  };
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('progress') !== '1' || !report || openedFromNotification.current) return;
    // A notification can only open the signed-in child's report, never a child ID from the URL.
    openedFromNotification.current = true; setOpen(true);
    if (report.progress.latest) void listen();
  }, [report, listen]);

  const progress = report?.progress;
  const subjects = Array.from(new Map(progress?.series.flatMap(s => s.subjects.map(m => [m.id, m.name] as const)) || []).entries());
  const chart = progress?.series.map((s, i) => ({
    examination: `${s.className} · ${getTestDisplayName(s.term, s.className)}`,
    index: i + 1, average: s.average,
    score: s.subjects.find(m => m.id === subject)?.percent ?? null,
  })) || [];

  return <section ref={region} className="space-y-4 py-5 border-y border-border" aria-label="Child progress">
    <Button onClick={show} size="lg" className="w-full h-auto min-h-14 gap-3 whitespace-normal text-base">
      <Headphones className="h-6 w-6 shrink-0" /> MAENDELEO YA MTOTO
      {progress?.hasAlert && <span className="inline-flex items-center gap-1 rounded-md bg-destructive text-destructive-foreground px-2 py-1 text-xs"><AlertTriangle className="h-4 w-4" /> Alert</span>}
    </Button>
    {!open && progress?.hasAlert && <Button variant="ghost" onClick={show} className="w-full h-auto whitespace-normal text-warning gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> New performance alert · View report</Button>}
    {open && <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl font-semibold text-foreground">Child Progress · {year}</h3>
        <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh progress" title="Refresh progress"><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={scope} onValueChange={setScope}><SelectTrigger aria-label="Progress period"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All approved examinations</SelectItem><SelectItem value="selected">Through selected examination</SelectItem></SelectContent></Select>
        <Select value={subject} onValueChange={setSubject}><SelectTrigger aria-label="Progress subject"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Overall average</SelectItem>{subjects.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
      </div>
      {loading && <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading approved results…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {progress && !progress.latest && <p className="text-muted-foreground">No approved results for this period yet.</p>}
      {progress?.latest && <>
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="outline" onClick={() => void listen()} disabled={speaking} className="gap-2">{speaking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}{audioUrl ? 'Listen Again' : 'Listen in Kiswahili'}</Button>
          <span className="text-sm text-muted-foreground">{getTestDisplayName(progress.latest, progress.className)} · {progress.series.length} examinations</span>
        </div>
        {audioUrl && <audio ref={audioRef} src={audioUrl} controls preload="auto" className="w-full" onPlay={() => setNeedsPlay(false)} aria-label="Child progress voice report" />}
        {needsPlay && <p className="text-sm text-warning">Automatic playback was blocked. Press play to listen.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><p className="text-sm text-muted-foreground">Latest average</p><p className="text-2xl font-bold text-primary">{progress.average?.toFixed(1) ?? '—'}%</p>{progress.averageDelta !== null && <p className={progress.averageDelta < 0 ? 'text-warning text-sm' : 'text-success text-sm'}>{progress.averageDelta > 0 ? '+' : ''}{progress.averageDelta.toFixed(1)} points</p>}</div>
          <div><p className="text-sm text-muted-foreground">Best subject</p><p className="font-semibold text-success break-words">{progress.best?.name ?? '—'}</p><p className="text-sm">{progress.best?.score} / {progress.series.at(-1)?.maximum}</p></div>
          <div><p className="text-sm text-muted-foreground">Needs attention</p><p className="font-semibold text-warning break-words">{progress.weakest?.name ?? '—'}</p><p className="text-sm">{progress.weakest?.score} / {progress.series.at(-1)?.maximum}</p></div>
        </div>
        <div className="h-64 w-full min-w-0" aria-label="Approved examination trend chart">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="index" stroke="hsl(var(--muted-foreground))" /><YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" /><Tooltip labelFormatter={(_, items) => items[0]?.payload.examination || ''} /><Line type="linear" dataKey={subject === 'all' ? 'average' : 'score'} name={subject === 'all' ? 'Average (%)' : 'Subject (%)'} stroke="hsl(var(--primary))" strokeWidth={2} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
        </div>
        <ul className="divide-y divide-border">{progress.subjects.map(s => <li key={s.id} className="py-3 flex flex-wrap justify-between gap-2"><span className="font-medium break-words">{s.name}</span><span className={s.delta !== null && s.delta < 0 ? 'text-warning' : 'text-success'}>{s.score} / {progress.series.at(-1)?.maximum} · {s.delta === null ? 'No comparison' : `${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)} points`}</span></li>)}</ul>
        {progress.hasAlert && <div role="status" className="border-l-4 border-warning pl-4 space-y-2"><h4 className="font-semibold text-warning flex gap-2 items-center"><AlertTriangle className="h-4 w-4" /> Performance alerts</h4>{progress.averageDelta !== null && progress.averageDelta < 0 && <p>Overall performance has declined by {Math.abs(progress.averageDelta).toFixed(1)} points.</p>}{progress.alerts.map(s => <p key={s.id}>{s.name}: {s.previous !== null && (s.delta || 0) < 0 ? `${s.previous} → ${s.score}` : `${s.score} marks · Below pass level`}</p>)}</div>}
        <p className="text-sm leading-relaxed text-muted-foreground" lang="sw">{report.narration}</p>
      </>}
    </div>}
    {!open && error && <p className="text-sm text-muted-foreground">{error}</p>}
  </section>;
}