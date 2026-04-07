/**
 * Senior Grading System
 * Points, Divisions, and Test Naming for Senior 1-4
 */

// Check if a class is Senior level
export const isSeniorClass = (className: string): boolean => {
  return /^Senior\s+[1-4]/i.test(className.trim());
};

// Check if a class is Primary level (Primary 1-7)
export const isPrimaryClass = (className: string): boolean => {
  return /^Primary\s+[1-7]/i.test(className.trim());
};

// Check if a class uses max 50 marks (Primary 4 and Primary 7)
export const isMax50Class = (className: string): boolean => {
  return /^Primary\s+(4|7)/i.test(className.trim());
};

// Get the maximum marks for a class
export const getMaxMarksForClass = (className: string): number => {
  return isMax50Class(className) ? 50 : 100;
};

/**
 * Primary Grading System
 * A (81-100), B (61-80), C (41-60), D (21-40), E (0-20)
 */
export type PrimaryGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export const calculatePrimaryGrade = (score: number): PrimaryGrade => {
  if (score >= 81) return 'A';
  if (score >= 61) return 'B';
  if (score >= 41) return 'C';
  if (score >= 21) return 'D';
  return 'E';
};

/**
 * Calculate grade based on class level
 * Primary (max 100): A(81-100), B(61-80), C(41-60), D(21-40), E(0-20)
 * Primary 4 & 7 (max 50): Scale proportionally - A(41-50), B(31-40), C(21-30), D(11-20), E(0-10)
 * Senior/Others: A(75-100), B(65-74), C(45-64), D(30-44), F(0-29)
 */
export const calculateGradeForClass = (score: number, className: string): string => {
  if (isPrimaryClass(className) || isNurseryClass(className)) {
    if (isMax50Class(className)) {
      // Primary 4 & 7: max 50 grading
      if (score >= 41) return 'A';
      if (score >= 31) return 'B';
      if (score >= 21) return 'C';
      if (score >= 11) return 'D';
      return 'E';
    }
    return calculatePrimaryGrade(score);
  }
  // Senior / default grading
  if (score >= 75) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  if (score >= 30) return 'D';
  return 'F';
};

// Check if Senior 1 or Senior 3
export const isSenior1or3 = (className: string): boolean => {
  return /^Senior\s+[13]$/i.test(className.trim());
};

// Check if Nursery class (Baby Class, Kindergarten I, Kindergarten II)
export const isNurseryClass = (className: string): boolean => {
  const c = className.trim();
  return c === 'Baby Class' || c === 'Kindergarten I' || c === 'Kindergarten II';
};

// Check if Senior 2 or Senior 4
export const isSenior2or4 = (className: string): boolean => {
  return /^Senior\s+[24]$/i.test(className.trim());
};

/**
 * Grade to Points conversion for Senior classes
 * A (75-100) = 1 point
 * B (65-74) = 2 points
 * C (45-64) = 3 points
 * D (30-44) = 4 points
 * F (0-29) = 5 points
 */
export const gradeToPoints = (grade: string): number => {
  switch (grade.toUpperCase()) {
    case 'A': return 1;
    case 'B': return 2;
    case 'C': return 3;
    case 'D': return 4;
    case 'F': return 5;
    default: return 5;
  }
};

export const scoreToPoints = (score: number): number => {
  if (score >= 75) return 1;
  if (score >= 65) return 2;
  if (score >= 45) return 3;
  if (score >= 30) return 4;
  return 5;
};

/**
 * Calculate Division based on best 7 subjects' points
 * Division 1: 7-17 points
 * Division 2: 18-21 points
 * Division 3: 22-25 points
 * Division 4: 26-33 points
 * Division 0: 34-35 points
 */
export const calculateDivision = (subjectScores: number[]): { division: string; totalPoints: number; bestSevenPoints: number[] } => {
  if (subjectScores.length === 0) {
    return { division: '-', totalPoints: 0, bestSevenPoints: [] };
  }

  // Convert scores to points and sort ascending (best points = lowest number)
  const allPoints = subjectScores.map(score => scoreToPoints(score));
  const sortedPoints = [...allPoints].sort((a, b) => a - b);
  
  // Take best 7 (lowest point values = best grades)
  const bestSeven = sortedPoints.slice(0, 7);
  const totalPoints = bestSeven.reduce((sum, p) => sum + p, 0);

  let division: string;
  if (totalPoints >= 7 && totalPoints <= 17) {
    division = 'I';
  } else if (totalPoints >= 18 && totalPoints <= 21) {
    division = 'II';
  } else if (totalPoints >= 22 && totalPoints <= 25) {
    division = 'III';
  } else if (totalPoints >= 26 && totalPoints <= 33) {
    division = 'IV';
  } else if (totalPoints >= 34) {
    division = '0';
  } else {
    division = '-';
  }

  return { division, totalPoints, bestSevenPoints: bestSeven };
};

/**
 * Series naming mapping
 * Senior 1 & 3: CAT 1, CAT 2, TERMINAL, CAT 3, CAT 4, ANNUAL (6 tests)
 * Nursery (Baby Class, KG I, KG II): CAT 1, CAT 2, TERMINAL, CAT 3, CAT 4, ANNUAL (6 tests)
 * Senior 2 & 4: Series 1-11
 * Primary: Series 1-11
 */

// CAT-based series name mapping (Senior 1&3 + Nursery, Series 1-6 only)
const CAT_SERIES_NAMES: Record<string, string> = {
  'Series 1': 'CAT 1',
  'Series 2': 'CAT 2',
  'Series 3': 'TERMINAL',
  'Series 4': 'CAT 3',
  'Series 5': 'CAT 4',
  'Series 6': 'ANNUAL',
};

/**
 * Get the display name for a test based on the class
 * @param testName - Internal test name (e.g., "Series 1")
 * @param className - Class name (e.g., "Senior 1", "Primary 3")
 * @returns Display name for the test
 */
export const getTestDisplayName = (testName: string, className: string): string => {
  if (isSenior1or3(className) || isNurseryClass(className)) {
    return CAT_SERIES_NAMES[testName] || testName;
  }
  
  // For all other classes: use "Series X" as-is
  return testName;
};

/**
 * Get all available tests for a class
 * Senior 1 & 3: 6 tests (CAT 1 to ANNUAL)
 * Others: 11 tests (Series 1 to Series 11)
 */
export const getTestsForClass = (className: string): { value: string; label: string }[] => {
  if (isSenior1or3(className) || isNurseryClass(className)) {
    return Object.entries(CAT_SERIES_NAMES).map(([value, label]) => ({
      value,
      label,
    }));
  }
  
  // For all other classes: 11 series
  return Array.from({ length: 11 }, (_, i) => ({
    value: `Series ${i + 1}`,
    label: `Series ${i + 1}`,
  }));
};

/**
 * Get series label for charts (S1, S2, etc.)
 * Senior 1 & 3: Use CAT/TERMINAL/ANNUAL labels
 * Others: S1, S2, ... S11
 */
export const getSeriesLabel = (testName: string, className: string): string => {
  if (isSenior1or3(className) || isNurseryClass(className)) {
    return CAT_SERIES_NAMES[testName] || testName;
  }
  
  const match = testName.match(/Series\s+(\d+)/i);
  if (match) {
    return `S${match[1]}`;
  }
  return testName;
};

/**
 * Get the filter label for dropdowns
 * Senior classes: "CAT/Exam" label
 * Others: "Series" label  
 */
export const getFilterLabel = (className: string): string => {
  if (isSenior1or3(className) || isNurseryClass(className)) {
    return 'CAT/Exam';
  }
  return 'Series';
};

/**
 * Division color styling
 */
export const getDivisionColor = (division: string): string => {
  switch (division) {
    case 'I': return 'text-success';
    case 'II': return 'text-primary';
    case 'III': return 'text-warning';
    case 'IV': return 'text-orange-500';
    case '0': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
};

export const getDivisionBgColor = (division: string): string => {
  switch (division) {
    case 'I': return 'bg-success/10 text-success border-success/20';
    case 'II': return 'bg-primary/10 text-primary border-primary/20';
    case 'III': return 'bg-warning/10 text-warning border-warning/20';
    case 'IV': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case '0': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted text-muted-foreground';
  }
};
