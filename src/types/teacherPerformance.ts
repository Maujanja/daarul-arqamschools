export type PerformanceTape = 'green' | 'yellow' | 'red';

export interface TeacherPerformanceContext {
  className: string;
  stream: string | null;
  subjectName: string;
}

export interface TeacherPerformanceLetter {
  teacherId: string;
  teacherName: string;
  academicYear: string;
  term: string;
  examDate: string | null;
  average: number;
  grade: string;
  tape: PerformanceTape;
  markCount: number;
  classes: string[];
  contexts: TeacherPerformanceContext[];
  lowestStudents: { name: string; average: number }[];
}

export const tapeDetails: Record<PerformanceTape, { label: string; summary: string; className: string }> = {
  green: { label: 'Green Tape', summary: 'Congratulations', className: 'border-success/40 bg-success/10 text-success' },
  yellow: { label: 'Yellow Tape', summary: 'Increase Effort', className: 'border-warning/40 bg-warning/10 text-warning' },
  red: { label: 'Red Tape', summary: 'Performance Warning', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
};
