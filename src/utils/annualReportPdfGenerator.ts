import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isSeniorClass, scoreToPoints, calculateDivision, calculateGradeForClass } from './seniorGrading';

interface StudentData {
  id: string;
  full_name: string;
  gender: string | null;
  roll_number: string;
  class: string;
  stream: string | null;
}

interface MarkData {
  student_id: string;
  subject_id: string;
  total: number;
  grade: string;
}

interface SubjectData {
  id: string;
  name: string;
}

const gradeWeight: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 5 };

const abbreviateSubject = (name: string): string => {
  const cleaned = name.replace(/[^A-Za-z0-9 ]/g, '').trim();
  if (!cleaned) return 'SUB';
  if (cleaned.length <= 10) return cleaned.toUpperCase();
  const words = cleaned.split(/\s+/);
  if (words.length === 1) return cleaned.slice(0, 8).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase();
};

const loadLogoAsBase64 = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    // Dynamic import workaround for Vite asset
    import('../assets/das-logo.png').then(mod => { img.src = mod.default; }).catch(() => resolve(null));
  });
};

export async function generateAnnualExamReportPDF(
  className: string,
  term: string,
  academicYear: string,
  students: StudentData[],
  marks: MarkData[],
  subjects: SubjectData[],
) {
  const isSenior = isSeniorClass(className);
  const gradeScale = isSenior ? ['A', 'B', 'C', 'D', 'F'] : ['A', 'B', 'C', 'D', 'E'];

  // Load logo
  const logoBase64 = await loadLogoAsBase64();

  // Discover subjects with marks
  const subjectIdsWithMarks = [...new Set(marks.map(m => m.subject_id))];
  const activeSubjects = subjects
    .filter(s => subjectIdsWithMarks.includes(s.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build student rows
  const studentRows = students.map(student => {
    const studentMarks = marks.filter(m => m.student_id === student.id);
    const subjectScores: { subjectId: string; score: number; grade: string; points: number }[] = [];

    activeSubjects.forEach(subject => {
      const mark = studentMarks.find(m => m.subject_id === subject.id);
      const score = mark ? mark.total : 0;
      const grade = score > 0 ? calculateGradeForClass(score, className) : '-';
      const points = isSenior && score > 0 ? scoreToPoints(score) : 0;
      subjectScores.push({ subjectId: subject.id, score, grade, points });
    });

    const scoredSubjects = subjectScores.filter(s => s.score > 0);
    const totalMarks = scoredSubjects.reduce((sum, s) => sum + s.score, 0);
    const average = scoredSubjects.length > 0 ? Math.round((totalMarks / scoredSubjects.length) * 10) / 10 : 0;
    const overallGrade = average > 0 ? calculateGradeForClass(average, className) : '-';

    let division = '-';
    let totalPoints = 0;
    if (isSenior) {
      if (scoredSubjects.length === 0) {
        division = 'ABS';
      } else if (scoredSubjects.length < 7) {
        division = 'INC';
      } else {
        const scores = scoredSubjects.map(s => s.score);
        const divResult = calculateDivision(scores);
        division = divResult.division;
        totalPoints = divResult.totalPoints;
      }
    }

    const nameParts = student.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const surName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    return {
      student,
      firstName,
      surName,
      gender: (student.gender || 'M').charAt(0).toUpperCase(),
      subjectScores,
      totalMarks,
      average,
      overallGrade,
      division,
      totalPoints,
      position: 0,
      remarks: average > 0 ? (isSenior ? (average >= 30 ? 'PASS' : 'FAIL') : (average >= 21 ? 'PASS' : 'FAIL')) : '-',
    };
  });

  // Rank
  const rankedRows = [...studentRows].sort((a, b) => b.average - a.average);
  let currentPosition = 1;
  rankedRows.forEach((row, index) => {
    if (index > 0 && row.average === rankedRows[index - 1].average) row.position = rankedRows[index - 1].position;
    else row.position = currentPosition;
    currentPosition = index + 2;
  });

  // Sort A-Z
  studentRows.sort((a, b) => a.firstName.localeCompare(b.firstName, 'en', { sensitivity: 'base' }));

  // Gender groups
  const femaleRows = studentRows.filter(r => r.gender === 'F');
  const maleRows = studentRows.filter(r => r.gender === 'M');

  const countGrades = (rows: typeof studentRows) => {
    const counts = Object.fromEntries(gradeScale.map(g => [g, rows.filter(r => r.overallGrade === g).length]));
    return {
      ...counts,
      PASS: rows.filter(r => r.remarks === 'PASS').length,
      FAIL: rows.filter(r => r.remarks === 'FAIL').length,
      TOTAL: rows.filter(r => r.average > 0).length,
    };
  };

  const countDivisions = (rows: typeof studentRows) => ({
    I: rows.filter(r => r.division === 'I').length,
    II: rows.filter(r => r.division === 'II').length,
    III: rows.filter(r => r.division === 'III').length,
    IV: rows.filter(r => r.division === 'IV').length,
    O: rows.filter(r => r.division === '0').length,
    ABS: rows.filter(r => r.division === 'ABS').length,
    INC: rows.filter(r => r.division === 'INC').length,
  });

  // Determine orientation based on number of subjects
  const isLandscape = activeSubjects.length > 5;
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Logo + Title
  let headerY = 10;
  if (logoBase64) {
    const logoSize = 14;
    const logoX = (pageWidth - logoSize) / 2;
    doc.addImage(logoBase64, 'PNG', logoX, 6, logoSize, logoSize);
    headerY = 22;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Bismillaahir Rahmaanir Rahiim', pageWidth / 2, headerY, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DAARUL-ARQAM SECONDARY SCHOOL', pageWidth / 2, headerY + 8, { align: 'center' });

  const yearOnly = academicYear.split('-')[0] || academicYear;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${className.toUpperCase()} ${term.toUpperCase()} EXAMINATION RESULTS — ${yearOnly}`, pageWidth / 2, headerY + 15, { align: 'center' });

  const summaryStartY = headerY + 21;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULT SUMMARY', 14, summaryStartY);

  const summaryHead = ['G/S', ...gradeScale, 'PASS', 'FAIL', 'TOTAL'];
  if (isSenior) summaryHead.push('I', 'II', 'III', 'IV', 'O', 'ABS', 'INC');

  const summaryBody = [
    { label: 'F', rows: femaleRows },
    { label: 'M', rows: maleRows },
    { label: 'T', rows: studentRows },
  ].map(({ label, rows }) => {
    const grades = countGrades(rows);
    const row: (string | number)[] = [label, ...gradeScale.map(g => grades[g] || 0), grades.PASS, grades.FAIL, grades.TOTAL];
    if (isSenior) {
      const divs = countDivisions(rows);
      row.push(divs.I, divs.II, divs.III, divs.IV, divs.O, divs.ABS, divs.INC);
    }
    return row;
  });

  autoTable(doc, {
    startY: summaryStartY + 2,
    head: [summaryHead],
    body: summaryBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    margin: { left: 14, right: 14 },
    tableWidth: 'wrap',
  });

  // Main Student Table
  const mainStartY = (doc as any).lastAutoTable.finalY + 6;

  const mainHead: string[] = ['S/N', 'SEX', 'NAME'];
  if (isSenior) mainHead.push('DIV', 'PTS');
  activeSubjects.forEach(s => mainHead.push(abbreviateSubject(s.name)));
  mainHead.push('TOT', 'AVG', 'GRD', 'POS', 'RMK');
  // Grade columns
  activeSubjects.forEach(s => mainHead.push(abbreviateSubject(s.name) + '(G)'));
  if (isSenior) activeSubjects.forEach(s => mainHead.push(abbreviateSubject(s.name) + '(P)'));

  const mainBody = studentRows.map((row, idx) => {
    const name = `${row.firstName} ${row.surName}`;
    const dataRow: (string | number)[] = [String(idx + 1).padStart(3, '0'), row.gender, name];
    if (isSenior) dataRow.push(row.division, row.totalPoints > 0 ? row.totalPoints : '');

    row.subjectScores.forEach(s => dataRow.push(s.score > 0 ? s.score : ''));
    dataRow.push(
      row.totalMarks > 0 ? row.totalMarks : '',
      row.average > 0 ? row.average : '',
      row.overallGrade,
      row.position,
      row.remarks,
    );

    row.subjectScores.forEach(s => dataRow.push(s.score > 0 ? s.grade : ''));
    if (isSenior) row.subjectScores.forEach(s => dataRow.push(s.points > 0 ? s.points : ''));

    return dataRow;
  });

  autoTable(doc, {
    startY: mainStartY,
    head: [mainHead],
    body: mainBody,
    theme: 'grid',
    styles: { fontSize: 5.5, cellPadding: 1, halign: 'center', overflow: 'ellipsize' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 5 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 7 },
      2: { cellWidth: 28, halign: 'left' },
    },
    margin: { left: 5, right: 5 },
  });

  // Subject Summary Section
  let summaryY = (doc as any).lastAutoTable.finalY + 6;
  
  // Check if we need a new page
  if (summaryY > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    summaryY = 15;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBJECT SUMMARY', 14, summaryY);

  const subjectAverages = activeSubjects.map(subject => {
    const scores = studentRows
      .map(r => r.subjectScores.find(s => s.subjectId === subject.id)?.score || 0)
      .filter(score => score > 0);
    return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  });

  const rankedSubjects = [...subjectAverages]
    .map((avg, i) => ({ i, avg }))
    .filter(x => x.avg > 0)
    .sort((a, b) => b.avg - a.avg);
  const subjectRanks: (string | number)[] = subjectAverages.map(() => '');
  rankedSubjects.forEach((item, i) => { subjectRanks[item.i] = i + 1; });

  const subSummaryHead = ['', ...activeSubjects.map(s => abbreviateSubject(s.name))];
  const subSummaryBody = [
    ['AVERAGE', ...subjectAverages.map(v => v > 0 ? String(v) : '')],
    ['GRADE', ...subjectAverages.map(v => v > 0 ? calculateGradeForClass(v, className) : '')],
    ['RANK', ...subjectRanks.map(v => String(v))],
  ];

  autoTable(doc, {
    startY: summaryY + 2,
    head: [subSummaryHead],
    body: subSummaryBody,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 6 },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left', cellWidth: 18 } },
    margin: { left: 14, right: 14 },
  });

  // Individual Subject Grade Scores
  let gradeScoreY = (doc as any).lastAutoTable.finalY + 6;
  if (gradeScoreY > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    gradeScoreY = 15;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INDIVIDUAL SUBJECT GRADE SCORES', 14, gradeScoreY);

  let grandVolume = 0;
  const gradeScoreHead = ['GRADE', ...activeSubjects.map(s => abbreviateSubject(s.name)), 'TOTAL', 'VOLUME'];
  const gradeScoreBody: (string | number)[][] = [];

  gradeScale.forEach(grade => {
    const counts = activeSubjects.map(subject =>
      studentRows.reduce((sum, row) => {
        const ss = row.subjectScores.find(s => s.subjectId === subject.id);
        return sum + (ss && ss.score > 0 && ss.grade === grade ? 1 : 0);
      }, 0)
    );
    const total = counts.reduce((a, b) => a + b, 0);
    const volume = total * (gradeWeight[grade] ?? 0);
    grandVolume += volume;
    gradeScoreBody.push([grade, ...counts, total, volume]);
  });

  const candidatesPerSubject = activeSubjects.map(subject =>
    studentRows.reduce((sum, row) => {
      const ss = row.subjectScores.find(s => s.subjectId === subject.id);
      return sum + (ss && ss.score > 0 ? 1 : 0);
    }, 0)
  );
  const candidatesTotal = candidatesPerSubject.reduce((a, b) => a + b, 0);
  const gpa = candidatesTotal > 0 ? grandVolume / candidatesTotal : 0;

  gradeScoreBody.push(['CANDIDATES', ...candidatesPerSubject, candidatesTotal, '']);

  autoTable(doc, {
    startY: gradeScoreY + 2,
    head: [gradeScoreHead],
    body: gradeScoreBody,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 6 },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left', cellWidth: 18 } },
    margin: { left: 14, right: 14 },
  });

  // GPA line
  const gpaY = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`G.P.A: ${gpa > 0 ? gpa.toFixed(4) : '-'}    |    Grand Volume: ${grandVolume}    |    Total Candidates: ${candidatesTotal}`, 14, gpaY);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, footerY);
  doc.text('Daarul-Arqam Secondary School', pageWidth - 14, footerY, { align: 'right' });

  const fileName = `${className.replace(/\s+/g, '_')}_${term.replace(/\s+/g, '_')}_Results_${academicYear}.pdf`;
  doc.save(fileName);
}
