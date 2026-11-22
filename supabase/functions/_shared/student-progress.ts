export interface ProgressMark {
  subject_id: string; subject: string; term: string; academic_year: string;
  total: number; class_name: string;
}
export interface ProgressRelease {
  class_name: string; term: string; academic_year: string; approved_by_admin: boolean;
}
export const canonicalTerm = (term: string) => term.trim().replace(/^Test\s+/i, "Series ");
export function examinationOrder(term: string): number {
  const numbered = canonicalTerm(term).match(/^Series\s+(\d+)$/i);
  if (numbered) return Number(numbered[1]);
  const upper = term.toUpperCase();
  if (/CAT\s*1/.test(upper)) return 1;
  if (/CAT\s*2/.test(upper)) return 2;
  if (/TERMINAL/.test(upper)) return 3;
  if (/CAT\s*3/.test(upper)) return 4;
  if (/CAT\s*4/.test(upper)) return 5;
  if (/ANNUAL/.test(upper)) return 6;
  return 999;
}
export const maximumForClass = (name: string) => /^Primary\s+(4|7)\b/i.test(name) ? 50 : 100;
function failing(score: number, name: string) {
  if (/^Primary\b/i.test(name)) return score < (maximumForClass(name) === 50 ? 21 : 41);
  if (/^(Baby Class|Kindergarten)/i.test(name)) return score < 41;
  return score < 30;
}
function countsForAverage(mark: ProgressMark) {
  return !(/^Primary\b/i.test(mark.class_name) &&
    /^(e\.d\.k|edk|edk nursery|arabic|arabic language|arabic nursery|quran)$/i.test(mark.subject.trim()));
}
export function buildStudentProgress(marks: ProgressMark[], releases: ProgressRelease[], year: string, className?: string, throughTerm?: string) {
  const approved = marks.filter(m => m.academic_year === year && (!className || m.class_name === className) &&
    Number.isFinite(m.total) && m.total >= 0 && m.total <= maximumForClass(m.class_name) &&
    (!throughTerm || examinationOrder(m.term) <= examinationOrder(throughTerm)) &&
    releases.some(r => r.approved_by_admin && r.academic_year === year && r.class_name === m.class_name && canonicalTerm(r.term) === canonicalTerm(m.term)));
  const exams = [...new Set(approved.map(m => `${m.class_name}|${canonicalTerm(m.term)}`))]
    .sort((a, b) => a.split("|")[0].localeCompare(b.split("|")[0], undefined, { numeric: true }) || examinationOrder(a.split("|")[1]) - examinationOrder(b.split("|")[1]));
  const series = exams.map(key => {
    const [cls, term] = key.split("|");
    const rows = approved.filter(m => m.class_name === cls && canonicalTerm(m.term) === term);
    const unique = Array.from(new Map(rows.map(m => [m.subject_id, m])).values());
    const counted = unique.filter(countsForAverage);
    return { term, className: cls, maximum: maximumForClass(cls),
      average: counted.length ? counted.reduce((sum, m) => sum + m.total / maximumForClass(cls) * 100, 0) / counted.length : null,
      subjects: unique.map(m => ({ id: m.subject_id, name: m.subject, score: m.total, percent: m.total / maximumForClass(cls) * 100 })) };
  });
  const latest = series.at(-1);
  const previous = series.at(-2)?.className === latest?.className ? series.at(-2) : undefined;
  const subjects = (latest?.subjects || []).map(s => {
    const before = previous?.subjects.find(p => p.id === s.id);
    return { ...s, previous: before?.score ?? null, delta: before ? s.percent - before.percent : null,
      failed: failing(s.score, latest?.className || "") };
  });
  // Overall comparisons use the same subject set in both examinations.
  const comparable = subjects.filter(s => s.delta !== null && countsForAverage({ subject: s.name, class_name: latest?.className || "" } as ProgressMark));
  const averageDelta = comparable.length ? comparable.reduce((sum, s) => sum + (s.delta || 0), 0) / comparable.length : null;
  const alerts = subjects.filter(s => s.failed || (s.delta !== null && s.delta <= -10));
  const ranked = [...subjects].sort((a, b) => b.percent - a.percent);
  return { year, series, latest: latest?.term ?? null, className: latest?.className ?? className ?? "",
    subjects, average: latest?.average ?? null, averageDelta,
    best: ranked[0] ?? null, weakest: ranked.at(-1) ?? null, alerts,
    hasAlert: alerts.length > 0 || (averageDelta !== null && averageDelta < 0) };
}
export type StudentProgress = ReturnType<typeof buildStudentProgress>;
export function progressNarration(name: string, progress: StudentProgress): string {
  if (!progress.latest) return `Hakuna matokeo yaliyoidhinishwa ya ${name} kwa mwaka ${progress.year}.`;
  const sentences = [`Mzazi wa ${name}, huu ni muhtasari wa maendeleo ya mtoto kwa mwaka ${progress.year}, ${progress.className}, ${progress.latest}.`,
    `Kuna mitihani ${progress.series.length} iliyoidhinishwa.`];
  if (progress.average !== null) sentences.push(`Wastani wa sasa ni asilimia ${progress.average.toFixed(1)}.`);
  if (progress.averageDelta !== null) sentences.push(progress.averageDelta < 0
    ? `Tahadhari: wastani wa masomo yanayolinganishwa umeshuka kwa pointi ${Math.abs(progress.averageDelta).toFixed(1)}.`
    : `Wastani wa masomo yanayolinganishwa ${progress.averageDelta > 0 ? `umepanda kwa pointi ${progress.averageDelta.toFixed(1)}` : "haujabadilika"}.`);
  if (progress.best) sentences.push(`Somo bora ni ${progress.best.name}, alama ${progress.best.score}.`);
  if (progress.weakest) sentences.push(`Somo linalohitaji juhudi zaidi ni ${progress.weakest.name}, alama ${progress.weakest.score}.`);
  const improved = progress.subjects.filter(s => s.delta !== null && s.delta > 0).map(s => s.name);
  const declined = progress.subjects.filter(s => s.delta !== null && s.delta < 0).map(s => s.name);
  if (improved.length) sentences.push(`Masomo yaliyopanda ni ${improved.join(", ")}.`);
  if (declined.length) sentences.push(`Masomo yaliyoshuka ni ${declined.join(", ")}.`);
  for (const s of progress.alerts) sentences.push(s.previous !== null && (s.delta || 0) < 0
    ? `Tahadhari kwenye ${s.name}: alama zimeshuka kutoka ${s.previous} hadi ${s.score}.`
    : `Tahadhari kwenye ${s.name}: alama ${s.score} ziko chini ya kiwango cha ufaulu.`);
  sentences.push(progress.hasAlert ? "Tafadhali wasiliana na mwalimu kuhusu masomo yanayohitaji msaada." : "Endelea kumtia moyo mtoto na kufuatilia masomo yake.");
  return sentences.join(" ");
}