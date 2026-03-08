import * as XLSX from 'xlsx';
import { isSeniorClass, scoreToPoints, calculateDivision, calculateGradeForClass, getTestDisplayName } from './seniorGrading';

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

const abbreviateSubject = (name: string) => {
  const cleaned = name.replace(/[^A-Za-z0-9 ]/g, '').trim();
  if (!cleaned) return 'SUB';
  if (cleaned.length <= 14) return cleaned.toUpperCase();
  const words = cleaned.split(/\s+/);
  if (words.length === 1) return cleaned.slice(0, 12).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase();
};

/**
 * Generate Annual Examination Results Excel report matching the school's format
 * Divisions and Points only for Senior classes
 */
export function generateAnnualExamReport(
  className: string,
  term: string,
  academicYear: string,
  students: StudentData[],
  marks: MarkData[],
  subjects: SubjectData[],
) {
  const wb = XLSX.utils.book_new();
  const isSenior = isSeniorClass(className);
  const displayTerm = getTestDisplayName(term, className);
  const gradeScale = isSenior ? ['A', 'B', 'C', 'D', 'F'] : ['A', 'B', 'C', 'D', 'E'];
  const leadingColumns = isSenior ? 7 : 5;

  // Discover subjects that have marks for this class
  const subjectIdsWithMarks = [...new Set(marks.map(m => m.subject_id))];
  const activeSubjects = subjects
    .filter(s => subjectIdsWithMarks.includes(s.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build student rows with calculated data
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
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
    const surName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    return {
      student,
      firstName,
      middleName,
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

  // Position by performance
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
    const nameA = `${a.firstName} ${a.middleName} ${a.surName}`;
    const nameB = `${b.firstName} ${b.middleName} ${b.surName}`;
    return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
  });

  const genderGroups = { F: studentRows.filter(r => r.gender === 'F'), M: studentRows.filter(r => r.gender === 'M') };

  const countGrades = (rows: typeof studentRows) => {
    const counts = Object.fromEntries(gradeScale.map(g => [g, rows.filter(r => r.overallGrade === g).length])) as Record<string, number>;
    return {
      ...counts,
      INC: 0,
      ABS: 0,
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
    TOTAL: rows.filter(r => r.division !== '-').length,
  });

  const wsData: any[][] = [];

  wsData.push(['Bismillaahir Rahmaanir Rahiim']);
  wsData.push(['DAARUL-ARQAM SECONDARY SCHOOL']);
  wsData.push([`${className.toUpperCase()} ${displayTerm.toUpperCase()} EXAMINATION RESULTS — ${academicYear}`]);
  wsData.push([]);

  const summaryHeaderRow = ['RESULT SUMMARY', '', '', '', '', 'G/S', ...gradeScale, 'INC', 'ABS', 'PASS', 'FAIL', 'TOTAL'];
  if (isSenior) summaryHeaderRow.push('', 'DIVISION', '', '', 'I', 'II', 'III', 'IV', 'O', 'ABS', 'INC', 'TOTAL');
  wsData.push(summaryHeaderRow);

  const genderLabels = [
    { label: 'F', rows: genderGroups.F },
    { label: 'M', rows: genderGroups.M },
    { label: 'T', rows: studentRows },
  ];

  genderLabels.forEach(({ label, rows }) => {
    const grades = countGrades(rows);
    const summaryRow: any[] = ['', '', '', '', '', label, ...gradeScale.map(g => grades[g]), grades.INC, grades.ABS, grades.PASS, grades.FAIL, grades.TOTAL];
    if (isSenior) {
      const divs = countDivisions(rows);
      summaryRow.push('', '', '', '', divs.I, divs.II, divs.III, divs.IV, divs.O, divs.ABS, divs.INC, divs.TOTAL);
    }
    wsData.push(summaryRow);
  });

  wsData.push([]);

  const headerRow: string[] = ['S/N', 'SEX', 'FIRST NAME', 'MIDDLE NAME', 'SUR NAME'];
  if (isSenior) headerRow.push('DIVISION', 'POINTS');

  activeSubjects.forEach(subject => headerRow.push(subject.name.toUpperCase()));
  headerRow.push('TOTAL', 'AVERAGE', 'GRADE', 'POSITION', 'REMARKS');

  activeSubjects.forEach(subject => headerRow.push(`${abbreviateSubject(subject.name)}\n(G)`));
  if (isSenior) activeSubjects.forEach(subject => headerRow.push(`${abbreviateSubject(subject.name)}\n(P)`));

  const mainHeaderRowIndex = wsData.length;
  wsData.push(headerRow);

  studentRows.forEach((row, index) => {
    const dataRow: any[] = [
      String(index + 1).padStart(3, '0'),
      row.gender,
      row.firstName,
      row.middleName,
      row.surName,
    ];

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

    wsData.push(dataRow);
  });

  // Bottom section (missing in previous version)
  wsData.push([]);
  const subjectNames = activeSubjects.map(s => s.name.toUpperCase());
  const prefix = ['SUBJECT SUMMARY', ...Array(leadingColumns - 1).fill('')];
  wsData.push([...prefix, ...subjectNames, 'TOTAL', 'VOLUME', 'G.P.A']);

  const subjectAverages = activeSubjects.map(subject => {
    const scores = studentRows
      .map(r => r.subjectScores.find(s => s.subjectId === subject.id)?.score || 0)
      .filter(score => score > 0);
    return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  });

  wsData.push(['SUBJECT AVERAGE', ...Array(leadingColumns - 1).fill(''), ...subjectAverages.map(v => (v > 0 ? v : '')), '', '', '']);
  wsData.push(['GRADE', ...Array(leadingColumns - 1).fill(''), ...subjectAverages.map(v => (v > 0 ? calculateGradeForClass(v, className) : '')), '', '', '']);

  const rankedSubjects = [...subjectAverages]
    .map((avg, i) => ({ i, avg }))
    .filter(x => x.avg > 0)
    .sort((a, b) => b.avg - a.avg);
  const subjectRanks: Array<string | number> = subjectAverages.map(() => '');
  rankedSubjects.forEach((item, i) => { subjectRanks[item.i] = i + 1; });
  wsData.push(['SUBJECT RANK', ...Array(leadingColumns - 1).fill(''), ...subjectRanks, '', '', '']);

  wsData.push(['INDIVIDUAL SUBJECT GRADE SCORES', ...Array(leadingColumns - 1).fill(''), ...Array(activeSubjects.length).fill(''), '', '', '']);

  let grandVolume = 0;
  gradeScale.forEach(grade => {
    const counts = activeSubjects.map(subject => studentRows.reduce((sum, row) => {
      const ss = row.subjectScores.find(s => s.subjectId === subject.id);
      return sum + (ss && ss.score > 0 && ss.grade === grade ? 1 : 0);
    }, 0));

    const total = counts.reduce((a, b) => a + b, 0);
    const volume = total * (gradeWeight[grade] ?? 0);
    grandVolume += volume;

    wsData.push([
      '',
      ...Array(Math.max(0, leadingColumns - 2)).fill(''),
      grade,
      ...counts,
      total,
      volume,
      '',
    ]);
  });

  const candidatesPerSubject = activeSubjects.map(subject => studentRows.reduce((sum, row) => {
    const ss = row.subjectScores.find(s => s.subjectId === subject.id);
    return sum + (ss && ss.score > 0 ? 1 : 0);
  }, 0));
  const candidatesTotal = candidatesPerSubject.reduce((a, b) => a + b, 0);
  const gpa = candidatesTotal > 0 ? grandVolume / candidatesTotal : 0;

  wsData.push([
    'NUMBER OF CANDIDATES',
    ...Array(leadingColumns - 1).fill(''),
    ...candidatesPerSubject,
    candidatesTotal,
    grandVolume,
    gpa > 0 ? Number(gpa.toFixed(4)) : '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths: XLSX.ColInfo[] = [
    { wch: 5 },
    { wch: 5 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];
  if (isSenior) colWidths.push({ wch: 8 }, { wch: 7 });
  activeSubjects.forEach(() => colWidths.push({ wch: 8 }));
  colWidths.push({ wch: 7 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 9 });
  activeSubjects.forEach(() => colWidths.push({ wch: 7 }));
  if (isSenior) activeSubjects.forEach(() => colWidths.push({ wch: 7 }));

  const maxCols = Math.max(...wsData.map(r => r.length));
  while (colWidths.length < maxCols) colWidths.push({ wch: 9 });
  ws['!cols'] = colWidths;

  const rowsMeta = wsData.map(() => ({ hpx: 22 }));
  rowsMeta[mainHeaderRowIndex] = { hpx: 42 }; // stacked headers to mimic vertical style
  ws['!rows'] = rowsMeta;

  const sheetName = className.length > 31 ? className.substring(0, 31) : className;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const fileName = `${className.replace(/\s+/g, '_')}_${term.replace(/\s+/g, '_')}_Results_${academicYear}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
