import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { SeriesSummaryTable } from '@/components/dashboard/SeriesSummaryTable';
import { Users, GraduationCap, BookOpen, MessageSquare, FileText, DollarSign, Clock, CheckCircle, User, Calendar, UserCog, Download, Loader2, Eye, Briefcase } from 'lucide-react';
import { AccountantDashboard } from '@/components/dashboards/AccountantDashboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { classes } from '@/data/mockData';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureData } from '@/hooks/useSecureData';
import { getTestDisplayName, getTestsForClass, getFilterLabel } from '@/utils/seniorGrading';
import { generateAnnualExamReport } from '@/utils/annualReportGenerator';
import { generateAnnualExamReportPDF } from '@/utils/annualReportPdfGenerator';
import { toast } from 'sonner';
import { AnnualReportPreview } from '@/components/dashboard/AnnualReportPreview';
import { SecretaryDashboard } from '@/components/dashboards/SecretaryDashboard';
import { ResultApprovalManager } from '@/components/dashboard/ResultApprovalManager';

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

interface FeePayment {
  id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  term: string;
  academic_year: string;
  studentName?: string;
  studentClass?: string;
}

// Helper function to invoke secure query edge function
async function secureQuery(table: string, userRole: string, userId: string, options?: { 
  filters?: Record<string, unknown>; 
  select?: string; 
  limit?: number;
  range?: { from: number; to: number };
  orderBy?: { column: string; ascending?: boolean };
  countOnly?: boolean;
}) {
  const { data, error } = await supabase.functions.invoke('data-query', {
    body: {
      table,
      userRole,
      userId,
      ...options,
    },
  });
  
  if (error) {
    console.error(`Secure query error for ${table}:`, error);
    return { success: false, data: null, count: 0, error };
  }
  
  return data;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { update } = useSecureData();
  const { academicYears, currentYear, loading: yearsLoading } = useAcademicYears();
  const [selectedYear, setSelectedYear] = useState('');
  const [adminMode, setAdminMode] = useState<'overview' | 'accountant'>('overview');
  const [selectedClass, setSelectedClass] = useState(classes[0]);
  const [reportClass, setReportClass] = useState(classes[0]);
  const [reportTerm, setReportTerm] = useState('Series 1');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportFormat, setReportFormat] = useState<'excel' | 'pdf'>('excel');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ students: any[]; marks: any[]; subjects: any[] } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  // Set initial year when academic years load
  useEffect(() => {
    if (currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);

  // Fetch all subjects via edge function
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['all-subjects', user?.role],
    queryFn: async () => {
      if (!user) return [];
      const result = await secureQuery('subjects', user.role, user.id, { select: 'id, name, code' });
      return result?.success ? result.data : [];
    },
    enabled: !!user,
  });

  // Fetch all marks for series summary via edge function with pagination
  const { data: allMarks = [], isLoading: marksLoading } = useQuery({
    queryKey: ['admin-all-marks', selectedYear, user?.role],
    queryFn: async () => {
      if (!selectedYear || !user) return [];
      
      const allData: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;
      let retries = 0;

      while (hasMore) {
        try {
          const result = await secureQuery('marks', user.role, user.id, {
            filters: { academic_year: selectedYear },
            range: { from: page * pageSize, to: (page + 1) * pageSize - 1 },
            orderBy: { column: 'id', ascending: true },
          });
          
          if (result?.success && result.data && result.data.length > 0) {
            allData.push(...result.data);
            page++;
            retries = 0;
            hasMore = result.data.length === pageSize;
          } else if (!result?.success && retries < 2) {
            retries++;
            console.warn(`Retrying marks page ${page}, attempt ${retries}`);
            continue;
          } else {
            hasMore = false;
          }
        } catch (err) {
          console.error(`Error fetching marks page ${page}:`, err);
          if (retries < 2) { retries++; continue; }
          hasMore = false;
        }
      }
      
      console.log(`Admin: Fetched ${allData.length} total marks for ${selectedYear}`);
      return allData;
    },
    enabled: !!selectedYear && !!user,
    staleTime: 0,
  });

  // Get unique classes and terms
  const uniqueClasses = useMemo(() => {
    const classes = [...new Set(allMarks.map(m => m.class))];
    return classes.sort();
  }, [allMarks]);

  const uniqueTerms = useMemo(() => {
    const terms = [...new Set(allMarks.map(m => m.term))];
    return terms.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [allMarks]);

  // Generate series labels (S1, S2, etc.) from terms
  const seriesLabels = useMemo(() => {
    return uniqueTerms.map((term) => `S${uniqueTerms.indexOf(term) + 1}`);
  }, [uniqueTerms]);

  // Class-specific series labels for subject performance
  const classSeriesLabels = useMemo(() => {
    return uniqueTerms.map((term) => getTestDisplayName(term, selectedClass));
  }, [uniqueTerms, selectedClass]);

  // Calculate class-based series summary data
  const classSummaryData = useMemo(() => {
    return uniqueClasses.map((className, index) => {
      const classMarks = allMarks.filter(m => m.class === className);
      
      const seriesData: { [key: string]: number | null } = {};
      let totalSum = 0;
      let totalCount = 0;

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

      return {
        sn: index + 1,
        name: className,
        seriesData,
        average,
        grade,
      };
    }).sort((a, b) => b.average - a.average)
      .map((item, index) => ({ ...item, position: index + 1, sn: index + 1 }));
  }, [allMarks, uniqueClasses, uniqueTerms]);

  // Calculate average per series across all classes
  const averagePerSeries = useMemo(() => {
    const result: { [key: string]: number } = {};
    
    uniqueTerms.forEach((term, termIndex) => {
      const termMarks = allMarks.filter(m => m.term === term);
      if (termMarks.length > 0) {
        const avg = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
        result[`S${termIndex + 1}`] = avg;
      }
    });

    return result;
  }, [allMarks, uniqueTerms]);

  // Get subjects that actually have marks for the selected class
  const classMarksOnly = useMemo(() => {
    return allMarks.filter(m => m.class === selectedClass);
  }, [allMarks, selectedClass]);

  // Get unique subject IDs that have marks for this class
  const validSubjectsForClass = useMemo(() => {
    const subjectIdsWithMarks = [...new Set(classMarksOnly.map(m => m.subject_id))];
    return (allSubjects as any[]).filter(s => subjectIdsWithMarks.includes(s.id));
  }, [allSubjects, classMarksOnly]);

  // Filter marks for selected class
  const classFilteredMarks = useMemo(() => {
    return classMarksOnly;
  }, [classMarksOnly]);

  // Subject performance data for selected class
  const subjectSummaryData = useMemo(() => {
    if (!selectedClass || validSubjectsForClass.length === 0) return [];

    return validSubjectsForClass.map((subject, index) => {
      const seriesData: { [key: string]: number | null } = {};
      let totalSum = 0;
      let totalCount = 0;

      uniqueTerms.forEach((term, termIndex) => {
        const label = getTestDisplayName(term, selectedClass);
        const termMarks = classFilteredMarks.filter(m => 
          m.subject_id === subject.id && 
          m.term === term
        );
        if (termMarks.length > 0) {
          const avg = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
          seriesData[label] = Math.round(avg);
          totalSum += avg;
          totalCount++;
        } else {
          seriesData[label] = null;
        }
      });

      const average = totalCount > 0 ? totalSum / totalCount : 0;
      const grade = average >= 75 ? 'A' : average >= 65 ? 'B' : average >= 50 ? 'C' : average >= 40 ? 'D' : 'F';

      return {
        sn: index + 1,
        name: subject.name,
        seriesData,
        average,
        grade,
      };
    }).sort((a, b) => b.average - a.average)
      .map((item, index) => ({ ...item, position: index + 1, sn: index + 1 }));
  }, [classFilteredMarks, validSubjectsForClass, uniqueTerms, selectedClass]);

  // Average per series for selected class subjects
  const subjectAveragePerSeries = useMemo(() => {
    const result: { [key: string]: number } = {};
    
    uniqueTerms.forEach((term, termIndex) => {
      const label = getTestDisplayName(term, selectedClass);
      const termMarks = classFilteredMarks.filter(m => m.term === term);
      if (termMarks.length > 0) {
        const avg = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
        result[label] = avg;
      }
    });

    return result;
  }, [classFilteredMarks, uniqueTerms]);

  // Fetch counts via edge function
  const { data: studentsCount = 0 } = useQuery({
    queryKey: ['students-count', user?.role],
    queryFn: async () => {
      if (!user) return 0;
      const result = await secureQuery('students', user.role, user.id, { countOnly: true });
      return result?.success ? result.count : 0;
    },
    enabled: !!user,
  });

  const { data: teachersCount = 0 } = useQuery({
    queryKey: ['teachers-count', user?.role],
    queryFn: async () => {
      if (!user) return 0;
      const result = await secureQuery('teachers', user.role, user.id, { countOnly: true });
      return result?.success ? result.count : 0;
    },
    enabled: !!user,
  });

  const { data: secretariesCount = 0 } = useQuery({
    queryKey: ['secretaries-count', user?.role],
    queryFn: async () => {
      if (!user) return 0;
      const result = await secureQuery('secretary_credentials_public', user.role, user.id, { countOnly: true });
      return result?.success ? result.count : 0;
    },
    enabled: !!user,
  });

  const { data: feedbackCount = 0 } = useQuery({
    queryKey: ['feedback-pending-count', user?.role],
    queryFn: async () => {
      if (!user) return 0;
      const result = await secureQuery('feedback', user.role, user.id, { 
        countOnly: true,
        filters: { status: 'pending' }
      });
      return result?.success ? result.count : 0;
    },
    enabled: !!user,
  });

  // Fetch all feedback with details
  const { data: allFeedback = [] } = useQuery({
    queryKey: ['admin-all-feedback', user?.role],
    queryFn: async () => {
      if (!user) return [];
      
      const [feedbackResult, parentsResult, studentsResult] = await Promise.all([
        secureQuery('feedback', user.role, user.id, { orderBy: { column: 'created_at', ascending: false } }),
        secureQuery('parents', user.role, user.id),
        secureQuery('students', user.role, user.id, { select: 'id, full_name, class' }),
      ]);

      const feedbackData = feedbackResult?.success ? feedbackResult.data : [];
      const parentsData = parentsResult?.success ? parentsResult.data : [];
      const studentsData = studentsResult?.success ? studentsResult.data : [];

      return (feedbackData || []).map((fb: any) => {
        const parent = parentsData?.find((p: any) => p.id === fb.parent_id);
        const student = studentsData?.find((s: any) => s.id === fb.student_id);
        return {
          ...fb,
          recipient_type: fb.recipient_type || 'teacher',
          parentName: parent?.full_name || 'Parent',
          studentName: student?.full_name || 'Student',
          studentClass: student?.class || ''
        };
      }) as FeedbackItem[];
    },
    enabled: !!user,
  });

  // Fetch fee payments summary - filtered by selected year
  const { data: feePayments = [] } = useQuery({
    queryKey: ['admin-fee-payments', selectedYear, user?.role],
    queryFn: async () => {
      if (!user) return [];
      
      const filters: Record<string, unknown> = {};
      if (selectedYear) {
        filters.academic_year = selectedYear;
      }
      
      const [paymentsResult, studentsResult] = await Promise.all([
        secureQuery('fee_payments', user.role, user.id, {
          filters,
          orderBy: { column: 'payment_date', ascending: false },
          limit: 20,
        }),
        secureQuery('students', user.role, user.id, { select: 'id, full_name, class' }),
      ]);

      const paymentsData = paymentsResult?.success ? paymentsResult.data : [];
      const studentsData = studentsResult?.success ? studentsResult.data : [];

      return (paymentsData || []).map((fp: any) => {
        const student = studentsData?.find((s: any) => s.id === fp.student_id);
        return {
          ...fp,
          studentName: student?.full_name || 'Student',
          studentClass: student?.class || ''
        };
      }) as FeePayment[];
    },
    enabled: !!user,
  });

  // Calculate fee totals - filtered by selected year
  const { data: feeTotals } = useQuery({
    queryKey: ['admin-fee-totals', selectedYear, user?.role],
    queryFn: async () => {
      if (!user) return { totalCollected: 0 };
      
      const filters: Record<string, unknown> = {};
      if (selectedYear) {
        filters.academic_year = selectedYear;
      }
      
      const result = await secureQuery('fee_payments', user.role, user.id, {
        select: 'amount',
        filters,
      });
      
      const paymentsData = result?.success ? result.data : [];
      const totalCollected = (paymentsData || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      return { totalCollected };
    },
    enabled: !!user,
  });

  const teacherFeedback = allFeedback.filter(f => f.recipient_type === 'teacher');
  const secretaryFeedback = allFeedback.filter(f => f.recipient_type === 'secretary');

  const handleMarkReviewed = async (feedbackId: string) => {
    await update('feedback', { status: 'reviewed' }, { id: feedbackId });
  };

  const handleDownloadAnnualReport = async () => {
    if (!user || !selectedYear) return;
    try {
      setGeneratingReport(true);

      // Fetch students for the selected class
      const studentsResult = await secureQuery('students', user.role, user.id, {
        filters: { class: reportClass },
        select: 'id, full_name, gender, roll_number, class, stream',
      });
      const students = studentsResult?.success ? studentsResult.data : [];

      if (!students || students.length === 0) {
        toast.error(`Hakuna wanafunzi kwa ${reportClass}`);
        return;
      }

      // Fetch marks for the selected class/term/year
      const marksResult = await secureQuery('marks', user.role, user.id, {
        filters: { class: reportClass, term: reportTerm, academic_year: selectedYear },
        range: { from: 0, to: 9999 },
      });
      const marks = marksResult?.success ? marksResult.data : [];

      if (!marks || marks.length === 0) {
        toast.error(`Hakuna marks kwa ${reportClass} - ${reportTerm}`);
        return;
      }

      // Fetch subjects
      const subjectsResult = await secureQuery('subjects', user.role, user.id);
      const subjects = subjectsResult?.success ? subjectsResult.data : [];

      if (reportFormat === 'pdf') {
        await generateAnnualExamReportPDF(reportClass, reportTerm, selectedYear, students, marks, subjects);
      } else {
        generateAnnualExamReport(reportClass, reportTerm, selectedYear, students, marks, subjects);
      }
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Report generation error:', error);
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handlePreviewReport = async () => {
    if (!user || !selectedYear) return;
    try {
      setLoadingPreview(true);

      const [studentsResult, marksResult, subjectsResult] = await Promise.all([
        secureQuery('students', user.role, user.id, {
          filters: { class: reportClass },
          select: 'id, full_name, gender, roll_number, class, stream',
        }),
        secureQuery('marks', user.role, user.id, {
          filters: { class: reportClass, term: reportTerm, academic_year: selectedYear },
          range: { from: 0, to: 9999 },
        }),
        secureQuery('subjects', user.role, user.id),
      ]);

      const students = studentsResult?.success ? studentsResult.data : [];
      const marks = marksResult?.success ? marksResult.data : [];
      const subjects = subjectsResult?.success ? subjectsResult.data : [];

      if (!students?.length) { toast.error(`No students found for ${reportClass}`); return; }
      if (!marks?.length) { toast.error(`No marks found for ${reportClass} - ${reportTerm}`); return; }

      setPreviewData({ students, marks, subjects });
      setShowPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to load report preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white drop-shadow-md">Dashboard</h1>
          <p className="text-white/80 mt-1">Welcome! Here is your school overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-background/80 backdrop-blur-sm rounded-lg p-1">
            <Button
              variant={adminMode === 'overview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setAdminMode('overview')}
              className="text-xs"
            >
              <GraduationCap className="w-3.5 h-3.5 mr-1" />
              Overview
            </Button>
            <Button
              variant={adminMode === 'accountant' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setAdminMode('accountant')}
              className="text-xs"
            >
              <Briefcase className="w-3.5 h-3.5 mr-1" />
              Accountant Ops
            </Button>
            <Button
              variant={adminMode === 'secretary' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setAdminMode('secretary')}
              className="text-xs"
            >
              <Briefcase className="w-3.5 h-3.5 mr-1" />
              Secretary Ops
            </Button>
          </div>
          {adminMode === 'overview' && (
        </div>
      </div>

      {adminMode === 'secretary' ? (
        <SecretaryDashboard isAdminMode={true} />
      ) : (
      <>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Students" value={studentsCount.toLocaleString()} subtitle="All classes" icon={GraduationCap} variant="primary" bgStyle="silk" />
        <StatCard title="Teachers" value={teachersCount.toLocaleString()} subtitle="All teachers" icon={Users} variant="accent" bgStyle="cherries" />
        <StatCard title="Secretaries" value={secretariesCount.toLocaleString()} subtitle="All secretaries" icon={UserCog} variant="success" bgStyle="silk" />
        <StatCard title="Feedback" value={feedbackCount.toLocaleString()} subtitle="Pending response" icon={MessageSquare} variant="warning" bgStyle="cherries" />
      </div>

      {/* Series Summary Table - Class Average Per Series */}
      {classSummaryData.length > 0 && seriesLabels.length > 0 && (
        <SeriesSummaryTable
          title="SUMMARY OF SERIES - ALL CLASSES"
          subtitle={`Academic Year: ${selectedYear} | Class Average Per Series`}
          data={classSummaryData}
          seriesLabels={seriesLabels}
          showPosition={true}
          showAveragePerSeries={true}
          averagePerSeries={averagePerSeries}
          pdfFileName={`class_series_summary_${selectedYear}`}
        />
      )}

      {/* Subject Performance per Class */}
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
              {classes.map((cls) => (
                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          Showing {validSubjectsForClass.length} subjects for {selectedClass}
        </div>

        {/* Subject Summary Table for Selected Class */}
        {subjectSummaryData.length > 0 && classSeriesLabels.length > 0 && (
          <SeriesSummaryTable
            title={`SUBJECT SUMMARY - ${selectedClass.toUpperCase()}`}
            subtitle={`Academic Year: ${selectedYear} | Subject Average Per Series`}
            data={subjectSummaryData}
            seriesLabels={classSeriesLabels}
            showPosition={true}
            showAveragePerSeries={true}
            averagePerSeries={subjectAveragePerSeries}
            pdfFileName={`subject_series_summary_${selectedClass}_${selectedYear}`}
          />
        )}

        {subjectSummaryData.length === 0 && marksLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
            <p>Loading marks data...</p>
          </div>
        )}

        {subjectSummaryData.length === 0 && !marksLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No marks data available for {selectedClass}</p>
          </div>
        )}
      </div>

      {/* Result Approval Section */}
      <ResultApprovalManager selectedYear={selectedYear} />

      {/* Fee Overview */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-success" />
            Fee Overview
          </h3>
          <Button variant="outline" size="sm" onClick={() => navigate('/records')}>
            View All
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-success/10">
            <p className="text-sm text-muted-foreground">Total Collected ({selectedYear})</p>
            <p className="text-2xl font-bold text-success">TZS {(feeTotals?.totalCollected || 0).toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-lg bg-primary/10">
            <p className="text-sm text-muted-foreground">Recent Payments</p>
            <p className="text-2xl font-bold text-primary">{feePayments.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-accent/10">
            <p className="text-sm text-muted-foreground">Students</p>
            <p className="text-2xl font-bold text-accent">{studentsCount}</p>
          </div>
        </div>

        {feePayments.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-3">Recent Payments</p>
            {feePayments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{payment.studentName}</p>
                  <p className="text-xs text-muted-foreground">{payment.studentClass} • {new Date(payment.payment_date).toLocaleDateString()}</p>
                </div>
                <p className="font-bold text-success">TZS {Number(payment.amount).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Parent Feedback */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          All Parent Feedback
        </h3>
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All ({allFeedback.length})</TabsTrigger>
            <TabsTrigger value="teacher">To Teachers ({teacherFeedback.length})</TabsTrigger>
            <TabsTrigger value="secretary">To Secretary ({secretaryFeedback.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-4">
            <FeedbackList feedback={allFeedback} onMarkReviewed={handleMarkReviewed} />
          </TabsContent>
          
          <TabsContent value="teacher" className="mt-4">
            <FeedbackList feedback={teacherFeedback} onMarkReviewed={handleMarkReviewed} />
          </TabsContent>
          
          <TabsContent value="secretary" className="mt-4">
            <FeedbackList feedback={secretaryFeedback} onMarkReviewed={handleMarkReviewed} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Annual Exam Report Download */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          Annual Examination Results
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download the complete class results report including Result Summary, individual subject marks, grades, positions{' '}
          and divisions (Senior only). Choose format: Excel or PDF.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Class</label>
            <Select value={reportClass} onValueChange={(v) => { setReportClass(v); setReportTerm(getTestsForClass(v)[0]?.value || 'Series 1'); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{getFilterLabel(reportClass)}</label>
            <Select value={reportTerm} onValueChange={setReportTerm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">📊 Excel (.xlsx)</SelectItem>
                <SelectItem value="pdf">📄 PDF (.pdf)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handlePreviewReport}
              disabled={loadingPreview || generatingReport}
            >
              {loadingPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Preview
            </Button>
            <Button
              className="btn-gradient flex-1"
              onClick={handleDownloadAnnualReport}
              disabled={generatingReport || loadingPreview}
            >
              {generatingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download {reportFormat === 'pdf' ? 'PDF' : 'Excel'}
            </Button>
          </div>
        </div>

        {/* Report Preview Dialog */}
        {previewData && (
          <AnnualReportPreview
            open={showPreview}
            onClose={() => setShowPreview(false)}
            onDownload={(format) => {
              setReportFormat(format);
              setShowPreview(false);
              setTimeout(() => handleDownloadAnnualReport(), 100);
            }}
            className={reportClass}
            term={reportTerm}
            academicYear={selectedYear}
            students={previewData.students}
            marks={previewData.marks}
            subjects={previewData.subjects}
          />
        )}
      </div>

      {/* Quick Actions */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg text-card-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/reports')}>
            <FileText className="w-6 h-6" />
            <span>Generate Reports</span>
            <span className="text-xs text-muted-foreground">Academic reports</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/users')}>
            <User className="w-6 h-6" />
            <span>Manage Users</span>
            <span className="text-xs text-muted-foreground">Teachers, Secretaries, Parents</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/feedback')}>
            <MessageSquare className="w-6 h-6" />
            <span>View Feedback</span>
            <span className="text-xs text-muted-foreground">{feedbackCount} pending response</span>
          </Button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function FeedbackList({ feedback, onMarkReviewed }: { feedback: FeedbackItem[]; onMarkReviewed: (id: string) => void }) {
  if (feedback.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No feedback yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {feedback.map((fb) => (
        <div key={fb.id} className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{fb.parentName}</span>
                <span className="text-xs text-muted-foreground">about</span>
                <span className="font-medium">{fb.studentName}</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{fb.studentClass}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{fb.message}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                <span className={`px-2 py-0.5 rounded ${fb.status === 'pending' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>
                  {fb.status}
                </span>
                <span className="px-2 py-0.5 rounded bg-accent/20 text-accent">
                  To: {fb.recipient_type}
                </span>
              </div>
            </div>
            {fb.status === 'pending' && (
              <Button size="sm" variant="outline" onClick={() => onMarkReviewed(fb.id)}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark Reviewed
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
