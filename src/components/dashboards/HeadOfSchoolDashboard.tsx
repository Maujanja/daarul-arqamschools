import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { SeriesSummaryTable } from '@/components/dashboard/SeriesSummaryTable';
import { Users, GraduationCap, BookOpen, MessageSquare, FileText, Download, Loader2, Calendar, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureData } from '@/hooks/useSecureData';
import { getTestDisplayName, getTestsForClass, getFilterLabel } from '@/utils/seniorGrading';
import { generateAnnualExamReport } from '@/utils/annualReportGenerator';
import { generateAnnualExamReportPDF } from '@/utils/annualReportPdfGenerator';
import { toast } from 'sonner';
import { AnnualReportPreview } from '@/components/dashboard/AnnualReportPreview';
import { HoSResultApproval } from '@/components/dashboard/HoSResultApproval';
import { CLASS_STREAMS, parseClassStream } from '@/utils/classStreams';

// Helper function
async function secureQuery(table: string, userRole: string, userId: string, options?: any) {
  const { data, error } = await supabase.functions.invoke('data-query', {
    body: { table, userRole, userId, ...options },
  });
  if (error) return { success: false, data: null, count: 0, error };
  return data;
}

// Map role to base class names (from CLASS_STREAMS keys)
const SECTION_BASE_CLASSES: Record<string, string[]> = {
  head_nursery: ['Baby Class', 'Kindergarten I', 'Kindergarten II'],
  head_primary: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7'],
  head_secondary: ['Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'],
};

const sectionLabel: Record<string, string> = {
  head_nursery: 'Nursery Section',
  head_primary: 'Primary Section',
  head_secondary: 'Secondary Section',
};

function isClassInSection(className: string, sectionBaseClasses: string[]): boolean {
  const { baseClass } = parseClassStream(className);
  return sectionBaseClasses.includes(baseClass);
}

interface FeedbackItem {
  id: string;
  parent_id: string;
  student_id: string;
  message: string;
  status: string;
  created_at: string;
  recipient_type: string;
  parentName?: string;
  studentName?: string;
  studentClass?: string;
}

export function HeadOfSchoolDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { update } = useSecureData();
  const { academicYears, currentYear } = useAcademicYears();
  const [selectedYear, setSelectedYear] = useState('');
  const [reportClass, setReportClass] = useState('');
  const [reportTerm, setReportTerm] = useState('Series 1');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportFormat, setReportFormat] = useState<'excel' | 'pdf'>('excel');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');

  const role = user?.role || 'head_primary';
  const myBaseClasses = SECTION_BASE_CLASSES[role] || [];
  const label = sectionLabel[role] || 'My Section';

  useEffect(() => {
    if (currentYear) setSelectedYear(currentYear);
  }, [currentYear]);

  useEffect(() => {
    if (myBaseClasses.length > 0 && !reportClass) {
      setReportClass(myBaseClasses[0]);
      setSelectedClass(myBaseClasses[0]);
    }
  }, [myBaseClasses]);

  // Fetch subjects
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['head-subjects', user?.role],
    queryFn: async () => {
      if (!user) return [];
      const result = await secureQuery('subjects', user.role, user.id, { select: 'id, name, code' });
      return result?.success ? result.data : [];
    },
    enabled: !!user,
  });

  // Fetch marks for my section (paginated)
  const { data: allMarks = [], isLoading: marksLoading } = useQuery({
    queryKey: ['head-marks', selectedYear, user?.role],
    queryFn: async () => {
      if (!selectedYear || !user) return [];
      const allData: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await secureQuery('marks', user.role, user.id, {
          filters: { academic_year: selectedYear },
          range: { from: page * pageSize, to: (page + 1) * pageSize - 1 },
          orderBy: { column: 'id', ascending: true },
        });
        if (result?.success && result.data?.length > 0) {
          allData.push(...result.data);
          page++;
          hasMore = result.data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      // Filter to only my section classes
      return allData.filter(m => isClassInSection(m.class, myBaseClasses));
    },
    enabled: !!selectedYear && !!user,
  });

  // Students for my section
  const { data: sectionStudents = [] } = useQuery({
    queryKey: ['head-students', user?.role],
    queryFn: async () => {
      if (!user) return [];
      const result = await secureQuery('students', user.role, user.id);
      if (!result?.success) return [];
      return (result.data || []).filter((s: any) => isClassInSection(s.class, myBaseClasses));
    },
    enabled: !!user,
  });

  // Unlock requests for my section
  const { data: unlockRequests = [] } = useQuery({
    queryKey: ['head-unlock-requests', selectedYear, user?.role],
    queryFn: async () => {
      if (!selectedYear || !user) return [];
      const result = await secureQuery('marks_unlock_requests', user.role, user.id, {
        filters: { academic_year: selectedYear },
      });
      if (!result?.success) return [];
      return (result.data || []).filter((r: any) => isClassInSection(r.class, myBaseClasses));
    },
    enabled: !!selectedYear && !!user,
  });

  const sectionMarks = allMarks;

  const uniqueClasses = useMemo(() => {
    // Use base classes that have marks data
    const classesWithData = [...new Set(sectionMarks.map(m => m.class))];
    return classesWithData.sort();
  }, [sectionMarks]);

  const uniqueTerms = useMemo(() => {
    const terms = [...new Set(sectionMarks.map(m => m.term))];
    return terms.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [sectionMarks]);

  const seriesLabels = useMemo(() => uniqueTerms.map((_, i) => `S${i + 1}`), [uniqueTerms]);

  const classSummaryData = useMemo(() => {
    return uniqueClasses.map((className, index) => {
      const classMarks = sectionMarks.filter(m => m.class === className);
      const seriesData: { [key: string]: number | null } = {};
      let totalSum = 0, totalCount = 0;

      uniqueTerms.forEach((term, termIndex) => {
        const termMarks = classMarks.filter(m => m.term === term);
        if (termMarks.length > 0) {
          const avg = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
          seriesData[`S${termIndex + 1}`] = Math.round(avg);
          totalSum += avg;
          totalCount++;
        } else {
          seriesData[`S${termIndex + 1}`] = null;
        }
      });

      const average = totalCount > 0 ? totalSum / totalCount : 0;
      const grade = average >= 75 ? 'A' : average >= 65 ? 'B' : average >= 50 ? 'C' : average >= 40 ? 'D' : 'F';

      return { sn: index + 1, name: className, seriesData, average, grade };
    }).sort((a, b) => b.average - a.average)
      .map((item, index) => ({ ...item, position: index + 1, sn: index + 1 }));
  }, [sectionMarks, uniqueClasses, uniqueTerms]);

  const averagePerSeries = useMemo(() => {
    const result: { [key: string]: number } = {};
    uniqueTerms.forEach((term, termIndex) => {
      const termMarks = sectionMarks.filter(m => m.term === term);
      if (termMarks.length > 0) {
        result[`S${termIndex + 1}`] = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
      }
    });
    return result;
  }, [sectionMarks, uniqueTerms]);

  // Subject performance for selected class
  const classMarksOnly = useMemo(() => sectionMarks.filter(m => m.class === selectedClass), [sectionMarks, selectedClass]);
  
  const validSubjectsForClass = useMemo(() => {
    const subjectIdsWithMarks = [...new Set(classMarksOnly.map(m => m.subject_id))];
    return (allSubjects as any[]).filter(s => subjectIdsWithMarks.includes(s.id));
  }, [allSubjects, classMarksOnly]);

  const classSeriesLabels = useMemo(() => uniqueTerms.map(term => getTestDisplayName(term, selectedClass)), [uniqueTerms, selectedClass]);

  const subjectSummaryData = useMemo(() => {
    if (!selectedClass || validSubjectsForClass.length === 0) return [];
    return validSubjectsForClass.map((subject, index) => {
      const seriesData: { [key: string]: number | null } = {};
      let totalSum = 0, totalCount = 0;

      uniqueTerms.forEach((term) => {
        const termLabel = getTestDisplayName(term, selectedClass);
        const termMarks = classMarksOnly.filter(m => m.subject_id === subject.id && m.term === term);
        if (termMarks.length > 0) {
          const avg = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
          seriesData[termLabel] = Math.round(avg);
          totalSum += avg;
          totalCount++;
        } else {
          seriesData[termLabel] = null;
        }
      });

      const average = totalCount > 0 ? totalSum / totalCount : 0;
      const grade = average >= 75 ? 'A' : average >= 65 ? 'B' : average >= 50 ? 'C' : average >= 40 ? 'D' : 'F';
      return { sn: index + 1, name: subject.name, seriesData, average, grade };
    }).sort((a, b) => b.average - a.average)
      .map((item, index) => ({ ...item, position: index + 1, sn: index + 1 }));
  }, [classMarksOnly, validSubjectsForClass, uniqueTerms, selectedClass]);

  const subjectAveragePerSeries = useMemo(() => {
    const result: { [key: string]: number } = {};
    uniqueTerms.forEach((term) => {
      const termLabel = getTestDisplayName(term, selectedClass);
      const termMarks = classMarksOnly.filter(m => m.term === term);
      if (termMarks.length > 0) {
        result[termLabel] = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
      }
    });
    return result;
  }, [classMarksOnly, uniqueTerms, selectedClass]);

  // Feedback for my section
  const { data: allFeedback = [] } = useQuery({
    queryKey: ['head-feedback', user?.role],
    queryFn: async () => {
      if (!user) return [];
      const [feedbackResult, studentsResult] = await Promise.all([
        secureQuery('feedback', user.role, user.id, { orderBy: { column: 'created_at', ascending: false } }),
        secureQuery('students', user.role, user.id),
      ]);
      const feedbacks = feedbackResult?.success ? feedbackResult.data : [];
      const students = studentsResult?.success ? studentsResult.data : [];
      const myStudentIds = new Set(
        students.filter((s: any) => isClassInSection(s.class, myBaseClasses)).map((s: any) => s.id)
      );
      return feedbacks.filter((f: any) => myStudentIds.has(f.student_id)).map((f: any) => {
        const student = students.find((s: any) => s.id === f.student_id);
        return { ...f, studentName: student?.full_name || 'Student', studentClass: student?.class || '' };
      });
    },
    enabled: !!user,
  });

  const handleMarkReviewed = async (feedbackId: string) => {
    await update('feedback', { status: 'reviewed' }, { id: feedbackId });
  };

  const handleDownloadReport = async () => {
    if (!user || !selectedYear) return;
    try {
      setGeneratingReport(true);
      const [studentsResult, marksResult, subjectsResult] = await Promise.all([
        secureQuery('students', user.role, user.id, { filters: { class: reportClass }, select: 'id, full_name, gender, roll_number, class, stream' }),
        secureQuery('marks', user.role, user.id, { filters: { class: reportClass, term: reportTerm, academic_year: selectedYear }, range: { from: 0, to: 9999 } }),
        secureQuery('subjects', user.role, user.id),
      ]);
      const students = studentsResult?.success ? studentsResult.data : [];
      const marks = marksResult?.success ? marksResult.data : [];
      const subjects = subjectsResult?.success ? subjectsResult.data : [];
      if (!students?.length) { toast.error(`No students found for ${reportClass}`); return; }
      if (!marks?.length) { toast.error(`No marks found for ${reportClass} - ${reportTerm}`); return; }
      if (reportFormat === 'pdf') {
        await generateAnnualExamReportPDF(reportClass, reportTerm, selectedYear, students, marks, subjects);
      } else {
        generateAnnualExamReport(reportClass, reportTerm, selectedYear, students, marks, subjects);
      }
      toast.success('Report downloaded!');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handlePreviewReport = async () => {
    if (!user || !selectedYear || !reportClass) return;
    setLoadingPreview(true);
    try {
      const [studentsResult, marksResult, subjectsResult] = await Promise.all([
        secureQuery('students', user.role, user.id, { filters: { class: reportClass }, select: 'id, full_name, gender, roll_number, class, stream' }),
        secureQuery('marks', user.role, user.id, { filters: { class: reportClass, term: reportTerm, academic_year: selectedYear }, range: { from: 0, to: 9999 } }),
        secureQuery('subjects', user.role, user.id),
      ]);
      const students = studentsResult?.success ? studentsResult.data : [];
      const marks = marksResult?.success ? marksResult.data : [];
      const subjects = subjectsResult?.success ? subjectsResult.data : [];
      if (!students?.length || !marks?.length) {
        toast.error('No data found for preview');
        return;
      }
      setPreviewData({ students, marks, subjects });
      setShowPreview(true);
    } catch (error) {
      toast.error('Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Pending unlock requests count
  const pendingUnlocks = unlockRequests.filter((r: any) => r.status === 'pending').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white drop-shadow-md">{label}</h1>
          <p className="text-white/80 mt-1">Head of School Dashboard</p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[140px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {academicYears.map((year) => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Students" value={String(sectionStudents.length)} subtitle={label} icon={GraduationCap} variant="primary" bgStyle="silk" />
        <StatCard title="Classes" value={String(uniqueClasses.length)} subtitle="With marks data" icon={BookOpen} variant="accent" bgStyle="cherries" />
        <StatCard title="Unlock Requests" value={String(pendingUnlocks)} subtitle="Pending" icon={KeyRound} variant="warning" bgStyle="silk" />
        <StatCard title="Feedback" value={String(allFeedback.filter(f => f.status === 'pending').length)} subtitle="Pending" icon={MessageSquare} variant="success" bgStyle="cherries" />
      </div>

      {/* Series Summary */}
      {classSummaryData.length > 0 && seriesLabels.length > 0 && (
        <SeriesSummaryTable
          title={`SUMMARY OF SERIES - ${label.toUpperCase()}`}
          subtitle={`Academic Year: ${selectedYear}`}
          data={classSummaryData}
          seriesLabels={seriesLabels}
          showPosition={true}
          showAveragePerSeries={true}
          averagePerSeries={averagePerSeries}
          pdfFileName={`${role}_series_summary_${selectedYear}`}
        />
      )}

      {/* Subject Performance */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Subject Performance by Class
          </h3>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {myBaseClasses.map((cls) => (
                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {subjectSummaryData.length > 0 && classSeriesLabels.length > 0 && (
          <SeriesSummaryTable
            title={`SUBJECT SUMMARY - ${selectedClass.toUpperCase()}`}
            subtitle={`Academic Year: ${selectedYear}`}
            data={subjectSummaryData}
            seriesLabels={classSeriesLabels}
            showPosition={true}
            showAveragePerSeries={true}
            averagePerSeries={subjectAveragePerSeries}
            pdfFileName={`subject_summary_${selectedClass}_${selectedYear}`}
          />
        )}

        {subjectSummaryData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{marksLoading ? 'Loading...' : `No marks data for ${selectedClass}`}</p>
          </div>
        )}
      </div>

      {/* Result Approval - scoped to my classes */}
      <ResultApprovalManager selectedYear={selectedYear} filterClasses={myBaseClasses} />

      {/* Annual Report */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          Annual Examination Results
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Class</label>
            <Select value={reportClass} onValueChange={(v) => { setReportClass(v); setReportTerm(getTestsForClass(v)[0]?.value || 'Series 1'); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {myBaseClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{getFilterLabel(reportClass)}</label>
            <Select value={reportTerm} onValueChange={setReportTerm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {getTestsForClass(reportClass).map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Format</label>
            <Select value={reportFormat} onValueChange={(v) => setReportFormat(v as 'excel' | 'pdf')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">📊 Excel</SelectItem>
                <SelectItem value="pdf">📄 PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={handlePreviewReport} disabled={loadingPreview}>
              {loadingPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Preview
            </Button>
          </div>
          <div className="flex items-end">
            <Button className="btn-gradient w-full" onClick={handleDownloadReport} disabled={generatingReport}>
              {generatingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      {showPreview && previewData && (
        <AnnualReportPreview
          open={showPreview}
          onClose={() => setShowPreview(false)}
          onDownload={(format) => {
            setReportFormat(format);
            handleDownloadReport();
          }}
          className={reportClass}
          term={reportTerm}
          academicYear={selectedYear}
          students={previewData.students}
          marks={previewData.marks}
          subjects={previewData.subjects}
        />
      )}

      {/* Feedback */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          Feedback ({label})
        </h3>
        {allFeedback.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No feedback yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {allFeedback.map((fb: any) => (
              <div key={fb.id} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{fb.studentName}</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{fb.studentClass}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{fb.message}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${fb.status === 'pending' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>
                      {fb.status}
                    </span>
                  </div>
                  {fb.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => handleMarkReviewed(fb.id)}>
                      Mark Reviewed
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg text-card-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/subjects')}>
            <BookOpen className="w-6 h-6" />
            <span>Manage Subjects</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/reports')}>
            <FileText className="w-6 h-6" />
            <span>Reports</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/unlock-requests')}>
            <KeyRound className="w-6 h-6" />
            <span>Unlock Requests</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/feedback')}>
            <MessageSquare className="w-6 h-6" />
            <span>Feedback</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
