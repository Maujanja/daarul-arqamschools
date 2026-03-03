import * as XLSX from 'xlsx';
import { isSeniorClass, scoreToPoints, calculateDivision } from './seniorGrading';
import { calculateGrade } from '@/types';

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
      const grade = mark ? (mark.grade || calculateGrade(score)) : '-';
      const points = isSenior && score > 0 ? scoreToPoints(score) : 0;
      subjectScores.push({ subjectId: subject.id, score, grade, points });
    });

    const scoredSubjects = subjectScores.filter(s => s.score > 0);
    const totalMarks = scoredSubjects.reduce((sum, s) => sum + s.score, 0);
    const average = scoredSubjects.length > 0 ? Math.round((totalMarks / scoredSubjects.length) * 10) / 10 : 0;
    const overallGrade = average > 0 ? calculateGrade(average) : '-';

    // Division calculation (Senior only)
    let division = '-';
    let totalPoints = 0;
    if (isSenior && scoredSubjects.length > 0) {
      const scores = scoredSubjects.map(s => s.score);
      const divResult = calculateDivision(scores);
      division = divResult.division;
      totalPoints = divResult.totalPoints;
    }

    // Split name into parts
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
      position: 0, // will be set after sorting
      remarks: average >= 30 ? 'PASS' : (average > 0 ? 'FAIL' : '-'),
    };
  });

  // Sort by average descending and assign positions
  studentRows.sort((a, b) => b.average - a.average);
  let currentPosition = 1;
  studentRows.forEach((row, index) => {
    if (index > 0 && row.average === studentRows[index - 1].average) {
      row.position = studentRows[index - 1].position;
    } else {
      row.position = currentPosition;
    }
    currentPosition = index + 2;
  });

  // === Build Result Summary ===
  const genderGroups = { F: studentRows.filter(r => r.gender === 'F'), M: studentRows.filter(r => r.gender === 'M') };
  
  const countGrades = (rows: typeof studentRows) => ({
    A: rows.filter(r => r.overallGrade === 'A').length,
    B: rows.filter(r => r.overallGrade === 'B').length,
    C: rows.filter(r => r.overallGrade === 'C').length,
    D: rows.filter(r => r.overallGrade === 'D').length,
    F: rows.filter(r => r.overallGrade === 'F').length,
    INC: 0,
    ABS: 0,
    PASS: rows.filter(r => r.remarks === 'PASS').length,
    FAIL: rows.filter(r => r.remarks === 'FAIL').length,
    TOTAL: rows.filter(r => r.average > 0).length,
  });

  const countDivisions = (rows: typeof studentRows) => ({
    I: rows.filter(r => r.division === 'I').length,
    II: rows.filter(r => r.division === 'II').length,
    III: rows.filter(r => r.division === 'III').length,
    IV: rows.filter(r => r.division === 'IV').length,
    O: rows.filter(r => r.division === '0').length,
    TOTAL: rows.filter(r => r.division !== '-').length,
  });

  // === Build worksheet data ===
  const wsData: any[][] = [];

  // Row 1: Bismillah
  wsData.push(['Bismillaahir Rahmaanir Rahiim']);
  // Row 2: School name
  wsData.push(['DAARUL-ARQAM SCHOOLS']);
  // Row 3: Report title
  const yearOnly = academicYear.split('-')[0] || academicYear;
  wsData.push([`${className.toUpperCase()} ${term.toUpperCase()} EXAMINATION RESULTS — ${yearOnly}`]);

  // Row 4: Empty
  wsData.push([]);

  // Result Summary header
  const summaryHeaderRow = ['RESULT SUMMARY', '', '', '', '', 'G/S', 'A', 'B', 'C', 'D', 'F', 'INC', 'ABS', 'PASS', 'FAIL', 'TOTAL'];
  if (isSenior) {
    summaryHeaderRow.push('', 'DIVISION', '', '', 'I', 'II', 'III', 'IV', 'O', 'TOTAL');
  }
  wsData.push(summaryHeaderRow);

  // Summary data rows
  const genderLabels = [
    { label: 'F', rows: genderGroups.F },
    { label: 'M', rows: genderGroups.M },
    { label: 'T', rows: studentRows },
  ];

  genderLabels.forEach(({ label, rows }) => {
    const grades = countGrades(rows);
    const summaryRow: any[] = ['', '', '', '', '', label, grades.A, grades.B, grades.C, grades.D, grades.F, grades.INC, grades.ABS, grades.PASS, grades.FAIL, grades.TOTAL];
    if (isSenior) {
      const divs = countDivisions(rows);
      summaryRow.push('', '', '', '', divs.I, divs.II, divs.III, divs.IV, divs.O, divs.TOTAL);
    }
    wsData.push(summaryRow);
  });

  // Empty row before main table
  wsData.push([]);

  // === Main table header ===
  const headerRow: string[] = ['S/N', 'SEX', 'FIRST NAME', 'MIDDLE NAME', 'SUR NAME'];
  if (isSenior) {
    headerRow.push('DIVISION', 'POINTS');
  }

  // Add subject columns (marks + grade + points for senior)
  activeSubjects.forEach(subject => {
    headerRow.push(subject.name.toUpperCase());
  });

  headerRow.push('TOTAL', 'AVERAGE', 'GRADE', 'POSITION', 'REMARKS');

  // Subject grade columns
  activeSubjects.forEach(subject => {
    headerRow.push(`${subject.name.toUpperCase()} (G)`);
  });

  if (isSenior) {
    // Subject points columns
    activeSubjects.forEach(subject => {
      headerRow.push(`${subject.name.toUpperCase()} (P)`);
    });
  }

  wsData.push(headerRow);

  // === Student data rows ===
  studentRows.forEach((row, index) => {
    const dataRow: any[] = [
      String(index + 1).padStart(3, '0'),
      row.gender,
      row.firstName,
      row.middleName,
      row.surName,
    ];

    if (isSenior) {
      dataRow.push(row.division, row.totalPoints > 0 ? row.totalPoints : '');
    }

    // Subject marks
    row.subjectScores.forEach(s => {
      dataRow.push(s.score > 0 ? s.score : '');
    });

    dataRow.push(
      row.totalMarks > 0 ? row.totalMarks : '',
      row.average > 0 ? row.average : '',
      row.overallGrade,
      row.position,
      row.remarks,
    );

    // Subject grades
    row.subjectScores.forEach(s => {
      dataRow.push(s.score > 0 ? s.grade : '');
    });

    if (isSenior) {
      // Subject points
      row.subjectScores.forEach(s => {
        dataRow.push(s.points > 0 ? s.points : '');
      });
    }

    wsData.push(dataRow);
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths: XLSX.ColInfo[] = [
    { wch: 5 },  // S/N
    { wch: 5 },  // SEX
    { wch: 14 }, // First
    { wch: 14 }, // Middle
    { wch: 14 }, // Sur
  ];
  if (isSenior) {
    colWidths.push({ wch: 8 }, { wch: 7 }); // Division, Points
  }
  activeSubjects.forEach(() => colWidths.push({ wch: 8 }));
  colWidths.push({ wch: 7 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 8 }); // Total, Avg, Grade, Pos, Remarks
  activeSubjects.forEach(() => colWidths.push({ wch: 6 })); // Grade cols
  if (isSenior) {
    activeSubjects.forEach(() => colWidths.push({ wch: 6 })); // Points cols
  }
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  const sheetName = className.length > 31 ? className.substring(0, 31) : className;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Download
  const fileName = `${className.replace(/\s+/g, '_')}_${term.replace(/\s+/g, '_')}_Results_${academicYear}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
