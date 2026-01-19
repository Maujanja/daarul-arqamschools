import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { SeriesSummaryTable } from '@/components/dashboard/SeriesSummaryTable';
import { Users, GraduationCap, BookOpen, MessageSquare, FileText, DollarSign, Clock, CheckCircle, User, Calendar, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { classes } from '@/data/mockData';
import { isSubjectForClass, getSubjectsForClass } from '@/utils/classSubjects';
import { useAcademicYears } from '@/hooks/useAcademicYears';
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

export function AdminDashboard() {
  const navigate = useNavigate();
  const { academicYears, currentYear, loading: yearsLoading } = useAcademicYears();
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState(classes[0]);

  // Set initial year when academic years load
  useEffect(() => {
    if (currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);

  // Fetch all subjects
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['all-subjects'],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('id, name, code');
      return data || [];
    },
  });

  // Fetch all marks for series summary (with subject_id for filtering)
  // Use pagination to get all data since Supabase has response size limits
  const { data: allMarks = [] } = useQuery({
    queryKey: ['admin-all-marks', selectedYear],
    queryFn: async () => {
      if (!selectedYear) return [];
      
      const allData: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('marks')
          .select('class, term, total, academic_year, subject_id')
          .eq('academic_year', selectedYear)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('Error fetching marks:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allData.push(...data);
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`Fetched ${allData.length} marks for ${selectedYear}`);
      return allData;
    },
    enabled: !!selectedYear,
  });

  // Get unique classes and terms
  const uniqueClasses = useMemo(() => {
    const classes = [...new Set(allMarks.map(m => m.class))];
    return classes.sort();
  }, [allMarks]);

  const uniqueTerms = useMemo(() => {
    const terms = [...new Set(allMarks.map(m => m.term))];
    // Sort terms by number (Term 1, Term 2, etc.)
    return terms.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [allMarks]);

  // Generate series labels (S1, S2, etc.) from terms
  const seriesLabels = useMemo(() => {
    return uniqueTerms.map((_, index) => `S${index + 1}`);
  }, [uniqueTerms]);

  // Calculate class-based series summary data
  const classSummaryData = useMemo(() => {
    return uniqueClasses.map((className, index) => {
      const classMarks = allMarks.filter(m => m.class === className);
      
      // Calculate average per series/term for this class
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


  // Get subjects that actually have marks for the selected class (instead of filtering by isSubjectForClass)
  const classMarksOnly = useMemo(() => {
    return allMarks.filter(m => m.class === selectedClass);
  }, [allMarks, selectedClass]);

  // Get unique subject IDs that have marks for this class
  const validSubjectsForClass = useMemo(() => {
    const subjectIdsWithMarks = [...new Set(classMarksOnly.map(m => m.subject_id))];
    return allSubjects.filter(s => subjectIdsWithMarks.includes(s.id));
  }, [allSubjects, classMarksOnly]);

  // Filter marks for selected class - use all marks for this class
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
        const termMarks = classFilteredMarks.filter(m => 
          m.subject_id === subject.id && 
          m.term === term
        );
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
      const termMarks = classFilteredMarks.filter(m => m.term === term);
      if (termMarks.length > 0) {
        const avg = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
        result[`S${termIndex + 1}`] = avg;
      }
    });

    return result;
  }, [classFilteredMarks, uniqueTerms]);

  const { data: studentsCount = 0 } = useQuery({
    queryKey: ['students-count'],
    queryFn: async () => {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: teachersCount = 0 } = useQuery({
    queryKey: ['teachers-count'],
    queryFn: async () => {
      const { count } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: secretariesCount = 0 } = useQuery({
    queryKey: ['secretaries-count'],
    queryFn: async () => {
      const { count } = await supabase.from('secretary_credentials').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: feedbackCount = 0 } = useQuery({
    queryKey: ['feedback-pending-count'],
    queryFn: async () => {
      const { count } = await supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      return count || 0;
    },
  });

  // Fetch all feedback with details
  const { data: allFeedback = [] } = useQuery({
    queryKey: ['admin-all-feedback'],
    queryFn: async () => {
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: parentsData } = await supabase.from('parents').select('id, full_name');
      const { data: studentsData } = await supabase.from('students').select('id, full_name, class');

      return (feedbackData || []).map(fb => {
        const parent = parentsData?.find(p => p.id === fb.parent_id);
        const student = studentsData?.find(s => s.id === fb.student_id);
        return {
          ...fb,
          recipient_type: fb.recipient_type || 'teacher',
          parentName: parent?.full_name || 'Parent',
          studentName: student?.full_name || 'Student',
          studentClass: student?.class || ''
        };
      }) as FeedbackItem[];
    },
  });

  // Fetch fee payments summary - filtered by selected year
  const { data: feePayments = [] } = useQuery({
    queryKey: ['admin-fee-payments', selectedYear],
    queryFn: async () => {
      let query = supabase
        .from('fee_payments')
        .select('*')
        .order('payment_date', { ascending: false })
        .limit(20);
      
      if (selectedYear) {
        query = query.eq('academic_year', selectedYear);
      }
      
      const { data: paymentsData } = await query;

      const { data: studentsData } = await supabase.from('students').select('id, full_name, class');

      return (paymentsData || []).map(fp => {
        const student = studentsData?.find(s => s.id === fp.student_id);
        return {
          ...fp,
          studentName: student?.full_name || 'Student',
          studentClass: student?.class || ''
        };
      }) as FeePayment[];
    },
  });

  // Calculate fee totals - filtered by selected year
  const { data: feeTotals } = useQuery({
    queryKey: ['admin-fee-totals', selectedYear],
    queryFn: async () => {
      let query = supabase.from('fee_payments').select('amount');
      if (selectedYear) {
        query = query.eq('academic_year', selectedYear);
      }
      const { data: paymentsData } = await query;
      const totalCollected = (paymentsData || []).reduce((sum, p) => sum + Number(p.amount), 0);
      return { totalCollected };
    },
  });

  const teacherFeedback = allFeedback.filter(f => f.recipient_type === 'teacher');
  const secretaryFeedback = allFeedback.filter(f => f.recipient_type === 'secretary');

  const handleMarkReviewed = async (feedbackId: string) => {
    await supabase
      .from('feedback')
      .update({ status: 'reviewed' })
      .eq('id', feedbackId);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome! Here is your school overview.</p>
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
        <StatCard title="Students" value={studentsCount.toLocaleString()} subtitle="All classes" icon={GraduationCap} variant="primary" />
        <StatCard title="Teachers" value={teachersCount.toLocaleString()} subtitle="All teachers" icon={Users} variant="accent" />
        <StatCard title="Secretaries" value={secretariesCount.toLocaleString()} subtitle="All secretaries" icon={UserCog} variant="success" />
        <StatCard title="Feedback" value={feedbackCount.toLocaleString()} subtitle="Pending response" icon={MessageSquare} variant="warning" />
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
        {subjectSummaryData.length > 0 && seriesLabels.length > 0 && (
          <SeriesSummaryTable
            title={`SUBJECT SUMMARY - ${selectedClass.toUpperCase()}`}
            subtitle={`Academic Year: ${selectedYear} | Subject Average Per Series`}
            data={subjectSummaryData}
            seriesLabels={seriesLabels}
            showPosition={true}
            showAveragePerSeries={true}
            averagePerSeries={subjectAveragePerSeries}
            pdfFileName={`subject_series_summary_${selectedClass}_${selectedYear}`}
          />
        )}

        {subjectSummaryData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No marks data available for {selectedClass}</p>
          </div>
        )}
      </div>

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
            <div className="divide-y divide-border max-h-48 overflow-y-auto">
              {feePayments.slice(0, 5).map(payment => (
                <div key={payment.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-card-foreground">{payment.studentName}</p>
                    <p className="text-xs text-muted-foreground">{payment.studentClass} • {payment.term} {payment.academic_year}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-success">TZS {Number(payment.amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString('en-US')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feedback Overview with Tabs */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          All Parent Feedback
        </h3>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">All ({allFeedback.length})</TabsTrigger>
            <TabsTrigger value="teacher">To Teachers ({teacherFeedback.length})</TabsTrigger>
            <TabsTrigger value="secretary">To Secretary ({secretaryFeedback.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-0">
            <FeedbackList feedback={allFeedback} onMarkReviewed={handleMarkReviewed} />
          </TabsContent>

          <TabsContent value="teacher" className="space-y-0">
            <FeedbackList feedback={teacherFeedback} onMarkReviewed={handleMarkReviewed} />
          </TabsContent>

          <TabsContent value="secretary" className="space-y-0">
            <FeedbackList feedback={secretaryFeedback} onMarkReviewed={handleMarkReviewed} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Actions */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={() => navigate('/reports')} className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-left">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
            <div><p className="font-medium text-card-foreground">Generate Reports</p><p className="text-xs text-muted-foreground">Academic reports</p></div>
          </button>
          <button onClick={() => navigate('/users')} className="flex items-center gap-3 p-4 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors text-left">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center"><Users className="w-5 h-5 text-accent" /></div>
            <div><p className="font-medium text-card-foreground">Manage Users</p><p className="text-xs text-muted-foreground">Teachers, Secretaries, Parents</p></div>
          </button>
          <button onClick={() => navigate('/feedback')} className="flex items-center gap-3 p-4 rounded-lg bg-success/5 hover:bg-success/10 transition-colors text-left">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><MessageSquare className="w-5 h-5 text-success" /></div>
            <div><p className="font-medium text-card-foreground">View Feedback</p><p className="text-xs text-muted-foreground">{feedbackCount} pending response</p></div>
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackList({ feedback, onMarkReviewed }: { feedback: FeedbackItem[], onMarkReviewed: (id: string) => void }) {
  if (feedback.length === 0) {
    return (
      <div className="p-8 text-center">
        <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No feedback yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border max-h-96 overflow-y-auto">
      {feedback.map((fb) => (
        <div key={fb.id} className="py-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium text-card-foreground">{fb.parentName}</p>
                  <p className="text-sm text-muted-foreground">
                    Student: {fb.studentName} ({fb.studentClass})
                  </p>
                  <p className="text-xs mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      fb.recipient_type === 'teacher' 
                        ? 'bg-accent/10 text-accent' 
                        : 'bg-warning/10 text-warning'
                    }`}>
                      To: {fb.recipient_type === 'teacher' ? 'Teacher' : 'Secretary'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {fb.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                      <Clock className="w-3 h-3" />Pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                      <CheckCircle className="w-3 h-3" />Reviewed
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-card-foreground">{fb.message}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {new Date(fb.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                {fb.status === 'pending' && (
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => onMarkReviewed(fb.id)}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Mark Reviewed
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}