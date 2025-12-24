import { useState, useEffect } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { GradeBadge } from '@/components/dashboard/GradeBadge';
import { BookOpen, Award, Download, MessageSquare, Loader2, DollarSign, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import jsPDF from 'jspdf';

interface StudentMark {
  subject: string;
  subject_id: string;
  term: string;
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

export function ParentDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [childName, setChildName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [childBoardingType, setChildBoardingType] = useState('day');
  const [studentId, setStudentId] = useState('');
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [overallAverage, setOverallAverage] = useState(0);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [expectedFee, setExpectedFee] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    const fetchChildData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      let studentData = null;
      
      const { data: studentByParent } = await supabase
        .from('students')
        .select('*')
        .eq('parent_id', user.id)
        .maybeSingle();
      
      if (studentByParent) {
        studentData = studentByParent;
      } else {
        const { data: studentById } = await supabase
          .from('students')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        studentData = studentById;
      }
      
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
          subject_id,
          subjects (name)
        `)
        .eq('student_id', studentData.id);
      
      if (marksData) {
        const formattedMarks = marksData.map((m: any) => ({
          subject: m.subjects?.name || 'Unknown',
          subject_id: m.subject_id,
          term: m.term,
          exam: m.exam,
          total: m.total,
          grade: m.grade,
        }));
        setStudentMarks(formattedMarks);
        
        if (formattedMarks.length > 0) {
          const avg = formattedMarks.reduce((sum, m) => sum + m.total, 0) / formattedMarks.length;
          setOverallAverage(avg);
        }
      }
      
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
      
      setIsLoading(false);
    };
    
    fetchChildData();
  }, [user]);

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

  // Term-wise performance data
  const terms = ['Term 1', 'Term 2', 'Term 3'];
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

  // Download PDF report
  const handleDownloadReport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Student Academic Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Student: ${childName}`, 20, 40);
    doc.text(`Class: ${childClass}`, 20, 50);
    doc.text(`Academic Year: 2024-2025`, 20, 60);
    
    // Subject Performance
    doc.setFontSize(14);
    doc.text('Subject Performance', 20, 80);
    
    let yPos = 90;
    doc.setFontSize(10);
    subjectAverages.forEach(s => {
      doc.text(`${s.subject}: ${s.average}%`, 20, yPos);
      yPos += 8;
    });
    
    // Overall
    doc.setFontSize(12);
    doc.text(`Overall Average: ${overallAverage.toFixed(1)}%`, 20, yPos + 10);
    doc.text(`Top Subject: ${topSubject?.subject || '-'} (${topSubject?.average || 0}%)`, 20, yPos + 20);
    doc.text(`Needs Support: ${needSupportSubject?.subject || '-'} (${needSupportSubject?.average || 0}%)`, 20, yPos + 30);
    
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Fee Status Card */}
      {expectedFee > 0 && (
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Fee Status - 2024-2025
          </h3>
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
        </div>
      )}

      {/* Subject Performance Chart */}
      {performanceData.length > 0 && (
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">
            Subject Performance Overview
          </h3>
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
        </div>
      )}

      {/* Term-wise Performance */}
      {termPerformanceData.length > 0 && (
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">
            Term-wise Performance Trends
          </h3>
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
        </div>
      )}

      {/* Subject Analysis Table */}
      {subjectAverages.length > 0 && (
        <div className="card-elevated p-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">
            Subject Analysis
          </h3>
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
        </div>
      )}
    </div>
  );
}
