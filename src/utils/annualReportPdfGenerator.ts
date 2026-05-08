import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isSeniorClass, isNurseryClass, scoreToPoints, calculateDivision, calculateGradeForClass, getTestDisplayName } from './seniorGrading';
import { resolveSubjectsFromMarks } from './subjectResolution';
import { isExcludedFromPrimaryAverage } from './averageExclusions';

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
  subject_name?: string | null;
  total: number;
  grade: string;
}

interface SubjectData {
  id: string;
  name: string;
}

const gradeWeight: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 5 };

const SUBJECT_ABBREVIATIONS: { match: RegExp; abbr: string }[] = [
  { match: /social\s*studies.*vocational/i, abbr: 'SST' },
  { match: /^social\s*studies$/i, abbr: 'SST' },
  { match: /vocational\s*skills/i, abbr: 'SST' },
  { match: /mathematics|^math$|arithmetic/i, abbr: 'MATH' },
  { match: /science\s*&?\s*technology|^science$/i, abbr: 'SCIE' },
  { match: /^english(\s*language)?$/i, abbr: 'ENG' },
  { match: /civic.*moral|^civics$/i, abbr: 'C/MO' },
  { match: /kiswahili/i, abbr: 'KISW' },
];

const abbreviateSubject = (name: string): string => {
  const trimmed = name.trim();
  for (const { match, abbr } of SUBJECT_ABBREVIATIONS) {
    if (match.test(trimmed)) return abbr;
  }
  const cleaned = trimmed.replace(/[^A-Za-z0-9 ]/g, '').trim();
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
  const displayTerm = getTestDisplayName(term, className);
  const gradeScale = isSenior ? ['A', 'B', 'C', 'D', 'F'] : ['A', 'B', 'C', 'D', 'E'];

  // Load logo
  const logoBase64 = await loadLogoAsBase64();

  // Discover subjects with marks
  const activeSubjects = resolveSubjectsFromMarks(marks, subjects);

  // Build student rows
  const studentRows = students.map(student => {
    const studentMarks = marks.filter(m => m.student_id === student.id);
    const subjectScores: { subjectId: string; subjectName: string; score: number; grade: string; points: number }[] = [];

    activeSubjects.forEach(subject => {
      const mark = studentMarks.find(m => m.subject_id === subject.id);
      const score = mark ? mark.total : 0;
      const grade = score > 0 ? calculateGradeForClass(score, className) : '-';
      const points = isSenior && score > 0 ? scoreToPoints(score) : 0;
      subjectScores.push({ subjectId: subject.id, subjectName: subject.name, score, grade, points });
    });

    const scoredSubjects = subjectScores.filter(s => s.score > 0);
    const averagingSubjects = scoredSubjects.filter(s => !isExcludedFromPrimaryAverage(s.subjectName, className));
    const totalMarks = averagingSubjects.reduce((sum, s) => sum + s.score, 0);
    const average = averagingSubjects.length > 0 ? Math.round((totalMarks / averagingSubjects.length) * 10) / 10 : 0;
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

  // Sort by Gender (F first, then M), then alphabetically within each gender
  studentRows.sort((a, b) => {
    if (a.gender !== b.gender) return a.gender === 'F' ? -1 : 1;
    return a.firstName.localeCompare(b.firstName, 'en', { sensitivity: 'base' });
  });

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
  const schoolName = isSenior ? 'DAARUL-ARQAM SECONDARY SCHOOL' : isNurseryClass(className) ? 'DAARUL-ARQAM NURSERY SCHOOL' : 'DAARUL-ARQAM PRIMARY SCHOOL';
  doc.text(schoolName, pageWidth / 2, headerY + 8, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${className.toUpperCase()} ${displayTerm.toUpperCase()} EXAMINATION RESULTS — ${academicYear}`, pageWidth / 2, headerY + 15, { align: 'center' });

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

  // ===== SUBJECT SUMMARY TABLE =====
  let subjSummaryY = (doc as any).lastAutoTable.finalY + 8;
  if (subjSummaryY > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    subjSummaryY = 15;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBJECT SUMMARY', 14, subjSummaryY);

  // Calculate per-subject stats
  const subjectStats = activeSubjects.map(subject => {
    const subjectMarks = marks.filter(m => m.subject_id === subject.id && m.total > 0);
    const total = subjectMarks.reduce((sum, m) => sum + m.total, 0);
    const avg = subjectMarks.length > 0 ? Math.round(total / subjectMarks.length) : 0;
    const grade = avg > 0 ? calculateGradeForClass(avg, className) : '-';
    return { name: abbreviateSubject(subject.name), avg, grade, count: subjectMarks.length };
  });

  // Rank subjects by average (descending)
  const rankedStats = [...subjectStats].sort((a, b) => b.avg - a.avg);
  subjectStats.forEach(stat => {
    stat['rank'] = stat.avg > 0 ? rankedStats.findIndex(r => r.name === stat.name) + 1 : '-';
  });

  const subjSummaryHead = ['', ...subjectStats.map(s => s.name)];
  const subjSummaryBody = [
    ['SUBJECT AVERAGE', ...subjectStats.map(s => s.avg > 0 ? String(s.avg) : '')],
    ['GRADE', ...subjectStats.map(s => s.grade)],
    ['SUBJECT RANK', ...subjectStats.map(s => String(s['rank']))],
  ];

  autoTable(doc, {
    startY: subjSummaryY + 2,
    head: [subjSummaryHead],
    body: subjSummaryBody,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 5.5 },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 28 } },
    margin: { left: 5, right: 5 },
  });

  // ===== INDIVIDUAL SUBJECT GRADE SCORES TABLE =====
  let gradeScoresY = (doc as any).lastAutoTable.finalY + 6;
  if (gradeScoresY > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    gradeScoresY = 15;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INDIVIDUAL SUBJECT GRADE SCORES', 14, gradeScoresY);

  const gradeScoresHead = ['GRADE', ...subjectStats.map(s => s.name), 'TOTAL', 'WEIGHTED'];
  const gradeScoresBody = gradeScale.map((grade, gi) => {
    const counts = activeSubjects.map(subject => {
      return studentRows.filter(r => {
        const sc = r.subjectScores.find(s => s.subjectId === subject.id);
        return sc && sc.score > 0 && sc.grade === grade;
      }).length;
    });
    const total = counts.reduce((s, c) => s + c, 0);
    const weight = total * (gi + 1);
    return [grade, ...counts.map(String), String(total), String(weight)];
  });

  autoTable(doc, {
    startY: gradeScoresY + 2,
    head: [gradeScoresHead],
    body: gradeScoresBody,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 5.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 12 } },
    margin: { left: 5, right: 5 },
  });

  // ===== NUMBER OF CANDIDATES ROW =====
  // Count every student who has a marks entry for the subject (including
  // absentees / 0 scores) so candidate totals match the Result Approval view.
  const candidateCounts = activeSubjects.map(subject => {
    const studentsWithEntry = new Set(
      marks.filter(m => m.subject_id === subject.id).map(m => m.student_id)
    );
    return studentsWithEntry.size;
  });
  const totalCandidates = candidateCounts.reduce((s, c) => s + c, 0);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY,
    head: [['CANDIDATES', ...subjectStats.map(s => s.name), 'TOTAL']],
    body: [[' ', ...candidateCounts.map(String), String(totalCandidates)]],
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold', fontSize: 5.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 12 } },
    margin: { left: 5, right: 5 },
  });

  // ===== Pass/Fail Summary =====
  let passFailY = (doc as any).lastAutoTable.finalY + 8;
  if (passFailY > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    passFailY = 15;
  }

  const passCount = studentRows.filter(r => r.remarks === 'PASS').length;
  const failCount = studentRows.filter(r => r.remarks === 'FAIL').length;
  const totalSat = passCount + failCount;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`PASS: ${passCount}    |    FAIL: ${failCount}    |    TOTAL SAT: ${totalSat}    |    REGISTERED: ${studentRows.length}`, 14, passFailY);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, footerY);
  doc.text(isSenior ? 'Daarul-Arqam Secondary School' : 'Daarul-Arqam Primary School', pageWidth - 14, footerY, { align: 'right' });

  const fileName = `${className.replace(/\s+/g, '_')}_${term.replace(/\s+/g, '_')}_Results_${academicYear}.pdf`;
  doc.save(fileName);
}
