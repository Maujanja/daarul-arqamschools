export type PerformanceTape = 'green' | 'yellow' | 'red';

export interface TeacherPerformanceContext {
  className: string;
  stream: string | null;
  subjectName: string;
}

export interface TeacherSubjectPerformance {
  subjectName: string;
  streams: string[];
  average: number;
  grade: string;
  tape: PerformanceTape;
  markCount: number;
}

export interface TeacherPerformanceLetter {
  teacherId: string;
  teacherName: string;
  className: string;
  section: 'nursery' | 'primary' | 'secondary';
  academicYear: string;
  term: string;
  examDate: string | null;
  average: number;
  grade: string;
  tape: PerformanceTape;
  markCount: number;
  classes: string[];
  contexts: TeacherPerformanceContext[];
  subjects: TeacherSubjectPerformance[];
  lowestStudents: { name: string; average: number }[];
  signatoryName: string;
  signatoryTitle: string;
}

export const tapeDetails: Record<PerformanceTape, { label: string; summary: string; className: string }> = {
  green: { label: 'Green Tape', summary: 'Congratulations', className: 'border-success/40 bg-success/10 text-success' },
  yellow: { label: 'Yellow Tape', summary: 'Increase Effort', className: 'border-warning/40 bg-warning/10 text-warning' },
  red: { label: 'Red Tape', summary: 'Performance Warning', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
};
