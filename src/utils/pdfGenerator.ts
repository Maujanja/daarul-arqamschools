import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StudentReport {
  fullName: string;
  rollNumber: string;
  className: string;
  admissionDate: string;
  subjects: {
    name: string;
    marks: number;
    grade: string;
  }[];
  averageMarks: number;
  overallGrade: string;
  term: string;
  academicYear: string;
}

interface ClassReport {
  className: string;
  term: string;
  academicYear: string;
  students: {
    rank: number;
    name: string;
    rollNumber: string;
    average: number;
    grade: string;
  }[];
  classAverage: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
}

export const generateStudentReportPDF = (report: StudentReport): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT REPORT CARD', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.term} - ${report.academicYear}`, pageWidth / 2, 30, { align: 'center' });

  // Student Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);

  const infoY = 55;
  doc.setFont('helvetica', 'bold');
  doc.text('Student Information', 14, infoY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const infoData = [
    ['Full Name:', report.fullName],
    ['Roll Number:', report.rollNumber],
    ['Class:', report.className],
    ['Admission Date:', report.admissionDate],
  ];

  let yPos = infoY + 8;
  infoData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 60, yPos);
    yPos += 7;
  });

  // Marks Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Subject Performance', 14, yPos + 10);

  autoTable(doc, {
    startY: yPos + 15,
    head: [['Subject', 'Marks Obtained', 'Max Marks', 'Grade']],
    body: report.subjects.map(subject => [
      subject.name,
      subject.marks.toString(),
      '100',
      subject.grade,
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 15;

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, finalY, pageWidth - 28, 35, 3, 3, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Performance Summary', 20, finalY + 10);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.text(`Overall Average: ${report.averageMarks}%`, 20, finalY + 22);
  doc.text(`Overall Grade: ${report.overallGrade}`, 100, finalY + 22);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, footerY);
  doc.text('School Management System', pageWidth - 14, footerY, { align: 'right' });

  // Download
  doc.save(`${report.fullName.replace(/\s+/g, '_')}_Report_${report.term}.pdf`);
};

export const generateClassReportPDF = (report: ClassReport): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('CLASS PERFORMANCE REPORT', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.className} - ${report.term} (${report.academicYear})`, pageWidth / 2, 30, { align: 'center' });

  // Class Statistics
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Class Statistics', 14, 55);

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 60, pageWidth - 28, 25, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const statWidth = (pageWidth - 28) / 4;
  const stats = [
    ['Average', `${report.classAverage}%`],
    ['Highest', `${report.highestScore}%`],
    ['Lowest', `${report.lowestScore}%`],
    ['Pass Rate', `${report.passRate}%`],
  ];

  stats.forEach(([label, value], index) => {
    const x = 14 + (statWidth * index) + statWidth / 2;
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, 72, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(value, x, 80, { align: 'center' });
  });

  // Students Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Rankings', 14, 100);

  autoTable(doc, {
    startY: 105,
    head: [['Rank', 'Student Name', 'Roll No.', 'Average (%)', 'Grade']],
    body: report.students.map(student => [
      student.rank.toString(),
      student.name,
      student.rollNumber,
      student.average.toString(),
      student.grade,
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, footerY);
  doc.text('School Management System', pageWidth - 14, footerY, { align: 'right' });

  // Download
  doc.save(`Class_${report.className}_Report_${report.term}.pdf`);
};

export const generateAllStudentsReportPDF = (
  students: {
    name: string;
    rollNumber: string;
    className: string;
    average: number;
    grade: string;
  }[],
  term: string,
  academicYear: string
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENTS REPORT', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${term} - ${academicYear}`, pageWidth / 2, 30, { align: 'center' });

  // Summary
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Total Students: ${students.length}`, 14, 50);

  // Students Table
  autoTable(doc, {
    startY: 55,
    head: [['#', 'Student Name', 'Roll No.', 'Class', 'Average (%)', 'Grade']],
    body: students.map((student, index) => [
      (index + 1).toString(),
      student.name,
      student.rollNumber,
      student.className,
      student.average.toString(),
      student.grade,
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, footerY);
  doc.text('School Management System', pageWidth - 14, footerY, { align: 'right' });

  // Download
  doc.save(`All_Students_Report_${term}_${academicYear}.pdf`);
};
