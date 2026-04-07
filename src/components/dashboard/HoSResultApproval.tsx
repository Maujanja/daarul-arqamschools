import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, Lock, Unlock, Loader2, ShieldCheck, AlertTriangle, Eye, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getTestsForClass, getTestDisplayName, getFilterLabel } from '@/utils/seniorGrading';
import { getStreamsForClass, getClassStreamDisplay } from '@/utils/classStreams';

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
  filterClasses: string[];
}

export function HoSResultApproval({ selectedYear, filterClasses }: Props) {
  const { user } = useAuth();
  const { fetchTable, fetchAllPaginated } = useSecureQuery();
  const { insert, update } = useSecureData();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStream, setSelectedStream] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Data
  const [releaseStatuses, setReleaseStatuses] = useState<ResultReleaseStatus[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewTeacher, setPreviewTeacher] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);

  // Init defaults
  useEffect(() => {
    if (filterClasses.length > 0 && !selectedClass) {
      setSelectedClass(filterClasses[0]);
    }
  }, [filterClasses]);

  useEffect(() => {
    if (selectedClass) {
      const tests = getTestsForClass(selectedClass);
      if (tests.length > 0 && !selectedTerm) {
        setSelectedTerm(tests[0].value);
      }
    }
  }, [selectedClass]);

  const fetchData = useCallback(async () => {
    if (!selectedYear || !user) return;
    setLoading(true);
    try {
      const [statuses, marks, students, assignments, subjects, teachers] = await Promise.all([
        fetchTable<ResultReleaseStatus>('result_release_statuses', { academic_year: selectedYear }),
        fetchAllPaginated<any>('marks', { academic_year: selectedYear }),
        fetchTable<any>('students'),
        fetchTable<any>('teacher_assignments', { academic_year: selectedYear }),
        fetchTable<any>('subjects'),
        fetchTable<any>('teachers'),
      ]);
      setReleaseStatuses(statuses || []);
      setAllMarks(marks || []);
      setAllStudents(students || []);
      setAllAssignments(assignments || []);
      setAllSubjects(subjects || []);
      setAllTeachers(teachers || []);
    } catch (err) {
      console.error('Error fetching result approval data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, user, fetchTable, fetchAllPaginated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: auto-refresh when result statuses or marks change
  useRealtimeSubscription({
    table: 'result_release_statuses',
    onUpdate: fetchData,
    enabled: !!selectedYear && !!user,
  });
  useRealtimeSubscription({
    table: 'marks',
    onUpdate: fetchData,
    enabled: !!selectedYear && !!user,
  });

  const streams = useMemo(() => getStreamsForClass(selectedClass), [selectedClass]);

  // Filter students: use students currently in class + students who have marks for this class/term (promoted students)
  const filteredStudents = useMemo(() => {
    // Students currently registered in this class
    let students = allStudents.filter(s => s.class === selectedClass);
    if (selectedStream !== 'all' && streams.length > 0) {
      students = students.filter(s => s.stream === selectedStream);
    }
    
    // Also include students who have marks for this class but are no longer in it (promoted)
    const marksForClass = allMarks.filter(m => m.class === selectedClass);
    const studentIdsFromMarks = new Set(marksForClass.map(m => m.student_id));
    const currentStudentIds = new Set(students.map(s => s.id));
    
    // Add promoted students from marks
    const promotedStudentIds = [...studentIdsFromMarks].filter(id => !currentStudentIds.has(id));
    if (promotedStudentIds.length > 0) {
      const promotedStudents = allStudents.filter(s => promotedStudentIds.includes(s.id));
      students = [...students, ...promotedStudents];
    }
    
    return students;
  }, [allStudents, allMarks, selectedClass, selectedStream, streams]);

  // Class assignments (teachers + subjects for this class)
  const classAssignments = useMemo(() => {
    return allAssignments.filter(a => {
      if (a.class !== selectedClass) return false;
      if (selectedStream !== 'all' && streams.length > 0) {
        if (a.stream && a.stream !== selectedStream) return false;
      }
      return true;
    });
  }, [allAssignments, selectedClass, selectedStream, streams]);

  // Teachers in this class with their subjects
  const teacherSubjects = useMemo(() => {
    const map: Record<string, { teacher: any; subjects: any[] }> = {};
    classAssignments.forEach(a => {
      if (!map[a.teacher_id]) {
        const teacher = allTeachers.find(t => t.id === a.teacher_id);
        if (teacher) {
          map[a.teacher_id] = { teacher, subjects: [] };
        }
      }
      if (map[a.teacher_id]) {
        const subject = allSubjects.find(s => s.id === a.subject_id);
        if (subject && !map[a.teacher_id].subjects.find(s => s.id === subject.id)) {
          map[a.teacher_id].subjects.push(subject);
        }
      }
    });
    return Object.values(map);
  }, [classAssignments, allTeachers, allSubjects]);

  // Marks for selected class/term/stream
  // Helper: match term with aliases (Series X ↔ Test X)
  const termMatchesFn = (markTerm: string, selected: string): boolean => {
    if (markTerm === selected) return true;
    const seriesMatch = selected.match(/^Series\s+(\d+)$/i);
    if (seriesMatch) return markTerm === `Test ${seriesMatch[1]}`;
    const testMatch = selected.match(/^Test\s+(\d+)$/i);
    if (testMatch) return markTerm === `Series ${testMatch[1]}`;
    return false;
  };

  const termMarks = useMemo(() => {
    let marks = allMarks.filter(m => m.class === selectedClass && termMatchesFn(m.term, selectedTerm));
    if (selectedStream !== 'all' && streams.length > 0) {
      marks = marks.filter(m => m.stream === selectedStream);
    }
    return marks;
  }, [allMarks, selectedClass, selectedTerm, selectedStream, streams]);

  // Completion stats
  const completionStats = useMemo(() => {
    const assignedSubjectIds = [...new Set(classAssignments.map(a => a.subject_id))];
    const totalExpected = filteredStudents.length * assignedSubjectIds.length;
    const actualCount = termMarks.length;

    let studentsComplete = 0;
    for (const student of filteredStudents) {
      const studentMarks = termMarks.filter(m => m.student_id === student.id);
      const studentSubjects = new Set(studentMarks.map(m => m.subject_id));
      if (assignedSubjectIds.every(sid => studentSubjects.has(sid))) {
        studentsComplete++;
      }
    }

    const isComplete = totalExpected > 0 && actualCount >= totalExpected;
    const percentComplete = totalExpected > 0 ? Math.min(Math.round((actualCount / totalExpected) * 100), 100) : 0;
    const status = releaseStatuses.find(s => s.class_name === selectedClass && s.term === selectedTerm);

    return {
      totalStudents: filteredStudents.length,
      expectedSubjects: assignedSubjectIds.length,
      studentsComplete,
      totalExpected,
      actualCount,
      isComplete,
      percentComplete,
      isApproved: status?.approved_by_admin || false,
      statusId: status?.id || null,
    };
  }, [filteredStudents, classAssignments, termMarks, releaseStatuses, selectedClass, selectedTerm]);

  // Marks for a specific subject in preview
  const getSubjectMarks = (subjectId: string) => {
    return termMarks.filter(m => m.subject_id === subjectId);
  };

  const handleToggleApproval = async () => {
    setToggling(true);
    const termLabel = getTestDisplayName(selectedTerm, selectedClass);
    try {
      if (completionStats.statusId) {
        await update('result_release_statuses', {
          approved_by_admin: !completionStats.isApproved,
          approved_at: !completionStats.isApproved ? new Date().toISOString() : null,
          is_complete: completionStats.isComplete,
        }, { id: completionStats.statusId });
      } else {
        await insert('result_release_statuses', {
          class_name: selectedClass,
          academic_year: selectedYear,
          term: selectedTerm,
          is_complete: completionStats.isComplete,
          approved_by_admin: true,
          approved_at: new Date().toISOString(),
        });
      }
      toast.success(`${selectedClass} - ${termLabel}: ${completionStats.isApproved ? 'Results hidden' : 'Results released'}`);
      await fetchData();
    } catch (err) {
      toast.error('Failed to update results status');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-lg text-card-foreground">Result Approval</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-lg text-card-foreground">Result Approval</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Review marks entered by teachers before releasing results to parents.
      </p>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Class</label>
          <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStream('all'); setSelectedTerm(getTestsForClass(v)[0]?.value || ''); setShowPreview(false); }}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {filterClasses.map(cls => (
                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {streams.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Stream</label>
            <Select value={selectedStream} onValueChange={(v) => { setSelectedStream(v); setShowPreview(false); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Streams</SelectItem>
                {streams.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{getFilterLabel(selectedClass)}</label>
          <Select value={selectedTerm} onValueChange={(v) => { setSelectedTerm(v); setShowPreview(false); }}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {getTestsForClass(selectedClass).map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="w-4 h-4 mr-1" />
            {showPreview ? 'Hide' : 'Preview'}
          </Button>
        </div>
      </div>

      {/* Completion Summary */}
      {selectedClass && selectedTerm && (
        <div className={`p-4 rounded-lg border mb-4 transition-colors ${
          completionStats.isApproved
            ? 'bg-success/5 border-success/30'
            : completionStats.isComplete
            ? 'bg-primary/5 border-primary/30'
            : 'bg-muted/50 border-border'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-card-foreground">
                  {selectedClass} {selectedStream !== 'all' ? selectedStream : ''} — {getTestDisplayName(selectedTerm, selectedClass)}
                </span>
                {completionStats.isComplete ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Complete
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {completionStats.percentComplete}%
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {completionStats.studentsComplete}/{completionStats.totalStudents} students complete • {completionStats.actualCount}/{completionStats.totalExpected} marks
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2 max-w-[250px]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${completionStats.isComplete ? 'bg-success' : 'bg-primary'}`}
                  style={{ width: `${completionStats.percentComplete}%` }}
                />
              </div>
            </div>
            <Button
              variant={completionStats.isApproved ? 'default' : 'outline'}
              size="sm"
              disabled={toggling}
              onClick={handleToggleApproval}
              className={`ml-3 shrink-0 ${completionStats.isApproved ? 'bg-success hover:bg-success/90' : ''}`}
            >
              {toggling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : completionStats.isApproved ? (
                <><Unlock className="w-4 h-4 mr-1" /> Approved</>
              ) : (
                <><Lock className="w-4 h-4 mr-1" /> Approve</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Marks Preview */}
      {showPreview && selectedClass && selectedTerm && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Teachers & Subjects ({teacherSubjects.length} teachers)
          </h4>

          {teacherSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No teacher assignments found for this class.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {teacherSubjects.map(({ teacher, subjects }) => (
                <div key={teacher.id} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setPreviewTeacher(previewTeacher === teacher.id ? null : teacher.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                        {teacher.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <span className="font-medium text-sm text-card-foreground">{teacher.full_name}</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {subjects.map(s => {
                            const subjectMarks = getSubjectMarks(s.id);
                            const hasMarks = subjectMarks.length > 0;
                            return (
                              <span key={s.id} className={`text-xs px-1.5 py-0.5 rounded ${hasMarks ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                {s.name} ({subjectMarks.length})
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {previewTeacher === teacher.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {previewTeacher === teacher.id && (
                    <div className="border-t p-3 bg-muted/30">
                      {/* Subject tabs within teacher */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {subjects.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setPreviewSubject(previewSubject === s.id ? null : s.id)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              previewSubject === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>

                      {previewSubject && subjects.find(s => s.id === previewSubject) && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-1.5 font-medium text-muted-foreground">#</th>
                                <th className="text-left p-1.5 font-medium text-muted-foreground">Student</th>
                                {streams.length > 0 && <th className="text-left p-1.5 font-medium text-muted-foreground">Stream</th>}
                                <th className="text-center p-1.5 font-medium text-muted-foreground">Marks</th>
                                <th className="text-center p-1.5 font-medium text-muted-foreground">Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStudents.map((student, idx) => {
                                const mark = termMarks.find(m => m.student_id === student.id && m.subject_id === previewSubject);
                                return (
                                  <tr key={student.id} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="p-1.5 text-muted-foreground">{idx + 1}</td>
                                    <td className="p-1.5 font-medium text-card-foreground">{student.full_name}</td>
                                    {streams.length > 0 && <td className="p-1.5 text-muted-foreground">{student.stream || '-'}</td>}
                                    <td className="p-1.5 text-center">
                                      {mark ? (
                                        <span className="font-medium">{mark.total}</span>
                                      ) : (
                                        <span className="text-warning">—</span>
                                      )}
                                    </td>
                                    <td className="p-1.5 text-center">
                                      {mark ? (
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                          mark.grade === 'A' ? 'bg-success/10 text-success' :
                                          mark.grade === 'B' ? 'bg-primary/10 text-primary' :
                                          mark.grade === 'C' ? 'bg-warning/10 text-warning' :
                                          'bg-destructive/10 text-destructive'
                                        }`}>
                                          {mark.grade}
                                        </span>
                                      ) : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {!previewSubject && (
                        <p className="text-xs text-muted-foreground text-center py-2">Select a subject above to view marks</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
