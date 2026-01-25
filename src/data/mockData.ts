import { Student, Teacher, Subject, Marks, Parent, Feedback, User } from '@/types';

export const mockUsers: User[] = [
  { id: 'admin-1', name: 'Dr. James Wilson', email: 'admin@school.edu', role: 'admin' },
  { id: 'teacher-1', name: 'Sarah Johnson', email: 'sarah.j@school.edu', role: 'teacher' },
  { id: 'teacher-2', name: 'Michael Chen', email: 'michael.c@school.edu', role: 'teacher' },
  { id: 'parent-1', name: 'Robert Smith', email: 'robert.s@email.com', role: 'parent' },
  { id: 'parent-2', name: 'Emily Davis', email: 'emily.d@email.com', role: 'parent' },
];

export const mockStudents: Student[] = [
  { id: 'std-1', name: 'Alex Smith', class: '10-A', parentId: 'parent-1', rollNumber: '001', admissionDate: '2022-04-01' },
  { id: 'std-2', name: 'Emma Davis', class: '10-A', parentId: 'parent-2', rollNumber: '002', admissionDate: '2022-04-01' },
  { id: 'std-3', name: 'James Wilson', class: '10-A', parentId: 'parent-3', rollNumber: '003', admissionDate: '2022-04-01' },
  { id: 'std-4', name: 'Sophia Brown', class: '10-B', parentId: 'parent-4', rollNumber: '004', admissionDate: '2022-04-01' },
  { id: 'std-5', name: 'Oliver Taylor', class: '10-B', parentId: 'parent-5', rollNumber: '005', admissionDate: '2022-04-01' },
  { id: 'std-6', name: 'Ava Martinez', class: '9-A', parentId: 'parent-6', rollNumber: '006', admissionDate: '2023-04-01' },
  { id: 'std-7', name: 'Liam Anderson', class: '9-A', parentId: 'parent-7', rollNumber: '007', admissionDate: '2023-04-01' },
  { id: 'std-8', name: 'Isabella Thomas', class: '9-B', parentId: 'parent-8', rollNumber: '008', admissionDate: '2023-04-01' },
];

export const mockTeachers: Teacher[] = [
  { id: 'teacher-1', name: 'Sarah Johnson', email: 'sarah.j@school.edu', subjects: ['Mathematics'], classes: ['10-A', '10-B', '9-A'] },
  { id: 'teacher-2', name: 'Michael Chen', email: 'michael.c@school.edu', subjects: ['Science'], classes: ['10-A', '10-B', '9-A', '9-B'] },
  { id: 'teacher-3', name: 'Emily White', email: 'emily.w@school.edu', subjects: ['English'], classes: ['10-A', '10-B', '9-A', '9-B'] },
  { id: 'teacher-4', name: 'David Lee', email: 'david.l@school.edu', subjects: ['History'], classes: ['10-A', '10-B'] },
];

export const mockSubjects: Subject[] = [
  { id: 'sub-1', name: 'Mathematics', maxMarks: 100, code: 'MATH' },
  { id: 'sub-2', name: 'Science', maxMarks: 100, code: 'SCI' },
  { id: 'sub-3', name: 'English', maxMarks: 100, code: 'ENG' },
  { id: 'sub-4', name: 'History', maxMarks: 100, code: 'HIST' },
  { id: 'sub-5', name: 'Geography', maxMarks: 100, code: 'GEO' },
];

export const mockMarks: Marks[] = [
  { id: 'm-1', studentId: 'std-1', subjectId: 'sub-1', class: '10-A', exam: 86, total: 86, grade: 'A', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-2', studentId: 'std-1', subjectId: 'sub-2', class: '10-A', exam: 77, total: 77, grade: 'A', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-3', studentId: 'std-1', subjectId: 'sub-3', class: '10-A', exam: 72, total: 72, grade: 'B', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-4', studentId: 'std-2', subjectId: 'sub-1', class: '10-A', exam: 94, total: 94, grade: 'A', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-5', studentId: 'std-2', subjectId: 'sub-2', class: '10-A', exam: 84, total: 84, grade: 'A', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-6', studentId: 'std-2', subjectId: 'sub-3', class: '10-A', exam: 90, total: 90, grade: 'A', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-7', studentId: 'std-3', subjectId: 'sub-1', class: '10-A', exam: 62, total: 62, grade: 'C', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-8', studentId: 'std-3', subjectId: 'sub-2', class: '10-A', exam: 66, total: 66, grade: 'B', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-9', studentId: 'std-4', subjectId: 'sub-1', class: '10-B', exam: 75, total: 75, grade: 'A', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-10', studentId: 'std-4', subjectId: 'sub-2', class: '10-B', exam: 59, total: 59, grade: 'C', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-11', studentId: 'std-5', subjectId: 'sub-1', class: '10-B', exam: 48, total: 48, grade: 'D', term: 'Term 1', academicYear: '2024-2025' },
  { id: 'm-12', studentId: 'std-5', subjectId: 'sub-2', class: '10-B', exam: 39, total: 39, grade: 'F', term: 'Term 1', academicYear: '2024-2025' },
];

export const mockParents: Parent[] = [
  { id: 'parent-1', name: 'Robert Smith', email: 'robert.s@email.com', linkedStudentIds: ['std-1'], phone: '+1-555-0101' },
  { id: 'parent-2', name: 'Emily Davis', email: 'emily.d@email.com', linkedStudentIds: ['std-2'], phone: '+1-555-0102' },
  { id: 'parent-3', name: 'William Wilson', email: 'william.w@email.com', linkedStudentIds: ['std-3'], phone: '+1-555-0103' },
  { id: 'parent-4', name: 'Jennifer Brown', email: 'jennifer.b@email.com', linkedStudentIds: ['std-4'], phone: '+1-555-0104' },
  { id: 'parent-5', name: 'Christopher Taylor', email: 'chris.t@email.com', linkedStudentIds: ['std-5'], phone: '+1-555-0105' },
];

export const mockFeedback: Feedback[] = [
  { id: 'fb-1', parentId: 'parent-1', studentId: 'std-1', message: 'Alex has shown great improvement in Mathematics. Thank you!', date: '2024-12-15', status: 'reviewed' },
  { id: 'fb-2', parentId: 'parent-2', studentId: 'std-2', message: 'Can we schedule a parent-teacher meeting?', date: '2024-12-16', status: 'pending' },
  { id: 'fb-3', parentId: 'parent-3', studentId: 'std-3', message: 'James needs extra help with Science.', date: '2024-12-17', status: 'pending' },
];

export const classes = [
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7',
  'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'
];

// Default term count - starts from Term 1
export const DEFAULT_TERM_COUNT = 11;

// Generate terms (Term 1, Term 2, ... Term N)
export const generateTerms = (count: number = DEFAULT_TERM_COUNT): string[] => {
  return Array.from({ length: count }, (_, i) => `Term ${i + 1}`);
};

// Default terms - Term 1 to 11
export const terms = generateTerms(DEFAULT_TERM_COUNT);

export const academicYears = ['2025-2026', '2024-2025', '2023-2024'];
