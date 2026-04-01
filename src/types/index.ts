export type UserRole = 'admin' | 'teacher' | 'parent' | 'secretary' | 'accountant' | 'head_nursery' | 'head_primary' | 'head_secondary';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Student {
  id: string;
  name: string;
  class: string;
  parentId: string;
  rollNumber: string;
  admissionDate: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  classes: string[];
  avatar?: string;
}

export interface Subject {
  id: string;
  name: string;
  maxMarks: number;
  code: string;
}

export interface Marks {
  id: string;
  studentId: string;
  subjectId: string;
  class: string;
  exam: number;
  total: number;
  grade: string;
  term: string;
  academicYear: string;
  teacherId?: string;
}

export interface Parent {
  id: string;
  name: string;
  email: string;
  linkedStudentIds: string[];
  phone: string;
}

export interface Feedback {
  id: string;
  parentId: string;
  studentId: string;
  message: string;
  date: string;
  status: 'pending' | 'reviewed';
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface GradeRange {
  grade: Grade;
  min: number;
  max: number;
  color: string;
}

export const GRADE_RANGES: GradeRange[] = [
  { grade: 'A', min: 75, max: 100, color: 'grade-a' },
  { grade: 'B', min: 65, max: 74, color: 'grade-b' },
  { grade: 'C', min: 45, max: 64, color: 'grade-c' },
  { grade: 'D', min: 30, max: 44, color: 'grade-d' },
  { grade: 'F', min: 0, max: 29, color: 'grade-f' },
];

export function calculateGrade(percentage: number): Grade {
  for (const range of GRADE_RANGES) {
    if (percentage >= range.min && percentage <= range.max) {
      return range.grade;
    }
  }
  return 'F';
}

export function getGradeColor(grade: Grade): string {
  const range = GRADE_RANGES.find(r => r.grade === grade);
  return range?.color || 'grade-f';
}
