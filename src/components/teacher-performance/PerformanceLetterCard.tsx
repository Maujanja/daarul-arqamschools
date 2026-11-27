import { Download, Eye, Award, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TeacherPerformanceLetter } from '@/types/teacherPerformance';
import { tapeDetails } from '@/types/teacherPerformance';
import { generateTeacherPerformancePDF } from '@/utils/teacherPerformancePdf';
import { useState } from 'react';
import dasLogo from '@/assets/das-logo.png';

const icons = { green: Award, yellow: TrendingUp, red: AlertTriangle };

function formatLetterDate(value: string | null) {
  if (!value) return 'Date not set';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Preview({ letter }: { letter: TeacherPerformanceLetter }) {
  const details = tapeDetails[letter.tape];
  const lowNames = letter.lowestStudents.map((student) => student.name).join(', ');
  const classLabel = letter.className || letter.classes[0] || '';
  const subjects = letter.subjects || [];
  return (
    <div className="mx-auto w-full max-w-[760px] bg-card text-card-foreground border border-border p-5 sm:p-8">
      <div className="text-center">
        <img src={dasLogo} alt="DAARUL-ARQAM Schools logo" className="mx-auto h-14 w-14 object-contain" />
        <h2 className="mt-2 text-xl sm:text-2xl font-bold">DAARUL-ARQAM ISLAMIC SCHOOLS</h2>
        <p className="mt-1 text-xs sm:text-sm font-semibold underline">P.O BOX 80059 Email: darqamschool@gmail.com Tel: +255718999777, +255715250026</p>
      </div>
      <p className="mt-6 text-right text-sm font-semibold">Date: {formatLetterDate(letter.examDate)}</p>
      <p className="mt-6 font-semibold">To: {letter.teacherName}</p>
      <p className="mt-1 text-sm font-medium">Class: {classLabel}{subjects.length > 0 ? ` · Subject(s): ${subjects.map((s) => s.subjectName).join(', ')}` : ''}</p>
      <p className="mt-2 font-bold underline">SUBJECT: {details.summary.toUpperCase()} – PLACEMENT ON {details.label.toUpperCase()}.</p>
      <div className="mt-5 space-y-4 text-sm leading-6">
        <p>Following the review of <strong>{letter.term}</strong> results for <strong>{classLabel}</strong> in the <strong>{letter.academicYear}</strong> academic year, your students achieved an overall average of <strong>{letter.average}%</strong>, Grade <strong>{letter.grade}</strong>.</p>
        {subjects.length > 0 && (
          <div className="border border-border rounded-md p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject Breakdown ({classLabel})</p>
            {subjects.map((s) => (
              <div key={s.subjectName} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{s.subjectName}{s.streams.length > 0 ? ` (${s.streams.join(', ')})` : ''}</span>
                <div className="flex items-center gap-2">
                  <span>{s.average}% · Grade {s.grade}</span>
                  <Badge variant="outline" className={tapeDetails[s.tape].className}>{tapeDetails[s.tape].label}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        {letter.tape === 'green' ? (
          <>
            <p>The school management congratulates you and places you under <strong>Green Tape</strong> in recognition of your strong academic performance and commitment to effective teaching.</p>
            <p>You are encouraged to maintain this standard, continue supporting every learner, and share effective practices with your colleagues.</p>
          </>
        ) : letter.tape === 'yellow' ? (
          <>
            <p>You are placed under <strong>Yellow Tape</strong>. Your current academic performance requires improvement.</p>
            {lowNames && <p>Students requiring closer support include <strong>{lowNames}</strong>.</p>}
            <p>You are required to increase your efforts, monitor students performing below expectations, and provide the necessary remedial support before the next examination.</p>
          </>
        ) : (
          <>
            <p>You are placed under <strong>Red Tape</strong> as a formal performance warning. The result requires immediate and measurable corrective action.</p>
            {lowNames && <p>Students requiring urgent attention include <strong>{lowNames}</strong>.</p>}
            <p>You are required to implement an immediate improvement plan and work with school leadership to address the identified gaps.</p>
          </>
        )}
        <p>The school management will continue to monitor the academic progress of the students under your responsibility.</p>
      </div>
      <div className="mt-8">
        <p>Yours faithfully,</p>
        <p className="mt-8 font-bold">{(letter.signatoryName || 'HEAD TEACHER').toUpperCase()}</p>
        <p className="font-bold">{(letter.section === 'secondary' ? 'HEAD MASTER (SECONDARY)' : (letter.signatoryTitle || 'HEAD TEACHER')).toUpperCase()}</p>
      </div>
      <div className={`mt-8 h-3 ${letter.tape === 'green' ? 'bg-success' : letter.tape === 'yellow' ? 'bg-warning' : 'bg-destructive'}`} />
    </div>
  );
}

export function PerformanceLetterCard({ letter }: { letter: TeacherPerformanceLetter }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const details = tapeDetails[letter.tape];
  const Icon = icons[letter.tape];
  const classLabel = letter.className || letter.classes[0] || '';
  const subjects = letter.subjects || [];
  return (
    <>
      <div className="border border-border bg-card p-5 rounded-md">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${letter.tape === 'green' ? 'text-success' : letter.tape === 'yellow' ? 'text-warning' : 'text-destructive'}`} />
              <h3 className="font-semibold truncate">{letter.teacherName}</h3>
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{classLabel}</p>
            <p className="text-xs text-muted-foreground">{letter.term} · {letter.academicYear} · {formatLetterDate(letter.examDate)}</p>
          </div>
          <Badge variant="outline" className={details.className}>{details.label}</Badge>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-center">
          <div><p className="text-xl font-bold">{letter.average}%</p><p className="text-xs text-muted-foreground">Average</p></div>
          <div><p className="text-xl font-bold">{letter.grade}</p><p className="text-xs text-muted-foreground">Grade</p></div>
          <div><p className="text-xl font-bold">{letter.markCount}</p><p className="text-xs text-muted-foreground">Results</p></div>
        </div>
        {subjects.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {subjects.map((s) => (
              <div key={s.subjectName} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-foreground">{s.subjectName}{s.streams.length > 0 ? ` (${s.streams.join(', ')})` : ''}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">{s.average}% ({s.grade})</span>
                  <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${tapeDetails[s.tape].className}`}>{tapeDetails[s.tape].label}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4" />View</Button>
          <Button className="flex-1 gap-2" onClick={() => void generateTeacherPerformancePDF(letter)}><Download className="h-4 w-4" />PDF</Button>
        </div>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{details.label} Letter</DialogTitle>
            <DialogDescription>Preview the letter before downloading the PDF.</DialogDescription>
          </DialogHeader>
          <Preview letter={letter} />
          <Button className="gap-2" onClick={() => void generateTeacherPerformancePDF(letter)}><Download className="h-4 w-4" />Download PDF</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
