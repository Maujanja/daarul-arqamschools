import { isPrimaryClass as isPrimaryClassBase } from './seniorGrading';

// Subjects excluded from average calculation for Primary classes only.
// EDK, Arabic, and QURAN are taught but should not influence academic averages.

const EXCLUDED_PRIMARY_SUBJECTS = new Set([
  'e.d.k',
  'edk',
  'edk nursery',
  'arabic',
  'arabic language',
  'arabic nursery',
  'quran',
]);

export function isExcludedFromPrimaryAverage(subjectName?: string | null, className?: string | null): boolean {
  if (!subjectName || !className || !isPrimaryClassBase(className)) return false;
  return EXCLUDED_PRIMARY_SUBJECTS.has(subjectName.trim().toLowerCase());
}

// Filter out marks whose subject should be excluded for the given class
export function filterMarksForAverage<T extends { subject_name?: string | null; subjects?: { name?: string | null } | null; class?: string | null }>(
  marks: T[],
  className?: string | null,
): T[] {
  if (!className || !isPrimaryClassBase(className)) return marks;
  return marks.filter(m => {
    const name = (m.subject_name ?? m.subjects?.name ?? '') as string;
    return !isExcludedFromPrimaryAverage(name, className);
  });
}

// Build a set of subject IDs to exclude for the given class
export function getExcludedSubjectIds(
  subjects: { id: string; name: string }[] | null | undefined,
  className?: string | null,
): Set<string> {
  if (!subjects || !className || !isPrimaryClassBase(className)) return new Set();
  return new Set(
    subjects
      .filter(s => isExcludedFromPrimaryAverage(s.name, className))
      .map(s => s.id),
  );
}
