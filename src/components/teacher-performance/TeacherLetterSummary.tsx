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
  const letter = letters[0];
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileBadge className="h-5 w-5 text-primary" />My Performance Letter</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading letter...</div> : letter ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="outline" className={tapeDetails[letter.tape].className}>{tapeDetails[letter.tape].label}</Badge>
              <p className="mt-2 font-semibold">{letter.term}: {letter.average}% · Grade {letter.grade}</p>
              <p className="text-sm text-muted-foreground">{tapeDetails[letter.tape].summary}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/performance-letters')}>View</Button>
              <Button className="gap-2" onClick={() => void generateTeacherPerformancePDF(letter)}><Download className="h-4 w-4" />PDF</Button>
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">No performance letter is available for {term} yet.</p>}
      </CardContent>
    </Card>
  );
}
