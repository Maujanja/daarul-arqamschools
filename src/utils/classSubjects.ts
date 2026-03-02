// Class to Subject mapping - names MUST match database exactly
// Each class level has specific subjects assigned to it

// P1-P2 subjects (exact database names)
const P12_SUBJECTS = [
  'Arithmetics',
  'English Reading',
  'English Writing',
  'Health Care',
  'Kusoma',
  'Kuandika',
  'Arts & Sports',
  'E.D.K',
  'Arabic'
];

// P3-P7 subjects (exact database names)
const P37_SUBJECTS = [
  'English',
  'Mathematics',
  'Science & Technology',
  'Science', // Alias in database
  'Historia ya Tanzania na Maadili',
  'Historia ya T.Z na Maadili', // Alias in database
  'Kiswahili',
  'Geography',
  'Arabic',
  'E.D.K',
  'Civics'
];

// Secondary subjects - 13 subjects (exact database names with SEC- codes)
const SECONDARY_SUBJECTS = [
  'English Language',
  'Arabic Language',
  'Kiswahili',
  'Historia ya Tanzania na Maadili',
  'Chemistry',
  'Biology',
  'Mathematics',
  'Book Keeping',
  'Commerce',
  'Physics',
  'Literature in English',
  'History',
  'Geography'
];

export const CLASS_SUBJECTS: { [classLevel: string]: string[] } = {
  // Nursery
  'Baby Class': P12_SUBJECTS,
  'Kindergarten I': P12_SUBJECTS,
  'Kindergarten II': P12_SUBJECTS,
  
  // Primary 1-2
  'Primary 1': P12_SUBJECTS,
  'Primary 2': P12_SUBJECTS,
  
  // Primary 3-7
  'Primary 3': P37_SUBJECTS,
  'Primary 4': P37_SUBJECTS,
  'Primary 5': P37_SUBJECTS,
  'Primary 6': P37_SUBJECTS,
  'Primary 7': P37_SUBJECTS,
  
  // Secondary
  'Senior 1': SECONDARY_SUBJECTS,
  'Senior 2': SECONDARY_SUBJECTS,
  'Senior 3': SECONDARY_SUBJECTS,
  'Senior 4': SECONDARY_SUBJECTS,
  'Form 3 A': SECONDARY_SUBJECTS,
};

// Get subjects for a specific class
export function getSubjectsForClass(className: string): string[] {
  return CLASS_SUBJECTS[className] || [];
}

// Check if a subject belongs to a class - simple direct matching
export function isSubjectForClass(subjectName: string, className: string): boolean {
  const classSubjects = CLASS_SUBJECTS[className];
  if (!classSubjects) return false;
  
  const inputLower = subjectName.toLowerCase().trim();
  
  return classSubjects.some(cs => {
    const csLower = cs.toLowerCase().trim();
    // Direct match
    if (csLower === inputLower) return true;
    return false;
  });
}

// Get class level category
export function getClassLevel(className: string): 'nursery' | 'primary_lower' | 'primary_upper' | 'secondary' | 'unknown' {
  if (className === 'Baby Class' || className === 'Kindergarten I' || className === 'Kindergarten II') {
    return 'nursery';
  }
  if (className === 'Primary 1' || className === 'Primary 2') {
    return 'primary_lower';
  }
  if (className.startsWith('Primary')) {
    return 'primary_upper';
  }
  if (className.startsWith('Senior') || className.startsWith('Form')) {
    return 'secondary';
  }
  return 'unknown';
}

// Get subject IDs that are valid for a class
export function getValidSubjectIdsForClass(
  className: string, 
  allSubjects: { id: string; name: string }[]
): string[] {
  return allSubjects
    .filter(s => isSubjectForClass(s.name, className))
    .map(s => s.id);
}
