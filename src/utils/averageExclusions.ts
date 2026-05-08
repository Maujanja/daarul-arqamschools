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

export function isPrimaryClass(className?: string | null): boolean {
  if (!className) return false;
  return /^primary\s/i.test(className.trim());
}

export function isExcludedFromPrimaryAverage(subjectName?: string | null, className?: string | null): boolean {
  if (!subjectName || !isPrimaryClass(className)) return false;
  return EXCLUDED_PRIMARY_SUBJECTS.has(subjectName.trim().toLowerCase());
}

// Filter out marks whose subject should be excluded for the given class
export function filterMarksForAverage<T extends { subject_name?: string | null; subjects?: { name?: string | null } | null; class?: string | null }>(
  marks: T[],
  className?: string | null,
): T[] {
  if (!isPrimaryClass(className)) return marks;
  return marks.filter(m => {
    const name = (m.subject_name ?? m.subjects?.name ?? '') as string;
    return !isExcludedFromPrimaryAverage(name, className);
  });
}
