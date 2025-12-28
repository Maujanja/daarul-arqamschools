// Class to Subject mapping - names MUST match database exactly
// Each class level has specific subjects assigned to it

// Subject name aliases to handle variations in database
export const SUBJECT_ALIASES: { [key: string]: string[] } = {
  'Arithmetic': ['Arithmetics', 'Arithmetic'],
  'EDK': ['E.D.K', 'EDK'],
  'Science & Technology': ['Science & Technology', 'Science'],
  'Historia ya Tanzania na Maadili': ['Historia ya Tanzania na Maadili', 'Historia ya T.Z na Maadili'],
  'Historia ya Tanzania': ['Historia ya Tanzania', 'History of Tanzania'],
  'English': ['English', 'English Language'],
  'Arabic': ['Arabic', 'Arabic Language'],
};

// Get all possible variations of a subject name
export function getSubjectVariations(subjectName: string): string[] {
  for (const [canonical, aliases] of Object.entries(SUBJECT_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === subjectName.toLowerCase())) {
      return aliases;
    }
  }
  return [subjectName];
}

export const CLASS_SUBJECTS: { [classLevel: string]: string[] } = {
  // Primary 1-2: 9 subjects (names match database)
  'Primary 1': [
    'Arithmetics',
    'English Reading',
    'English Writing',
    'Health Care',
    'Kusoma',
    'Kuandika',
    'Arts & Sports',
    'E.D.K',
    'Arabic'
  ],
  'Primary 2': [
    'Arithmetics',
    'English Reading',
    'English Writing',
    'Health Care',
    'Kusoma',
    'Kuandika',
    'Arts & Sports',
    'E.D.K',
    'Arabic'
  ],
  
  // Primary 3-7: 9 subjects (names match database)
  'Primary 3': [
    'English',
    'Mathematics',
    'Science & Technology',
    'Historia ya Tanzania na Maadili',
    'Kiswahili',
    'Geography',
    'Arabic',
    'E.D.K',
    'Civics'
  ],
  'Primary 4': [
    'English',
    'Mathematics',
    'Science & Technology',
    'Historia ya Tanzania na Maadili',
    'Kiswahili',
    'Geography',
    'Arabic',
    'E.D.K',
    'Civics'
  ],
  'Primary 5': [
    'English',
    'Mathematics',
    'Science & Technology',
    'Historia ya Tanzania na Maadili',
    'Kiswahili',
    'Geography',
    'Arabic',
    'E.D.K',
    'Civics'
  ],
  'Primary 6': [
    'English',
    'Mathematics',
    'Science & Technology',
    'Historia ya Tanzania na Maadili',
    'Kiswahili',
    'Geography',
    'Arabic',
    'E.D.K',
    'Civics'
  ],
  'Primary 7': [
    'English',
    'Mathematics',
    'Science & Technology',
    'Historia ya Tanzania na Maadili',
    'Kiswahili',
    'Geography',
    'Arabic',
    'E.D.K',
    'Civics'
  ],
  
  // Secondary (Senior 1-4 and Form 3 A): 13 subjects (names match database)
  'Senior 1': [
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
  ],
  'Senior 2': [
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
  ],
  'Senior 3': [
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
  ],
  'Senior 4': [
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
  ],
  'Form 3 A': [
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
  ],
};

// Get subjects for a specific class
export function getSubjectsForClass(className: string): string[] {
  return CLASS_SUBJECTS[className] || [];
}

// Check if a subject belongs to a class (with alias matching)
export function isSubjectForClass(subjectName: string, className: string): boolean {
  const classSubjects = CLASS_SUBJECTS[className] || [];
  const subjectLower = subjectName.toLowerCase();
  
  return classSubjects.some(cs => {
    const csLower = cs.toLowerCase();
    // Direct match
    if (csLower === subjectLower) return true;
    
    // Check aliases
    const variations = getSubjectVariations(cs);
    if (variations.some(v => v.toLowerCase() === subjectLower)) return true;
    
    // Partial match for similar names
    if (csLower.includes(subjectLower) || subjectLower.includes(csLower)) return true;
    
    return false;
  });
}

// Get class level category
export function getClassLevel(className: string): 'primary_lower' | 'primary_upper' | 'secondary' | 'unknown' {
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
export async function getValidSubjectIdsForClass(
  className: string, 
  allSubjects: { id: string; name: string }[]
): Promise<string[]> {
  const validSubjectNames = getSubjectsForClass(className);
  
  return allSubjects
    .filter(s => isSubjectForClass(s.name, className))
    .map(s => s.id);
}
