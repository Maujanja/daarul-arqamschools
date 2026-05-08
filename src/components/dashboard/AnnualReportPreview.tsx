import { useMemo } from 'react';
import { isSeniorClass, isNurseryClass, scoreToPoints, calculateDivision, calculateGradeForClass, getTestDisplayName } from '@/utils/seniorGrading';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { resolveSubjectsFromMarks } from '@/utils/subjectResolution';
import { isExcludedFromPrimaryAverage } from '@/utils/averageExclusions';

interface StudentData {
  id: string;
  full_name: string;
  gender: string | null;
  roll_number: string;
  class: string;
  stream: string | null;
}

interface MarkData {
  student_id: string;
  subject_id: string;
  subject_name?: string | null;
  total: number;
  grade: string;
}

interface SubjectData {
  id: string;
  name: string;
}

interface AnnualReportPreviewProps {
  open: boolean;
  onClose: () => void;
  onDownload: (format: 'excel' | 'pdf') => void;
  className: string;
  term: string;
  academicYear: string;
  students: StudentData[];
  marks: MarkData[];
  subjects: SubjectData[];
}

const gradeWeight: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 5 };

export function AnnualReportPreview({
  open, onClose, onDownload,
  className, term, academicYear,
  students, marks, subjects,
}: AnnualReportPreviewProps) {
  const isSenior = isSeniorClass(className);
  const displayTerm = getTestDisplayName(term, className);
  const gradeScale = isSenior ? ['A', 'B', 'C', 'D', 'F'] : ['A', 'B', 'C', 'D', 'E'];

  const { activeSubjects, studentRows, subjectAverages, subjectRanks } = useMemo(() => {
    const activeSubjects = resolveSubjectsFromMarks(marks, subjects);

    const studentRows = students.map(student => {
      const studentMarks = marks.filter(m => m.student_id === student.id);
      const subjectScores: { subjectId: string; score: number; grade: string; points: number }[] = [];
      const subjectScoresMeta: { subjectId: string; subjectName: string; score: number }[] = [];

      activeSubjects.forEach(subject => {
        const mark = studentMarks.find(m => m.subject_id === subject.id);
        const score = mark ? mark.total : 0;
        const grade = score > 0 ? calculateGradeForClass(score, className) : '-';
        const points = isSenior && score > 0 ? scoreToPoints(score) : 0;
        subjectScores.push({ subjectId: subject.id, score, grade, points });
        subjectScoresMeta.push({ subjectId: subject.id, subjectName: subject.name, score });
      });

      const scoredSubjects = subjectScores.filter(s => s.score > 0);
      const averagingSubjects = subjectScoresMeta.filter(s => s.score > 0 && !isExcludedFromPrimaryAverage(s.subjectName, className));
      const totalMarks = averagingSubjects.reduce((sum, s) => sum + s.score, 0);
      const average = averagingSubjects.length > 0 ? Math.round((totalMarks / averagingSubjects.length) * 10) / 10 : 0;
      const overallGrade = average > 0 ? calculateGradeForClass(average, className) : '-';

      let division = '-';
      let totalPoints = 0;
      if (isSenior) {
        if (scoredSubjects.length === 0) division = 'ABS';
        else if (scoredSubjects.length < 7) division = 'INC';
        else {
          const divResult = calculateDivision(scoredSubjects.map(s => s.score));
          division = divResult.division;
          totalPoints = divResult.totalPoints;
        }
      }

      return {
        student,
        gender: (student.gender || 'M').charAt(0).toUpperCase(),
        subjectScores,
        totalMarks,
        average,
        overallGrade,
        division,
        totalPoints,
        position: 0,
        remarks: average > 0 ? (isSenior ? (average >= 30 ? 'PASS' : 'FAIL') : (average >= 21 ? 'PASS' : 'FAIL')) : '-',
      };
    });

    // Rank
    const ranked = [...studentRows].sort((a, b) => b.average - a.average);
    let pos = 1;
    ranked.forEach((row, i) => {
      if (i > 0 && row.average === ranked[i - 1].average) row.position = ranked[i - 1].position;
      else row.position = pos;
      pos = i + 2;
    });

    // Sort: F first, then M, alphabetical
    studentRows.sort((a, b) => {
      if (a.gender !== b.gender) return a.gender === 'F' ? -1 : 1;
      return a.student.full_name.localeCompare(b.student.full_name, 'en', { sensitivity: 'base' });
    });

    // Subject averages
    const subjectAverages = activeSubjects.map(subject => {
      const scores = studentRows
        .map(r => r.subjectScores.find(s => s.subjectId === subject.id)?.score || 0)
        .filter(s => s > 0);
      return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    });

    const rankedSubs = [...subjectAverages].map((avg, i) => ({ i, avg })).filter(x => x.avg > 0).sort((a, b) => b.avg - a.avg);
    const subjectRanks: (number | string)[] = subjectAverages.map(() => '');
    rankedSubs.forEach((item, i) => { subjectRanks[item.i] = i + 1; });

    return { activeSubjects, studentRows, subjectAverages, subjectRanks };
  }, [students, marks, subjects, className, isSenior]);

  const femaleRows = studentRows.filter(r => r.gender === 'F');
  const maleRows = studentRows.filter(r => r.gender === 'M');

  const countGrades = (rows: typeof studentRows) => {
    const counts = Object.fromEntries(gradeScale.map(g => [g, rows.filter(r => r.overallGrade === g).length]));
    return {
      ...counts,
      PASS: rows.filter(r => r.remarks === 'PASS').length,
      FAIL: rows.filter(r => r.remarks === 'FAIL').length,
      TOTAL: rows.filter(r => r.average > 0).length,
    };
  };

  const countDivisions = (rows: typeof studentRows) => ({
    I: rows.filter(r => r.division === 'I').length,
    II: rows.filter(r => r.division === 'II').length,
    III: rows.filter(r => r.division === 'III').length,
    IV: rows.filter(r => r.division === 'IV').length,
    O: rows.filter(r => r.division === '0').length,
  });

  const gradeColorClass = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-emerald-600 font-bold';
      case 'B': return 'text-blue-600 font-semibold';
      case 'C': return 'text-amber-600';
      case 'D': return 'text-orange-600';
      case 'E': case 'F': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[98vw] w-full max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="p-3 sm:p-4 pb-2 border-b">
          <DialogTitle className="text-sm sm:text-lg font-bold leading-tight">
            {className.toUpperCase()} — {displayTerm.toUpperCase()} RESULTS ({academicYear})
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={() => onDownload('excel')}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDownload('pdf')}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-auto max-h-[calc(95vh-100px)]">
          <div className="p-3 sm:p-4 space-y-6 min-w-[700px]">
            {/* Header */}
            <div className="text-center space-y-1">
              <p className="text-sm italic text-muted-foreground">Bismillaahir Rahmaanir Rahiim</p>
              <h2 className="text-xl font-bold">{isSenior ? 'DAARUL-ARQAM SECONDARY SCHOOL' : isNurseryClass(className) ? 'DAARUL-ARQAM NURSERY SCHOOL' : 'DAARUL-ARQAM PRIMARY SCHOOL'}</h2>
              <p className="text-sm font-medium">{className.toUpperCase()} {displayTerm.toUpperCase()} EXAMINATION RESULTS — {academicYear}</p>
            </div>

            {/* Result Summary */}
            <div>
              <h3 className="text-sm font-bold mb-2">RESULT SUMMARY</h3>
              <table className="w-auto text-xs border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-2 py-1">G/S</th>
                    {gradeScale.map(g => <th key={g} className="border border-border px-2 py-1">{g}</th>)}
                    <th className="border border-border px-2 py-1">PASS</th>
                    <th className="border border-border px-2 py-1">FAIL</th>
                    <th className="border border-border px-2 py-1">TOTAL</th>
                    {isSenior && <>
                      <th className="border border-border px-2 py-1">I</th>
                      <th className="border border-border px-2 py-1">II</th>
                      <th className="border border-border px-2 py-1">III</th>
                      <th className="border border-border px-2 py-1">IV</th>
                      <th className="border border-border px-2 py-1">O</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'F', rows: femaleRows },
                    { label: 'M', rows: maleRows },
                    { label: 'T', rows: studentRows },
                  ].map(({ label, rows }) => {
                    const g = countGrades(rows);
                    const d = isSenior ? countDivisions(rows) : null;
                    return (
                      <tr key={label} className={label === 'T' ? 'font-bold bg-muted/50' : ''}>
                        <td className="border border-border px-2 py-1">{label}</td>
                        {gradeScale.map(gr => <td key={gr} className="border border-border px-2 py-1 text-center">{g[gr]}</td>)}
                        <td className="border border-border px-2 py-1 text-center">{g.PASS}</td>
                        <td className="border border-border px-2 py-1 text-center">{g.FAIL}</td>
                        <td className="border border-border px-2 py-1 text-center">{g.TOTAL}</td>
                        {d && <>
                          <td className="border border-border px-2 py-1 text-center">{d.I}</td>
                          <td className="border border-border px-2 py-1 text-center">{d.II}</td>
                          <td className="border border-border px-2 py-1 text-center">{d.III}</td>
                          <td className="border border-border px-2 py-1 text-center">{d.IV}</td>
                          <td className="border border-border px-2 py-1 text-center">{d.O}</td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Main Student Table */}
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse border border-border w-full min-w-[800px]">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-2 py-1 whitespace-nowrap">S/N</th>
                    <th className="border border-border px-2 py-1">SEX</th>
                    <th className="border border-border px-2 py-1 text-left">FULL NAME</th>
                    {isSenior && <th className="border border-border px-2 py-1">DIV</th>}
                    {isSenior && <th className="border border-border px-2 py-1">PTS</th>}
                    {activeSubjects.map(s => (
                      <th key={s.id} className="border border-border px-1 py-1 text-center whitespace-nowrap" title={s.name}>
                        {s.name.length > 8 ? s.name.split(/\s+/).map(w => w[0]).join('') : s.name}
                      </th>
                    ))}
                    <th className="border border-border px-2 py-1">TOT</th>
                    <th className="border border-border px-2 py-1">AVG</th>
                    <th className="border border-border px-2 py-1">GRD</th>
                    <th className="border border-border px-2 py-1">POS</th>
                    <th className="border border-border px-2 py-1">RMK</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((row, idx) => (
                    <tr key={row.student.id} className={idx % 2 === 0 ? '' : 'bg-muted/30'}>
                      <td className="border border-border px-2 py-1 text-center">{String(idx + 1).padStart(3, '0')}</td>
                      <td className="border border-border px-2 py-1 text-center">{row.gender}</td>
                      <td className="border border-border px-2 py-1 whitespace-nowrap">{row.student.full_name}</td>
                      {isSenior && <td className="border border-border px-2 py-1 text-center font-medium">{row.division}</td>}
                      {isSenior && <td className="border border-border px-2 py-1 text-center">{row.totalPoints > 0 ? row.totalPoints : ''}</td>}
                      {row.subjectScores.map((ss, i) => (
                        <td key={i} className="border border-border px-1 py-1 text-center">
                          {ss.score > 0 ? ss.score : ''}
                        </td>
                      ))}
                      <td className="border border-border px-2 py-1 text-center font-medium">{row.totalMarks > 0 ? row.totalMarks : ''}</td>
                      <td className="border border-border px-2 py-1 text-center font-medium">{row.average > 0 ? row.average : ''}</td>
                      <td className={`border border-border px-2 py-1 text-center ${gradeColorClass(row.overallGrade)}`}>{row.overallGrade}</td>
                      <td className="border border-border px-2 py-1 text-center font-bold">{row.position}</td>
                      <td className={`border border-border px-2 py-1 text-center text-xs ${row.remarks === 'PASS' ? 'text-emerald-600' : row.remarks === 'FAIL' ? 'text-red-600' : ''}`}>
                        {row.remarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subject Summary */}
            <div className="overflow-x-auto">
              <h3 className="text-sm font-bold mb-2">SUBJECT SUMMARY</h3>
              <table className="text-xs border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-2 py-1"></th>
                    {activeSubjects.map(s => (
                      <th key={s.id} className="border border-border px-2 py-1 text-center whitespace-nowrap" title={s.name}>
                        {s.name.length > 8 ? s.name.split(/\s+/).map(w => w[0]).join('') : s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-2 py-1 font-medium">AVERAGE</td>
                    {subjectAverages.map((avg, i) => (
                      <td key={i} className="border border-border px-2 py-1 text-center">{avg > 0 ? avg : ''}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-border px-2 py-1 font-medium">GRADE</td>
                    {subjectAverages.map((avg, i) => (
                      <td key={i} className={`border border-border px-2 py-1 text-center ${gradeColorClass(avg > 0 ? calculateGradeForClass(avg, className) : '-')}`}>
                        {avg > 0 ? calculateGradeForClass(avg, className) : ''}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-border px-2 py-1 font-medium">RANK</td>
                    {subjectRanks.map((rank, i) => (
                      <td key={i} className="border border-border px-2 py-1 text-center font-bold">{rank}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Grade Distribution */}
            <div className="overflow-x-auto">
              <h3 className="text-sm font-bold mb-2">INDIVIDUAL SUBJECT GRADE SCORES</h3>
              <table className="text-xs border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-2 py-1">GRADE</th>
                    {activeSubjects.map(s => (
                      <th key={s.id} className="border border-border px-2 py-1 text-center whitespace-nowrap" title={s.name}>
                        {s.name.length > 8 ? s.name.split(/\s+/).map(w => w[0]).join('') : s.name}
                      </th>
                    ))}
                    <th className="border border-border px-2 py-1">TOTAL</th>
                    <th className="border border-border px-2 py-1">VOLUME</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeScale.map(grade => {
                    const counts = activeSubjects.map(subject =>
                      studentRows.reduce((sum, row) => {
                        const ss = row.subjectScores.find(s => s.subjectId === subject.id);
                        return sum + (ss && ss.score > 0 && ss.grade === grade ? 1 : 0);
                      }, 0)
                    );
                    const total = counts.reduce((a, b) => a + b, 0);
                    const volume = total * (gradeWeight[grade] ?? 0);
                    return (
                      <tr key={grade}>
                        <td className={`border border-border px-2 py-1 font-medium ${gradeColorClass(grade)}`}>{grade}</td>
                        {counts.map((c, i) => <td key={i} className="border border-border px-2 py-1 text-center">{c || ''}</td>)}
                        <td className="border border-border px-2 py-1 text-center font-medium">{total}</td>
                        <td className="border border-border px-2 py-1 text-center">{volume}</td>
                      </tr>
                    );
                  })}
                   {/* Candidates row — count every student who has a marks
                       entry for the subject (including absentees / 0 scores)
                       so the totals match the Result Approval counts. */}
                   {(() => {
                     const candidatesPerSubject = activeSubjects.map(subject => {
                       const studentsWithEntry = new Set(
                         marks.filter(m => m.subject_id === subject.id).map(m => m.student_id)
                       );
                       return studentsWithEntry.size;
                     });
                     const candidatesTotal = candidatesPerSubject.reduce((a, b) => a + b, 0);
                    return (
                      <tr className="font-bold bg-muted/50">
                        <td className="border border-border px-2 py-1">CANDIDATES</td>
                        {candidatesPerSubject.map((c, i) => <td key={i} className="border border-border px-2 py-1 text-center">{c}</td>)}
                        <td className="border border-border px-2 py-1 text-center">{candidatesTotal}</td>
                        <td className="border border-border px-2 py-1"></td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
