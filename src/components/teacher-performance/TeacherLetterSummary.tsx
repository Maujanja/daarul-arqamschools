import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBadge, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useTeacherPerformanceLetters } from '@/hooks/useTeacherPerformanceLetters';
import { tapeDetails } from '@/types/teacherPerformance';
import { generateTeacherPerformancePDF } from '@/utils/teacherPerformancePdf';

export function TeacherLetterSummary({ term }: { term: string }) {
  const navigate = useNavigate();
  const { currentYear } = useAcademicYears();
  const [year, setYear] = useState('');
  useEffect(() => { if (currentYear) setYear(currentYear); }, [currentYear]);
  const { letters, loading } = useTeacherPerformanceLetters(year, term);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileBadge className="h-5 w-5 text-primary" />My Performance Letters</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading letters...</div> : letters.length > 0 ? (
          <div className="space-y-3">
            {letters.map((letter) => (
              <div key={`${letter.teacherId}-${letter.className}-${letter.term}`} className="flex flex-col gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={tapeDetails[letter.tape].className}>{tapeDetails[letter.tape].label}</Badge>
                    <span className="font-semibold">{letter.className}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{letter.term}: {letter.average}% · Grade {letter.grade}</p>
                  {letter.subjects?.length > 0 && (
                    <p className="text-xs text-muted-foreground">{letter.subjects.map((s) => `${s.subjectName} (${s.average}%, ${tapeDetails[s.tape].label})`).join(' · ')}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/performance-letters')}>View</Button>
                  <Button size="sm" className="gap-1.5" onClick={() => void generateTeacherPerformancePDF(letter)}><Download className="h-4 w-4" />PDF</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No performance letter is available for {term} yet.</p>}
      </CardContent>
    </Card>
  );
}
