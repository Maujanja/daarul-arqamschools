import { useState, useEffect, useRef } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { BookOpen, Award, Download, MessageSquare, Loader2, DollarSign, AlertTriangle, TrendingUp, TrendingDown, Megaphone, User, Calendar, FileDown, Trophy, Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { terms } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
}

interface SubjectRanking {
  subject: string;
  subject_id: string;
  score: number;
  grade: string;
  rank: number;
  totalStudents: number;
}

export function ParentDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [childName, setChildName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [childBoardingType, setChildBoardingType] = useState('day');
  const [studentId, setStudentId] = useState('');
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [allMarks, setAllMarks] = useState<StudentMark[]>([]);
  const [overallAverage, setOverallAverage] = useState(0);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [expectedFee, setExpectedFee] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(terms[0] || 'Series 11');
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [classRank, setClassRank] = useState<number | null>(null);
  const [totalClassStudents, setTotalClassStudents] = useState(0);
  const [subjectRankings, setSubjectRankings] = useState<SubjectRanking[]>([]);

  // Calculate class rank and subject rankings
  const calculateRankings = async (studentId: string, studentClass: string, term: string, year: string) => {
    // Get all marks for students in the same class for the selected term/year
    const { data: classMarks } = await supabase
      .from('marks')
      .select(`
        student_id,
        subject_id,
        total,
        grade,
        subjects (name)
      `)
      .eq('class', studentClass)
      .eq('term', term)
      .eq('academic_year', year);

    if (!classMarks || classMarks.length === 0) {
      setClassRank(null);
      setTotalClassStudents(0);
      setSubjectRankings([]);
      return;
    }

    // Calculate average for each student
    const studentAverages: Record<string, { total: number; count: number }> = {};
    classMarks.forEach((mark: any) => {
      if (!studentAverages[mark.student_id]) {
        studentAverages[mark.student_id] = { total: 0, count: 0 };
      }
      studentAverages[mark.student_id].total += mark.total;
      studentAverages[mark.student_id].count += 1;
    });

    // Sort students by average
    const rankedStudents = Object.entries(studentAverages)
      .map(([id, data]) => ({
        studentId: id,
        average: data.total / data.count
      }))
      .sort((a, b) => b.average - a.average);

    // Find current student's rank
    const studentRankIndex = rankedStudents.findIndex(s => s.studentId === studentId);
    if (studentRankIndex !== -1) {
      setClassRank(studentRankIndex + 1);
      setTotalClassStudents(rankedStudents.length);
    }

    // Calculate subject-wise rankings
    const subjectScores: Record<string, { studentId: string; score: number; grade: string; subjectName: string }[]> = {};
    classMarks.forEach((mark: any) => {
      const subjectId = mark.subject_id;
      if (!subjectScores[subjectId]) {
        subjectScores[subjectId] = [];
      }
      subjectScores[subjectId].push({
        studentId: mark.student_id,
        score: mark.total,
        grade: mark.grade,
        subjectName: (mark.subjects as any)?.name || 'Unknown'
      });
    });

    // Calculate rank for each subject
    const rankings: SubjectRanking[] = [];
    Object.entries(subjectScores).forEach(([subjectId, scores]) => {
      // Sort by score descending
      const sorted = [...scores].sort((a, b) => b.score - a.score);
      const studentScore = sorted.find(s => s.studentId === studentId);
      
      if (studentScore) {
        const rank = sorted.findIndex(s => s.studentId === studentId) + 1;
        rankings.push({
          subject: studentScore.subjectName,
          subject_id: subjectId,
          score: studentScore.score,
          grade: studentScore.grade,
          rank,
          totalStudents: sorted.length
        });
      }
    });

    // Sort by score descending (best subjects first)
    rankings.sort((a, b) => b.score - a.score);
    setSubjectRankings(rankings);
  };

  useEffect(() => {
    const fetchChildData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      let studentData = null;
      
      // First check if user.id is a student ID directly (for students without parent record)
      const { data: studentById } = await supabase
        .from('students')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (studentById) {
        studentData = studentById;
      } else {
        // Then check if user.id is a parent_id
        const { data: studentByParent } = await supabase
          .from('students')
          .select('*')
          .eq('parent_id', user.id)
          .maybeSingle();
        
        if (studentByParent) {
          studentData = studentByParent;
        }
      }
      
      // Fallback: search by user name in parents table
      if (!studentData) {
        const { data: parentRecord } = await supabase
          .from('parents')
          .select('id')
          .ilike('full_name', `%${user.name}%`)
          .maybeSingle();
        
        if (parentRecord) {
          const { data: studentByParentRecord } = await supabase
            .from('students')
            .select('*')
            .eq('parent_id', parentRecord.id)
            .maybeSingle();
          
          studentData = studentByParentRecord;
        }
      }
      
      if (!studentData) {
        setIsLoading(false);
        return;
      }
      
      setChildName(studentData.full_name);
      setChildClass(studentData.class);
      setChildBoardingType(studentData.boarding_type || 'day');
      setStudentId(studentData.id);
      
      // Get marks for this student with subject details
      const { data: marksData } = await supabase
        .from('marks')
        .select(`
          exam,
          total,
          grade,
          term,
          academic_year,
          subject_id,
          subjects (name)
        `)
        .eq('student_id', studentData.id);
      
      if (marksData) {
        const formattedMarks = marksData.map((m: any) => ({
          subject: m.subjects?.name || 'Unknown',
          subject_id: m.subject_id,
          term: m.term,
          academic_year: m.academic_year,
          exam: m.exam,
          total: m.total,
          grade: m.grade,
        }));
        setAllMarks(formattedMarks);
        
        // Filter by selected term and year
        const filtered = formattedMarks.filter(
          m => m.term === selectedTerm && m.academic_year === selectedYear
        );
        setStudentMarks(filtered);
        
        if (filtered.length > 0) {
          const avg = filtered.reduce((sum, m) => sum + m.total, 0) / filtered.length;
          setOverallAverage(avg);
        } else {
          setOverallAverage(0);
        }
      }

      // Calculate class rank and subject rankings
      await calculateRankings(studentData.id, studentData.class, selectedTerm, selectedYear);
      
      // Get fee payments for this student
      const { data: payments } = await supabase
        .from('fee_payments')
        .select('amount, payment_date, payment_method')
        .eq('student_id', studentData.id);
      
      if (payments) {
        setFeePayments(payments);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        setPaidAmount(totalPaid);
      }
      
      // Get fee structure for this class and boarding type
      const { data: feeStructure } = await supabase
        .from('fee_structure')
        .select('total_fee, boarding_type')
        .eq('class', studentData.class)
        .eq('boarding_type', studentData.boarding_type || 'day')
        .maybeSingle();
      
      if (feeStructure) {
        setExpectedFee(Number(feeStructure.total_fee));
      }
      
      // Fetch announcements
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (announcementsData) {
        setAnnouncements(announcementsData);
      }
      
      setIsLoading(false);
    };
    
    fetchChildData();
  }, [user, selectedTerm, selectedYear]);

  // Update filtered marks and rankings when term/year changes
  useEffect(() => {
    if (allMarks.length > 0) {
      const filtered = allMarks.filter(
        m => m.term === selectedTerm && m.academic_year === selectedYear
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

  // Term-wise performance data (uses imported terms from mockData)
  const termPerformanceData = terms.map(term => {
    const termMarks = studentMarks.filter(m => m.term === term);
    if (termMarks.length === 0) return null;
    
    const data: any = { term };
    uniqueSubjects.forEach(subject => {
      const mark = termMarks.find(m => m.subject === subject);
      data[subject] = mark?.total || 0;
    });
    data.average = termMarks.reduce((sum, m) => sum + m.total, 0) / termMarks.length;
    return data;
  }).filter(Boolean);

  // Grade distribution for pie chart
  const gradeDistribution = subjectAverages.reduce((acc, s) => {
    const grade = s.average >= 75 ? 'A' : s.average >= 65 ? 'B' : s.average >= 50 ? 'C' : s.average >= 40 ? 'D' : 'F';
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
    'F': 'hsl(0, 84%, 60%)'
  };

  // Download Subject Performance PDF
  const handleDownloadSubjectPerformance = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Subject Performance Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Student: ${childName}`, 20, 35);
    doc.text(`Class: ${childClass}`, 20, 43);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 51);
    
    // Subject table
    const tableData = subjectAverages.map(s => {
      const grade = s.average >= 75 ? 'A' : s.average >= 65 ? 'B' : s.average >= 50 ? 'C' : s.average >= 40 ? 'D' : 'F';
      return [s.subject, `${s.average}%`, grade];
    });
    
    autoTable(doc, {
      head: [['Subject', 'Average', 'Grade']],
      body: tableData,
      startY: 60,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save(`${childName}_subject_performance.pdf`);
  };

  // Download Term Performance PDF
  const handleDownloadTermPerformance = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Term-wise Performance Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Student: ${childName}`, 20, 35);
    doc.text(`Class: ${childClass}`, 20, 43);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 51);
    
    // Term table
    const headers = ['Term', ...uniqueSubjects.slice(0, 6), 'Average'];
    const tableData = termPerformanceData.map((t: any) => {
      const row = [t.term];
      uniqueSubjects.slice(0, 6).forEach(subject => {
        row.push(t[subject] ? `${t[subject]}%` : '-');
      });
      row.push(`${Math.round(t.average)}%`);
      return row;
    });
    
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 60,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] }
    });
    
    doc.save(`${childName}_term_performance.pdf`);
  };

  // Download Grade Distribution PDF
  const handleDownloadGradeDistribution = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Grade Distribution Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Student: ${childName}`, 20, 35);
    doc.text(`Class: ${childClass}`, 20, 43);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 51);
    doc.text(`Overall Average: ${overallAverage.toFixed(1)}%`, 20, 59);
    
    // Grade distribution table
    const gradeLabels = ['A (75-100%)', 'B (65-74%)', 'C (50-64%)', 'D (40-49%)', 'F (0-39%)'];
    const tableData = Object.entries(gradeDistribution).map(([grade, count]) => {
      const label = gradeLabels.find(l => l.startsWith(grade)) || grade;
      return [label, count.toString(), `${Math.round((count / subjectAverages.length) * 100)}%`];
    });
    
    autoTable(doc, {
      head: [['Grade Range', 'Number of Subjects', 'Percentage']],
      body: tableData,
      startY: 70,
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
      const grade = s.average >= 75 ? 'A' : s.average >= 65 ? 'B' : s.average >= 50 ? 'C' : s.average >= 40 ? 'D' : 'F';
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Parent Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Viewing records for <span className="font-semibold text-primary">{childName}</span>
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
            <label className="text-sm font-medium text-muted-foreground">Term</label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
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
                <SelectItem value="2024-2025">2024-2025</SelectItem>
                <SelectItem value="2023-2024">2023-2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Student Info Card */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-2xl font-bold">
            {childName.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-display font-bold text-card-foreground">{childName}</h2>
            <p className="text-muted-foreground">
              Class {childClass} • {childBoardingType === 'boarding' ? 'Boarding' : 'Day'} Student
            </p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm text-muted-foreground">Overall Average</p>
            <p className="text-4xl font-bold font-display gradient-text">{overallAverage.toFixed(1)}%</p>
            <GradeBadge grade={overallAverage >= 75 ? 'A' : overallAverage >= 65 ? 'B' : overallAverage >= 50 ? 'C' : overallAverage >= 40 ? 'D' : 'F'} size="lg" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Class Rank"
          value={classRank ? `${classRank}/${totalClassStudents}` : '-'}
          subtitle={classRank === 1 ? 'Top of class!' : classRank && classRank <= 3 ? 'Top 3!' : 'Overall position'}
          icon={Trophy}
          variant={classRank === 1 ? 'success' : classRank && classRank <= 3 ? 'primary' : 'default'}
        />
        <StatCard
          title="Subjects"
          value={uniqueSubjects.length.toString()}
          subtitle="Registered subjects"
          icon={BookOpen}
          variant="primary"
        />
        <StatCard
          title="Top Subject"
          value={topSubject?.subject || '-'}
          subtitle={topSubject ? `${topSubject.average}%` : '-'}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Needs Support"
          value={needSupportSubject?.subject || '-'}
          subtitle={needSupportSubject ? `${needSupportSubject.average}%` : '-'}
          icon={TrendingDown}
          variant="warning"
        />
        <StatCard
          title="Fee Balance"
          value={balance > 0 ? `TZS ${(balance / 1000000).toFixed(1)}M` : 'None'}
          subtitle={balance > 0 ? 'Outstanding' : 'Fully paid'}
          icon={DollarSign}
          variant={balance > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* School Announcements */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          School Notices
        </h3>
        {announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map((announcement, index) => (
              <div 
                key={announcement.id} 
                className="p-4 rounded-lg bg-muted/30 border border-border/50 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-card-foreground">{announcement.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{announcement.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {announcement.created_by}
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

      {/* Fee Status Card */}
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Fee Status - 2024-2025
        </h3>
        {expectedFee > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Expected Fee</p>
                <p className="text-2xl font-bold text-card-foreground">TZS {expectedFee.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-success/10">
                <p className="text-sm text-muted-foreground">Paid Amount</p>
                <p className="text-2xl font-bold text-success">TZS {paidAmount.toLocaleString()}</p>
              </div>
              <div className={`p-4 rounded-lg ${balance > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className={`text-2xl font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>
                  {balance > 0 ? `TZS ${balance.toLocaleString()}` : 'No Balance'}
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Payment Progress</span>
                <span className="font-medium text-card-foreground">
                  {expectedFee > 0 ? Math.round((paidAmount / expectedFee) * 100) : 0}%
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-500"
                  style={{ width: `${expectedFee > 0 ? Math.min((paidAmount / expectedFee) * 100, 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Payment History */}
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
          <p className="text-muted-foreground text-center py-8">Fee structure not yet configured for this class</p>
        )}
      </div>

      {/* Grade Distribution Pie Chart */}
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
          <div className="h-80">
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

      {/* Subject Performance Chart */}
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
          <div className="h-80">
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

      {/* Term-wise Performance */}
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-semibold text-lg text-card-foreground">
            Term-wise Performance Trends
          </h3>
          {termPerformanceData.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDownloadTermPerformance}>
              <FileDown className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          )}
        </div>
        {termPerformanceData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={termPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="term" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                {uniqueSubjects.slice(0, 6).map((subject, idx) => (
                  <Line 
                    key={subject}
                    type="monotone" 
                    dataKey={subject} 
                    stroke={`hsl(${(idx * 60) % 360}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No term data available yet</p>
        )}
      </div>

      {/* Subject Analysis Table with Class Ranking */}
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
                  const needsSupport = index === subjectRankings.length - 1 && item.score < 50;
                  
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
                  const grade = item.average >= 75 ? 'A' : item.average >= 65 ? 'B' : item.average >= 50 ? 'C' : item.average >= 40 ? 'D' : 'F';
                  const isTop = index === 0;
                  const needsSupport = index === subjectAverages.length - 1 && item.average < 50;
                  
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
    </div>
  );
}
