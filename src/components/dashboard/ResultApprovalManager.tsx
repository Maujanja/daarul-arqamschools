import { useState, useCallback, useMemo } from 'react';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Lock, Unlock, Loader2, ShieldCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { classes } from '@/data/mockData';
import { getTestsForClass, getTestDisplayName } from '@/utils/seniorGrading';
import { supabase } from '@/integrations/supabase/client';

interface ResultReleaseStatus {
  id: string;
  class_name: string;
  academic_year: string;
  term: string;
  is_complete: boolean;
  approved_by_admin: boolean;
  approved_at: string | null;
  notes: string | null;
}

interface Props {
  selectedYear: string;
  filterClasses?: string[];
}

export function ResultApprovalManager({ selectedYear, filterClasses }: Props) {
  const { user } = useAuth();
  const { fetchTable, fetchAllPaginated } = useSecureQuery();
  const { insert, update } = useSecureData();
  const [releaseStatuses, setReleaseStatuses] = useState<ResultReleaseStatus[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedYear || !user) return;
    setLoading(true);
    try {
      const [statuses, marks, students, assignments] = await Promise.all([
        fetchTable<ResultReleaseStatus>('result_release_statuses', { academic_year: selectedYear }),
        fetchAllPaginated<any>('marks', { academic_year: selectedYear }),
        fetchTable<any>('students'),
        fetchTable<any>('teacher_assignments', { academic_year: selectedYear }),
      ]);
      setReleaseStatuses(statuses || []);
      setAllMarks(marks || []);
      setAllStudents(students || []);
      setAllAssignments(assignments || []);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching result approval data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, user, fetchTable, fetchAllPaginated]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded && !loading) {
      fetchData();
    }
  };

  // Calculate completion status per class/term
  const completionData = useMemo(() => {
    const results: {
      className: string;
      term: string;
      termLabel: string;
      totalStudents: number;
      expectedSubjects: number;
      studentsWithAllSubjects: number;
      totalExpectedMarks: number;
      actualMarks: number;
      isComplete: boolean;
      isApproved: boolean;
      statusId: string | null;
      percentComplete: number;
    }[] = [];

    const classesToCheck = filterClasses || classes;
    for (const className of classesToCheck) {
      const classStudents = allStudents.filter(s => s.class === className);
      if (classStudents.length === 0) continue;

      const classAssignments = allAssignments.filter(a => a.class === className);
      const assignedSubjectIds = [...new Set(classAssignments.map(a => a.subject_id))];
      if (assignedSubjectIds.length === 0) continue;

      const classMarks = allMarks.filter(m => m.class === className);
      const termsInMarks = [...new Set(classMarks.map(m => m.term))];

      // Also include terms from tests config
      const classTests = getTestsForClass(className);
      const allTerms = [...new Set([...termsInMarks, ...classTests.map(t => t.value)])];

      for (const term of allTerms) {
        const termMarks = classMarks.filter(m => m.term === term);
        const totalExpected = classStudents.length * assignedSubjectIds.length;
        const actualCount = termMarks.length;

        // Check how many students have ALL subjects filled
        let studentsComplete = 0;
        for (const student of classStudents) {
          const studentTermMarks = termMarks.filter(m => m.student_id === student.id);
          const studentSubjects = new Set(studentTermMarks.map(m => m.subject_id));
          if (assignedSubjectIds.every(sid => studentSubjects.has(sid))) {
            studentsComplete++;
          }
        }

        const isComplete = totalExpected > 0 && actualCount >= totalExpected;
        const status = releaseStatuses.find(s => s.class_name === className && s.term === term);
        const percentComplete = totalExpected > 0 ? Math.round((actualCount / totalExpected) * 100) : 0;

        if (actualCount > 0 || status) {
          const termLabel = getTestDisplayName(term, className);
          results.push({
            className,
            term,
            termLabel,
            totalStudents: classStudents.length,
            expectedSubjects: assignedSubjectIds.length,
            studentsWithAllSubjects: studentsComplete,
            totalExpectedMarks: totalExpected,
            actualMarks: actualCount,
            isComplete,
            isApproved: status?.approved_by_admin || false,
            statusId: status?.id || null,
            percentComplete: Math.min(percentComplete, 100),
          });
        }
      }
    }

    // Sort: incomplete first, then by class name
    return results.sort((a, b) => {
      if (a.isApproved !== b.isApproved) return a.isApproved ? 1 : -1;
      return a.className.localeCompare(b.className) || a.term.localeCompare(b.term);
    });
  }, [allMarks, allStudents, allAssignments, releaseStatuses]);

  const handleToggleApproval = async (item: typeof completionData[0]) => {
    const key = `${item.className}-${item.term}`;
    setToggling(key);
    try {
      if (item.statusId) {
        // Update existing
        await update('result_release_statuses', {
          approved_by_admin: !item.isApproved,
          approved_at: !item.isApproved ? new Date().toISOString() : null,
          is_complete: item.isComplete,
        }, { id: item.statusId });
      } else {
        // Create new
        await insert('result_release_statuses', {
          class_name: item.className,
          academic_year: selectedYear,
          term: item.term,
          is_complete: item.isComplete,
          approved_by_admin: true,
          approved_at: new Date().toISOString(),
        });
      }
      toast.success(`${item.className} - ${item.termLabel}: ${item.isApproved ? 'Results hidden' : 'Results released'}`);
      // Notify parents via SMS only when transitioning to APPROVED
      if (!item.isApproved) {
        try {
          const { data: notifyData, error: notifyError } = await supabase.functions.invoke('notify-results-approved', {
            body: { class_name: item.className, term: item.term, academic_year: selectedYear, sessionToken: user?.notificationToken },
          });
          if (notifyError || !notifyData?.success) throw new Error('Notification delivery failed');
          const sent = notifyData?.summary?.sent ?? 0;
          if (sent > 0) toast.success(`SMS notifications sent to ${sent} parent(s)`);
        } catch (e) {
          toast.error('Results released, but notifications were not sent. Sign in again and retry notifications.');
          console.error('notify-results-approved failed', e);
        }
      }
      await fetchData();
    } catch (err) {
      toast.error('Failed to update results status');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="card-elevated p-6 animate-fade-in">
      <button
        type="button"
        onClick={handleExpand}
        className="w-full flex items-center justify-between gap-3 mb-2 text-left"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-lg text-card-foreground">Result Approval</h3>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <p className="text-sm text-muted-foreground mb-4">
        {expanded ? 'Allow parents to see results only after teachers finish entering marks and you approve them here.' : ''}
      </p>

      {!expanded ? null : loading && !loaded ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : completionData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No marks found for {selectedYear}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {completionData.map((item) => {
            const key = `${item.className}-${item.term}`;
            const isToggling = toggling === key;
            return (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  item.isApproved
                    ? 'bg-success/5 border-success/30'
                    : item.isComplete
                    ? 'bg-primary/5 border-primary/30'
                    : 'bg-muted/50 border-border'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-card-foreground text-sm">{item.className}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{item.termLabel}</span>
                    {item.isComplete ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Complete
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {item.percentComplete}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                     {item.studentsWithAllSubjects}/{item.totalStudents} students complete • {item.actualMarks}/{item.totalExpectedMarks} marks
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5 max-w-[200px]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.isComplete ? 'bg-success' : 'bg-primary'
                      }`}
                      style={{ width: `${item.percentComplete}%` }}
                    />
                  </div>
                </div>
                <Button
                  variant={item.isApproved ? 'default' : 'outline'}
                  size="sm"
                  disabled={isToggling}
                  onClick={() => handleToggleApproval(item)}
                  className={`ml-3 shrink-0 ${item.isApproved ? 'bg-success hover:bg-success/90' : ''}`}
                >
                  {isToggling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : item.isApproved ? (
                    <>
                      <Unlock className="w-4 h-4 mr-1" />
                      Approved
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-1" />
                      Approve
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}