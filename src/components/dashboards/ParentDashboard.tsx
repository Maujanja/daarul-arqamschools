import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { SeriesSummaryTable } from '@/components/dashboard/SeriesSummaryTable';
import { SeriesPerformanceChart } from '@/components/dashboard/SeriesPerformanceChart';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BookOpen, Award, Download, MessageSquare, Loader2, DollarSign, AlertTriangle, TrendingUp, TrendingDown, Megaphone, User, Calendar, FileDown, Trophy, Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { terms } from '@/data/mockData';
import { isSeniorClass, isPrimaryClass, calculateDivision, calculateGradeForClass, getTestDisplayName, getTestsForClass, getFilterLabel, getDivisionBgColor } from '@/utils/seniorGrading';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

interface StudentMark {
  subject: string;
  subject_id: string;
  term: string;
  academic_year: string;
  exam: number;
  total: number;
  grade: string;
}

interface FeePayment {
  amount: number;
  payment_date: string;
  payment_method: string;
}

interface FeeStructure {
  total_fee: number;
  boarding_type: string;
}

interface FeeInstallment {
  installment_number: number;
  amount: number;
  due_date: string;
}

interface StudentCustomInstallment {
  installment_number: number;
  amount: number;
  due_date: string;
  notes: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  academic_year: string;
  visibility_type: string;
  expires_at: string | null;
}

interface SubjectRanking {
  subject: string;
  subject_id: string;
  score: number;
  grade: string;
  rank: number;
  totalStudents: number;
  complete: boolean; // true when all class students have marks for this subject
}

interface DebtHistory {
  id: string;
  academic_year: string;
  term: string;
  original_amount: number;
  amount_paid: number;
  outstanding_balance: number;
  is_cleared: boolean;
}

export function ParentDashboard() {
  // Helper: check if a term matches considering aliases (Series X ↔ Test X)
  const termMatches = (markTerm: string, selectedTerm: string): boolean => {
    if (markTerm === selectedTerm) return true;
    const seriesMatch = selectedTerm.match(/^Series\s+(\d+)$/i);
    if (seriesMatch) return markTerm === `Test ${seriesMatch[1]}`;
    const testMatch = selectedTerm.match(/^Test\s+(\d+)$/i);
    if (testMatch) return markTerm === `Series ${testMatch[1]}`;
    return false;
  };

  const { user } = useAuth();
  const { fetchTable } = useSecureQuery();
  const { academicYears, currentYear, loading: yearsLoading } = useAcademicYears();
  const [isLoading, setIsLoading] = useState(true);
  const [childName, setChildName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [childBoardingType, setChildBoardingType] = useState('day');
  const [childStream, setChildStream] = useState<string | null>(null);
  const [studentId, setStudentId] = useState('');
  const [studentAvatarUrl, setStudentAvatarUrl] = useState<string | null>(null);
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [allMarks, setAllMarks] = useState<StudentMark[]>([]);
  const [overallAverage, setOverallAverage] = useState(0);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [expectedFee, setExpectedFee] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(terms[0] || 'Series 1');
  const [selectedYear, setSelectedYear] = useState('');
  const [classRank, setClassRank] = useState<number | null>(null);
  const [totalClassStudents, setTotalClassStudents] = useState(0);
  const [subjectRankings, setSubjectRankings] = useState<SubjectRanking[]>([]);
  const [historicalDebts, setHistoricalDebts] = useState<DebtHistory[]>([]);
  const [classRankComplete, setClassRankComplete] = useState(false);
  const [installments, setInstallments] = useState<(FeeInstallment | StudentCustomInstallment)[]>([]);
  const [dueInstallmentAmount, setDueInstallmentAmount] = useState(0);
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  
  // Chart refs for capturing as images
  const subjectChartRef = useRef<HTMLDivElement>(null);
  const gradeChartRef = useRef<HTMLDivElement>(null);

  // Calculate class rank and subject rankings
  const calculateRankings = useCallback(async (studentId: string, studentClass: string, term: string, year: string) => {
    console.log('calculateRankings called with:', { studentId, studentClass, term, year });
    
    // Get all marks for students in the same class for the selected term/year
    const classMarks = await fetchTable<any>('marks', { 
      class: studentClass, 
      term: term, 
      academic_year: year 
    });
    
    // Get subjects for name lookup
    const subjects = await fetchTable<any>('subjects');
    
    // Get all students in this class to check completeness
    const classStudents = await fetchTable<any>('students', { class: studentClass });
    const totalStudentsInClass = classStudents?.length || 0;

    // Get assigned subjects for this class from teacher_assignments to know expected subject count
    const classAssignments = await fetchTable<any>('teacher_assignments', {
      class: studentClass,
      academic_year: year
    });
    const assignedSubjectIds = new Set(classAssignments?.map((a: any) => a.subject_id) || []);
    const expectedSubjectCount = assignedSubjectIds.size;

    console.log('Class marks for ranking:', { classMarks, count: classMarks?.length, totalStudentsInClass, expectedSubjectCount });

    if (!classMarks || classMarks.length === 0) {
      setClassRank(null);
      setTotalClassStudents(0);
      setSubjectRankings([]);
      setClassRankComplete(false);
      return;
    }

    const subjectMap = new Map(subjects?.map((s: any) => [s.id, s.name]) || []);

    // Calculate average for each student
    const studentAverages: Record<string, { total: number; count: number }> = {};
    classMarks.forEach((mark: any) => {
      if (!studentAverages[mark.student_id]) {
        studentAverages[mark.student_id] = { total: 0, count: 0 };
      }
      studentAverages[mark.student_id].total += mark.total;
      studentAverages[mark.student_id].count += 1;
    });

    // Use expected subjects from teacher_assignments (not just what's in marks)
    const totalSubjects = expectedSubjectCount > 0 ? expectedSubjectCount : new Set(classMarks.map((m: any) => m.subject_id)).size;

    // Check if ALL students in the class have marks for ALL assigned subjects
    const studentsWithMarks = Object.keys(studentAverages);
    const allStudentsHaveAllSubjects = totalStudentsInClass > 0 &&
      expectedSubjectCount > 0 &&
      studentsWithMarks.length >= totalStudentsInClass &&
      studentsWithMarks.every(sid => studentAverages[sid].count >= totalSubjects);
    
    setClassRankComplete(allStudentsHaveAllSubjects);

    // Sort students by average
    const rankedStudents = Object.entries(studentAverages)
      .map(([id, data]) => ({
        studentId: id,
        average: data.total / data.count
      }))
      .sort((a, b) => b.average - a.average);

    const studentRankIndex = rankedStudents.findIndex(s => s.studentId === studentId);
    
    if (studentRankIndex !== -1) {
      setClassRank(studentRankIndex + 1);
      setTotalClassStudents(rankedStudents.length);
    } else {
      setClassRank(null);
      setTotalClassStudents(rankedStudents.length);
    }

    // Calculate subject-wise rankings
    const subjectScores: Record<string, { studentId: string; score: number; grade: string; subjectName: string }[]> = {};
    classMarks.forEach((mark: any) => {
      const subjectId = mark.subject_id;
      if (!subjectScores[subjectId]) {
        subjectScores[subjectId] = [];
      }
      // Recalculate grade using class-appropriate scale instead of stored grade
      const recalculatedGrade = mark.total > 0 
        ? calculateGradeForClass((mark.total / 100) * 100, studentClass) 
        : '-';
      subjectScores[subjectId].push({
        studentId: mark.student_id,
        score: mark.total,
        grade: recalculatedGrade,
        subjectName: subjectMap.get(mark.subject_id) || 'Unknown'
      });
    });

    // Calculate rank for each subject, with completeness check
    const rankings: SubjectRanking[] = [];
    Object.entries(subjectScores).forEach(([subjectId, scores]) => {
      const sorted = [...scores].sort((a, b) => b.score - a.score);
      const studentScore = sorted.find(s => s.studentId === studentId);
      
      // Subject is complete when all students in class have marks for it
      const subjectComplete = totalStudentsInClass > 0 && sorted.length >= totalStudentsInClass;
      
      if (studentScore) {
        const rank = sorted.findIndex(s => s.studentId === studentId) + 1;
        rankings.push({
          subject: studentScore.subjectName,
          subject_id: subjectId,
          score: studentScore.score,
          grade: studentScore.grade,
          rank,
          totalStudents: sorted.length,
          complete: subjectComplete
        });
      }
    });

    rankings.sort((a, b) => b.score - a.score);
    setSubjectRankings(rankings);
  }, [fetchTable]);

  // Set initial year when academic years load
  useEffect(() => {
    if (currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);

  useEffect(() => {
    const fetchChildData = async () => {
      if (!user || !selectedYear) return;
      
      setIsLoading(true);
      
      try {
        // Use secure query to fetch students - this will be filtered based on user role
        const studentsData = await fetchTable<any>('students');
        
        // Find the student - either by matching ID or parent_id
        let studentData = studentsData?.find((s: any) => s.id === user.id);
        
        if (!studentData) {
          studentData = studentsData?.find((s: any) => s.parent_id === user.id);
        }
        
        // Fallback: search by user name in parents table
        if (!studentData) {
          const parentsData = await fetchTable<any>('parents');
          const parentRecord = parentsData?.find((p: any) => 
            p.full_name?.toLowerCase().includes(user.name?.toLowerCase() || '')
          );
          
          if (parentRecord) {
            studentData = studentsData?.find((s: any) => s.parent_id === parentRecord.id);
          }
        }
        
        if (!studentData) {
          setIsLoading(false);
          return;
        }
        
        setChildName(studentData.full_name);
        setChildClass(studentData.class);
        setChildStream(studentData.stream || null);
        setChildBoardingType(studentData.boarding_type || 'day');
        setStudentId(studentData.id);
        setStudentAvatarUrl(studentData.avatar_url || null);
        
        // Get marks for this student using secure query
        const marksData = await fetchTable<any>('marks', { student_id: studentData.id });
        
        // Get subjects for name lookup
        const subjectsData = await fetchTable<any>('subjects');
      
        // Build subject name lookup
        const subjectMap = new Map(subjectsData?.map((s: any) => [s.id, s.name]) || []);
        
        if (marksData) {
          const formattedMarks = marksData.map((m: any) => ({
            subject: subjectMap.get(m.subject_id) || 'Unknown',
            subject_id: m.subject_id,
            term: m.term,
            academic_year: m.academic_year,
            exam: m.exam,
            total: m.total,
            // Recalculate grade using class-appropriate scale
            grade: m.total > 0 ? calculateGradeForClass(m.total, studentData.class) : '-',
          }));
          setAllMarks(formattedMarks);
          
          // Filter by selected term and year (with term aliasing)
          const filtered = formattedMarks.filter(
            (m: any) => termMatches(m.term, selectedTerm) && m.academic_year === selectedYear
          );
          setStudentMarks(filtered);
          
          if (filtered.length > 0) {
            const avg = filtered.reduce((sum: number, m: any) => sum + m.total, 0) / filtered.length;
            setOverallAverage(avg);
          } else {
            setOverallAverage(0);
          }
        }

        // Calculate class rank and subject rankings
        await calculateRankings(studentData.id, studentData.class, selectedTerm, selectedYear);
        
        // Get fee payments for this student using secure query
        const allPayments = await fetchTable<any>('fee_payments', { student_id: studentData.id });
        const payments = allPayments?.filter((p: any) => 
          p.academic_year === selectedYear
        ) || [];
        
        if (payments.length > 0) {
          setFeePayments(payments);
          const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          setPaidAmount(totalPaid);
        } else {
          setFeePayments([]);
          setPaidAmount(0);
        }
        
        // Fetch installments - check for custom installments first, then class installments
        const customInstallments = await fetchTable<StudentCustomInstallment>('student_custom_installments', {
          student_id: studentData.id,
          academic_year: selectedYear,
        });
        
        let studentInstallments: (FeeInstallment | StudentCustomInstallment)[] = [];
        
        if (customInstallments && customInstallments.length > 0) {
          // Special case student - use custom installments
          studentInstallments = customInstallments;
          const totalCustomFee = customInstallments.reduce((sum, ci) => sum + Number(ci.amount), 0);
          setExpectedFee(totalCustomFee);
        } else {
          // Regular student - use class-level installments
          const classInstallments = await fetchTable<FeeInstallment>('fee_installments', {
            class: studentData.class,
            boarding_type: studentData.boarding_type || 'day',
            academic_year: selectedYear,
          });
          
          if (classInstallments && classInstallments.length > 0) {
            studentInstallments = classInstallments;
            const totalFee = classInstallments.reduce((sum, ci) => sum + Number(ci.amount), 0);
            setExpectedFee(totalFee);
          } else {
            // Fallback to fee_structure
            if (studentData.custom_fee !== null && studentData.custom_fee !== undefined) {
              setExpectedFee(Number(studentData.custom_fee));
            } else {
              const { data: feeStructure } = await supabase
                .from('fee_structure')
                .select('total_fee, boarding_type')
                .eq('class', studentData.class)
                .eq('boarding_type', studentData.boarding_type || 'day')
                .eq('academic_year', selectedYear)
                .eq('term', 'Annual')
                .maybeSingle();
              
              if (feeStructure) {
                setExpectedFee(Number(feeStructure.total_fee));
              } else {
                setExpectedFee(0);
              }
            }
          }
        }
        
        setInstallments(studentInstallments);
        
        // Calculate due installment amount - show only the NEXT unpaid installment
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const totalPaidSoFar = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        
        const sortedInstallments = [...studentInstallments]
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        
        // Find the first unpaid installment (cumulative amount > paid)
        let cumulativeAmount = 0;
        let nextDueInstallmentAmount = 0;
        for (const inst of sortedInstallments) {
          cumulativeAmount += Number(inst.amount);
          if (cumulativeAmount > totalPaidSoFar) {
            // This installment is not fully paid - show its amount as "current due"
            nextDueInstallmentAmount = Number(inst.amount);
            break;
          }
        }
        
        setDueInstallmentAmount(nextDueInstallmentAmount);
        
        // Fetch historical debts using secure query
        const debtsData = await fetchTable<any>('student_debt_history', { 
          student_id: studentData.id, 
          is_cleared: false 
        });
        
        if (debtsData) {
          setHistoricalDebts(debtsData);
        } else {
          setHistoricalDebts([]);
        }
        
        // Fetch announcements - uses publicly readable table
        const now = new Date().toISOString();
        const { data: announcementsData } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .eq('academic_year', selectedYear)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (announcementsData) {
          setAnnouncements(announcementsData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchChildData();
  }, [user, selectedTerm, selectedYear, fetchTable, calculateRankings]);

  // Update filtered marks and rankings when term/year changes
  useEffect(() => {
    if (allMarks.length > 0) {
      const filtered = allMarks.filter(
        m => termMatches(m.term, selectedTerm) && m.academic_year === selectedYear
      );
      setStudentMarks(filtered);
      
      if (filtered.length > 0) {
        const avg = filtered.reduce((sum, m) => sum + m.total, 0) / filtered.length;
        setOverallAverage(avg);
      } else {
        setOverallAverage(0);
      }
    }
    
    // Recalculate rankings when term/year changes
    if (studentId && childClass) {
      calculateRankings(studentId, childClass, selectedTerm, selectedYear);
    }
  }, [selectedTerm, selectedYear, allMarks, studentId, childClass]);

  const balance = expectedFee - paidAmount;

  // Get unique subjects
  const uniqueSubjects = [...new Set(studentMarks.map(m => m.subject))];
  
  // Calculate subject averages
  const subjectAverages = uniqueSubjects.map(subject => {
    const subjectMarks = studentMarks.filter(m => m.subject === subject);
    const avg = subjectMarks.reduce((sum, m) => sum + m.total, 0) / subjectMarks.length;
    return { subject, average: Math.round(avg * 10) / 10 };
  }).sort((a, b) => b.average - a.average);

  // Top subject
  const topSubject = subjectAverages[0];
  
  // Subject needing support (lowest)
  const needSupportSubject = subjectAverages[subjectAverages.length - 1];

  // Performance data for chart
  const performanceData = subjectAverages.map(s => ({
    name: s.subject.slice(0, 8),
    score: s.average,
  }));


  // Grade distribution for pie chart
  const gradeDistribution = subjectAverages.reduce((acc, s) => {
    const grade = calculateGradeForClass(s.average, childClass);
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.entries(gradeDistribution).map(([grade, count]) => ({
    name: `Grade ${grade}`,
    value: count,
    grade
  }));

  const GRADE_COLORS: Record<string, string> = {
    'A': 'hsl(142, 76%, 36%)',
    'B': 'hsl(199, 89%, 48%)',
    'C': 'hsl(48, 96%, 53%)',
    'D': 'hsl(25, 95%, 53%)',
    'E': 'hsl(15, 90%, 55%)',
    'F': 'hsl(0, 84%, 60%)'
  };

  // Filter marks by selected year for series summary
  const yearFilteredMarks = useMemo(() => {
    return allMarks.filter(m => m.academic_year === selectedYear);
  }, [allMarks, selectedYear]);

  // Series Summary for Student - All subjects across all terms for selected year
  const studentTerms = useMemo(() => {
    const termsSet = new Set(yearFilteredMarks.map(m => m.term));
    return Array.from(termsSet).sort((a, b) => {
      const numA = parseInt(a?.replace(/\D/g, '') || '0');
      const numB = parseInt(b?.replace(/\D/g, '') || '0');
      return numA - numB;
    });
  }, [yearFilteredMarks]);

  const studentSeriesLabels = useMemo(() => {
    return studentTerms.map((term) => getTestDisplayName(term, childClass));
  }, [studentTerms, childClass]);

  // Series summary for student's subjects
  const studentSubjectSummary = useMemo(() => {
    const subjectsMap = new Map<string, { name: string; marks: { term: string; total: number }[] }>();
    
    yearFilteredMarks.forEach(mark => {
      if (!subjectsMap.has(mark.subject_id)) {
        subjectsMap.set(mark.subject_id, { name: mark.subject, marks: [] });
      }
      subjectsMap.get(mark.subject_id)?.marks.push({ term: mark.term, total: mark.total });
    });

    return Array.from(subjectsMap.entries()).map(([subjectId, data], index) => {
      const seriesData: { [key: string]: number | null } = {};
      let totalSum = 0;
      let totalCount = 0;

      studentTerms.forEach((term, termIndex) => {
        const label = getTestDisplayName(term, childClass);
        const mark = data.marks.find(m => m.term === term);
        if (mark) {
          seriesData[label] = mark.total;
          totalSum += mark.total;
          totalCount++;
        } else {
          seriesData[label] = null;
        }
      });

      const average = totalCount > 0 ? totalSum / totalCount : 0;
      const grade = average > 0 ? calculateGradeForClass(average, childClass) : '-';

      return {
        sn: index + 1,
        name: data.name,
        seriesData,
        average,
        grade,
      };
    }).sort((a, b) => b.average - a.average)
      .map((item, index) => ({ ...item, position: index + 1, sn: index + 1 }));
  }, [yearFilteredMarks, studentTerms]);

  // Average per series for student
  const studentAveragePerSeries = useMemo(() => {
    const result: { [key: string]: number } = {};
    
    studentTerms.forEach((term, termIndex) => {
      const label = getTestDisplayName(term, childClass);
      const termMarks = yearFilteredMarks.filter(m => m.term === term);
      if (termMarks.length > 0) {
        const avg = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
        result[label] = avg;
      }
    });

    return result;
  }, [yearFilteredMarks, studentTerms, childClass]);


  // Download Subject Performance PDF with chart image
  const handleDownloadSubjectPerformance = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Subject Performance Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Student: ${childName}`, 20, 35);
    doc.text(`Class: ${childClass}`, 20, 43);
    doc.text(`Term: ${selectedTerm} - ${selectedYear}`, 20, 51);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 59);
    
    // Capture chart as image
    if (subjectChartRef.current) {
      try {
        const canvas = await html2canvas(subjectChartRef.current, {
          backgroundColor: '#ffffff',
          scale: 2
        });
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 15, 70, 180, 100);
      } catch (error) {
        console.error('Error capturing chart:', error);
      }
    }
    
    // Subject table below chart
    const tableData = subjectAverages.map(s => {
      const grade = calculateGradeForClass(s.average, childClass);
      return [s.subject, `${s.average}%`, grade];
    });
    
    autoTable(doc, {
      head: [['Subject', 'Average', 'Grade']],
      body: tableData,
      startY: 180,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save(`${childName}_subject_performance.pdf`);
  };


  // Download Grade Distribution PDF with chart image
  const handleDownloadGradeDistribution = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Grade Distribution Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Student: ${childName}`, 20, 35);
    doc.text(`Class: ${childClass}`, 20, 43);
    doc.text(`Term: ${selectedTerm} - ${selectedYear}`, 20, 51);
    doc.text(`Overall Average: ${overallAverage.toFixed(1)}%`, 20, 59);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 67);
    
    // Capture chart as image
    if (gradeChartRef.current) {
      try {
        const canvas = await html2canvas(gradeChartRef.current, {
          backgroundColor: '#ffffff',
          scale: 2
        });
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 15, 80, 180, 100);
      } catch (error) {
        console.error('Error capturing chart:', error);
      }
    }
    
    // Grade distribution table below chart
    const gradeLabels = isPrimaryClass(childClass) 
      ? ['A (81-100%)', 'B (61-80%)', 'C (41-60%)', 'D (21-40%)', 'E (0-20%)']
      : ['A (75-100%)', 'B (65-74%)', 'C (45-64%)', 'D (30-44%)', 'F (0-29%)'];
    const tableData = Object.entries(gradeDistribution).map(([grade, count]) => {
      const label = gradeLabels.find(l => l.startsWith(grade)) || grade;
      return [label, count.toString(), `${Math.round((count / subjectAverages.length) * 100)}%`];
    });
    
    autoTable(doc, {
      head: [['Grade Range', 'Number of Subjects', 'Percentage']],
      body: tableData,
      startY: 190,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] }
    });
    
    doc.save(`${childName}_grade_distribution.pdf`);
  };

  // Download PDF report (main report)
  const handleDownloadReport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Student Academic Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Student: ${childName}`, 20, 40);
    doc.text(`Class: ${childClass}`, 20, 50);
    doc.text(`Academic Year: 2024-2025`, 20, 60);
    
    // Subject Performance Table
    doc.setFontSize(14);
    doc.text('Subject Performance', 20, 80);
    
    const tableData = subjectAverages.map(s => {
      const grade = calculateGradeForClass(s.average, childClass);
      return [s.subject, `${s.average}%`, grade];
    });
    
    autoTable(doc, {
      head: [['Subject', 'Average', 'Grade']],
      body: tableData,
      startY: 85,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    // Summary
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(12);
    doc.text(`Overall Average: ${overallAverage.toFixed(1)}%`, 20, finalY + 15);
    doc.text(`Top Subject: ${topSubject?.subject || '-'} (${topSubject?.average || 0}%)`, 20, finalY + 25);
    doc.text(`Needs Support: ${needSupportSubject?.subject || '-'} (${needSupportSubject?.average || 0}%)`, 20, finalY + 35);
    
    doc.save(`${childName}_report.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!childName) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Parent Dashboard</h1>
          <p className="text-muted-foreground mt-1">No student is linked to your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Student Profile Hero Section - Picha juu kabisa */}
      <div className="card-elevated p-6 animate-fade-in bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Large Student Avatar */}
          <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-xl">
            <AvatarImage src={studentAvatarUrl || undefined} alt={childName} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-4xl font-bold">
              {childName.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          
          {/* Student Name and Info */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-primary drop-shadow-sm">{childName}</h2>
            <p className="text-muted-foreground mt-1">
              Class {childClass}{childStream ? ` ${childStream}` : ''} • {childBoardingType === 'boarding' ? 'Boarding' : 'Day'} Student
            </p>
          </div>
          
          {/* Overall Average Badge */}
          {studentMarks.length > 0 && (
            <div className="flex items-center gap-4 mt-2 flex-wrap justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Overall Average</p>
                <p className="text-4xl font-bold font-display gradient-text">{overallAverage.toFixed(1)}%</p>
                <GradeBadge grade={calculateGradeForClass(overallAverage, childClass)} size="lg" />
              </div>
              {classRank && (
                <div className="text-center border-l border-border pl-4">
                  <p className="text-sm text-muted-foreground">Class Rank</p>
                  <p className="text-3xl font-bold font-display text-primary">{classRank}/{totalClassStudents}</p>
                  {classRank === 1 && <span className="text-xs text-success font-medium">🏆 Top of Class!</span>}
                </div>
              )}
              {isSeniorClass(childClass) && studentMarks.length >= 7 && (() => {
                const scores = studentMarks.map(m => m.total);
                const { division, totalPoints } = calculateDivision(scores);
                return (
                  <div className="text-center border-l border-border pl-4">
                    <p className="text-sm text-muted-foreground">Division</p>
                    <p className={`text-3xl font-bold font-display ${getDivisionBgColor(division).split(' ').find(c => c.startsWith('text-'))}`}>
                      {division}
                    </p>
                    <span className="text-xs text-muted-foreground">Points: {totalPoints}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white drop-shadow-md">Parent Dashboard</h1>
          <p className="text-white/80 mt-1 drop-shadow-sm">
            Viewing records for <span className="font-semibold text-sky-300 drop-shadow-md">{childName}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.href = '/feedback'}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Send Feedback
          </Button>
          <Button className="btn-gradient" onClick={handleDownloadReport}>
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Term and Year Filters */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-4 text-card-foreground">Filter Results</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{childClass ? getFilterLabel(childClass) : 'Series'}</label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger>
                <SelectValue placeholder="Select series" />
              </SelectTrigger>
              <SelectContent>
                {childClass ? getTestsForClass(childClass).map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                )) : terms.map((term) => (
                  <SelectItem key={term} value={term}>{term}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Academic Year</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Academic sections - always visible when student has marks */}
      {studentMarks.length > 0 ? (<>
      {/* 1. Subject Analysis & Class Ranking */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Subject Analysis & Class Ranking
        </h3>
        {subjectRankings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Score</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Grade</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Class Rank</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {subjectRankings.map((item, index) => {
                  const isTop = index === 0;
                  const isFirst = item.rank === 1;
                   const supportThreshold = isPrimaryClass(childClass) ? 41 : 45;
                   const needsSupport = index === subjectRankings.length - 1 && item.score < supportThreshold;
                  
                  return (
                    <tr key={item.subject_id} className="border-b border-border/50 table-row-hover">
                      <td className="py-4 px-4 font-medium text-card-foreground">{item.subject}</td>
                      <td className="py-4 px-4 text-center font-semibold text-card-foreground">{item.score}%</td>
                      <td className="py-4 px-4 text-center">
                        <GradeBadge grade={item.grade} />
                      </td>
                      <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                            item.rank === 1 ? 'bg-yellow-500/10 text-yellow-600' :
                            item.rank <= 3 ? 'bg-primary/10 text-primary' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {item.rank === 1 && <Trophy className="w-3 h-3" />}
                            {item.rank}/{item.totalStudents}
                          </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isFirst && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600">
                            <Trophy className="w-3 h-3" />
                            1st in Class
                          </span>
                        )}
                        {isTop && !isFirst && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                            <TrendingUp className="w-3 h-3" />
                            Best Subject
                          </span>
                        )}
                        {needsSupport && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                            <AlertTriangle className="w-3 h-3" />
                            Needs Support
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : subjectAverages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Average</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Grade</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {subjectAverages.map((item, index) => {
                   const grade = calculateGradeForClass(item.average, childClass);
                   const isTop = index === 0;
                   const supportThreshold = isPrimaryClass(childClass) ? 41 : 45;
                   const needsSupport = index === subjectAverages.length - 1 && item.average < supportThreshold;
                  
                  return (
                    <tr key={item.subject} className="border-b border-border/50 table-row-hover">
                      <td className="py-4 px-4 font-medium text-card-foreground">{item.subject}</td>
                      <td className="py-4 px-4 text-center font-semibold text-card-foreground">{item.average}%</td>
                      <td className="py-4 px-4 text-center">
                        <GradeBadge grade={grade} />
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isTop && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                            <TrendingUp className="w-3 h-3" />
                            Top Subject
                          </span>
                        )}
                        {needsSupport && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                            <AlertTriangle className="w-3 h-3" />
                            Needs Support
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No subject data available yet</p>
        )}
      </div>

      {/* 2. Subject Performance Overview */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground">
            Subject Performance Overview
          </h3>
          {performanceData.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDownloadSubjectPerformance}>
              <FileDown className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          )}
        </div>
        {performanceData.length > 0 ? (
          <div ref={subjectChartRef} className="h-80 bg-white dark:bg-gray-900 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No marks recorded yet for this student</p>
        )}
      </div>

      {/* 3. Grade Distribution Pie Chart */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground">
            Grade Distribution
          </h3>
          {pieChartData.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDownloadGradeDistribution}>
              <FileDown className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          )}
        </div>
        {pieChartData.length > 0 ? (
          <div ref={gradeChartRef} className="h-80 bg-white dark:bg-gray-900 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GRADE_COLORS[entry.grade] || '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No grade data available yet</p>
        )}
      </div>

      {/* 4. Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard
            title="Class Rank"
            value={classRank ? `${classRank}/${totalClassStudents}` : '-'}
            subtitle={classRank ? (classRank === 1 ? 'Top of class!' : classRank <= 3 ? 'Top 3!' : 'Overall position') : 'Not available'}
            icon={Trophy}
            variant={classRank ? (classRank === 1 ? 'success' : classRank <= 3 ? 'primary' : 'default') : 'default'}
            bgStyle="silk"
          />
        <StatCard
          title="Subjects"
          value={uniqueSubjects.length.toString()}
          subtitle="Registered subjects"
          icon={BookOpen}
          variant="primary"
          bgStyle="cherries"
        />
        <StatCard
          title="Top Subject"
          value={topSubject?.subject || '-'}
          subtitle={topSubject ? `${topSubject.average}%` : '-'}
          icon={TrendingUp}
          variant="success"
          bgStyle="silk"
        />
        <StatCard
          title="Needs Support"
          value={needSupportSubject?.subject || '-'}
          subtitle={needSupportSubject ? `${needSupportSubject.average}%` : '-'}
          icon={TrendingDown}
          variant="warning"
          bgStyle="cherries"
        />
        <StatCard
          title="Installment Due"
          value={dueInstallmentAmount > 0 ? `TZS ${(dueInstallmentAmount / 1000000).toFixed(1)}M` : 'None'}
          subtitle={dueInstallmentAmount > 0 ? 'Current dues' : 'No dues now'}
          icon={DollarSign}
          variant={dueInstallmentAmount > 0 ? 'warning' : 'success'}
          bgStyle="silk"
        />
      </div>

      {/* 5. Summary of Series */}
      {studentSubjectSummary.length > 0 && studentSeriesLabels.length > 0 && (
        <SeriesSummaryTable
          title={`SUMMARY OF SERIES - ${childName.toUpperCase()}`}
          subtitle={`Class: ${childClass} | All Series Results`}
          data={studentSubjectSummary}
          seriesLabels={studentSeriesLabels}
          showPosition={true}
          showAveragePerSeries={true}
          averagePerSeries={studentAveragePerSeries}
          pdfFileName={`${childName.replace(/\s+/g, '_')}_series_summary`}
        />
      )}

      {/* 6. Grade Performance Trend */}
      {Object.keys(studentAveragePerSeries).length > 0 && (
        <SeriesPerformanceChart
          data={Object.entries(studentAveragePerSeries).map(([series, avg]) => ({
            name: series,
            Average: Number(avg.toFixed(1))
          }))}
          title="Grade Performance Trend"
          seriesKeys={['Average']}
          pdfFileName={`${childName}_series_performance.pdf`}
        />
      )}
      </>) : (
        <div className="card-elevated p-6 animate-fade-in text-center">
          <div className="py-12">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">No Results Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              No marks have been recorded for this series yet. Results will appear here once teachers enter marks.
            </p>
          </div>
        </div>
      )}

      {/* 7. Fee Status - Installment Based */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Fee Status - {selectedYear}
        </h3>
        {expectedFee > 0 || paidAmount > 0 ? (
          <>
            {/* Installment-based debt display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Annual Fee (Total)</p>
                <p className="text-2xl font-bold text-card-foreground">
                  {expectedFee > 0 ? `TZS ${expectedFee.toLocaleString()}` : 'Not Set'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-success/10">
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-success">TZS {paidAmount.toLocaleString()}</p>
              </div>
              <div className={`p-4 rounded-lg ${dueInstallmentAmount > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
                <p className="text-sm text-muted-foreground">Current Due (Installments)</p>
                <p className={`text-2xl font-bold ${dueInstallmentAmount > 0 ? 'text-destructive' : 'text-success'}`}>
                  {dueInstallmentAmount > 0 ? `TZS ${dueInstallmentAmount.toLocaleString()}` : 'No dues'}
                </p>
              </div>
            </div>

            {/* Installment breakdown */}
            {installments.length > 0 && (() => {
              const sortedInsts = [...installments].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
              const isSpecialCase = sortedInsts.length > 4;
              const visibleInstallments = isSpecialCase && !showAllInstallments 
                ? sortedInsts.slice(0, 4) 
                : sortedInsts;
              
              return (
                <div className="mb-6">
                  <h4 className="font-medium text-card-foreground mb-3">Installment Schedule</h4>
                  <div className="space-y-2">
                    {visibleInstallments.map((inst, index) => {
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);
                      const dueDate = new Date(inst.due_date + 'T00:00:00');
                      const isDue = dueDate <= today;
                      
                      // Use actual index in full sorted list for cumulative calculation
                      const actualIndex = sortedInsts.findIndex(i => i === inst);
                      const cumulativeDue = sortedInsts
                        .slice(0, actualIndex + 1)
                        .reduce((sum, i) => sum + Number(i.amount), 0);
                      const isFullyPaid = paidAmount >= cumulativeDue;
                      
                      return (
                        <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
                          isFullyPaid ? 'bg-success/5 border-success/20' :
                          isDue ? 'bg-destructive/5 border-destructive/20' :
                          'bg-muted/30 border-border/50'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              isFullyPaid ? 'bg-success text-white' :
                              isDue ? 'bg-destructive/20 text-destructive' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {isFullyPaid ? '✓' : actualIndex + 1}
                            </div>
                            <div>
                              <p className={`font-medium ${isFullyPaid ? 'text-success line-through' : 'text-card-foreground'}`}>
                                TZS {Number(inst.amount).toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Due: {new Date(inst.due_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {isFullyPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                                ✓ Paid
                              </span>
                            ) : isDue ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                                Due Now
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isSpecialCase && !showAllInstallments && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 w-full text-primary"
                      onClick={() => setShowAll(true)}
                    >
                      See more installments ({sortedInsts.length - 4} more)
                    </Button>
                  )}
                  {isSpecialCase && showAllInstallments && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 w-full text-primary"
                      onClick={() => setShowAll(false)}
                    >
                      Show less
                    </Button>
                  )}
                </div>
              );
            })()}
            
            {expectedFee > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Annual Payment Progress</span>
                  <span className="font-medium text-card-foreground">
                    {Math.round((paidAmount / expectedFee) * 100)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((paidAmount / expectedFee) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {feePayments.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-card-foreground mb-4">Payment History</h4>
                <div className="space-y-3">
                  {feePayments.map((payment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <p className="font-medium text-card-foreground">TZS {Number(payment.amount).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{payment.payment_method}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No fee information available for {selectedYear}
          </p>
        )}
      </div>

      {/* Historical Debts */}
      {historicalDebts.length > 0 && (
        <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-destructive">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Outstanding Debts from Previous Periods
          </h3>
          <div className="space-y-4">
            {historicalDebts.map((debt) => (
              <div key={debt.id} className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-card-foreground">
                      {debt.academic_year} - {debt.term}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Original: TZS {Number(debt.original_amount).toLocaleString()} | 
                      Paid: TZS {Number(debt.amount_paid).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-destructive">
                      TZS {Number(debt.outstanding_balance).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="p-4 rounded-lg bg-destructive/20 border border-destructive/30">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-card-foreground">Total Outstanding Debt</p>
                <p className="text-2xl font-bold text-destructive">
                  TZS {historicalDebts.reduce((sum, d) => sum + Number(d.outstanding_balance), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. School Notices - Last */}
      <div className="card-elevated p-6 animate-fade-in overflow-hidden">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          School Notices
        </h3>
        {announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map((announcement, index) => (
              <div 
                key={announcement.id} 
                className="p-3 sm:p-4 rounded-lg bg-muted/30 border border-border/50 animate-slide-up overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h4 className="font-semibold text-card-foreground break-words overflow-wrap-anywhere">{announcement.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{announcement.content}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[100px] sm:max-w-none">{announcement.created_by}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(announcement.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No announcements at this time</p>
        )}
      </div>
    </div>
  );
}
