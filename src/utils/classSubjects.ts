// Class to Subject mapping - names MUST match database exactly
// Each class level has specific subjects assigned to it

// Subject name aliases to handle variations in database
export const SUBJECT_ALIASES: { [key: string]: string[] } = {
  // P1-P2 subjects
  'Arithmetics': ['Arithmetics', 'Arithmetic'],
  'E.D.K': ['E.D.K', 'EDK'],
  'English Reading': ['English Reading'],
  'English Writing': ['English Writing'],
  'Health Care': ['Health Care'],
  'Kusoma': ['Kusoma'],
  'Kuandika': ['Kuandika'],
  'Arts & Sports': ['Arts & Sports'],
  
  // P3-P7 subjects
  'English': ['English'],
  'Mathematics': ['Mathematics', 'Math', 'Maths'],
  'Science & Technology': ['Science & Technology', 'Science'],
  'Historia ya Tanzania na Maadili': ['Historia ya Tanzania na Maadili', 'Historia ya T.Z na Maadili'],
  'Kiswahili': ['Kiswahili'],
  'Geography': ['Geography'],
  'Arabic': ['Arabic'],
  'Civics': ['Civics'],
  
  // Secondary subjects
  'English Language': ['English Language'],
  'Arabic Language': ['Arabic Language'],
  'Chemistry': ['Chemistry'],
  'Biology': ['Biology'],
  'Book Keeping': ['Book Keeping', 'Bookkeeping'],
  'Commerce': ['Commerce'],
  'Physics': ['Physics'],
  'Literature in English': ['Literature in English'],
  'History': ['History'],
};

// Normalize subject name for comparison
function normalizeSubjectName(name: string): string {
  return name.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/t\.z/gi, 'tanzania')
    .replace(/tz/gi, 'tanzania');
}

// Get all possible variations of a subject name
export function getSubjectVariations(subjectName: string): string[] {
  for (const [canonical, aliases] of Object.entries(SUBJECT_ALIASES)) {
    if (aliases.some(a => normalizeSubjectName(a) === normalizeSubjectName(subjectName))) {
      return aliases;
    }
  }
  return [subjectName];
}

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
  'Historia ya Tanzania na Maadili',
  'Historia ya T.Z na Maadili', // Alias in database
  'Kiswahili',
  'Geography',
  'Arabic',
  'E.D.K',
  'Civics'
];

// Secondary subjects (exact database names)
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

// Check if a subject belongs to a class (with improved matching)
export function isSubjectForClass(subjectName: string, className: string): boolean {
  const classSubjects = CLASS_SUBJECTS[className] || [];
  const normalizedInput = normalizeSubjectName(subjectName);
  
  return classSubjects.some(cs => {
    const normalizedClassSubject = normalizeSubjectName(cs);
    
    // Direct match after normalization
    if (normalizedClassSubject === normalizedInput) return true;
    
    // Check aliases
    const variations = SUBJECT_ALIASES[cs] || [cs];
    if (variations.some(v => normalizeSubjectName(v) === normalizedInput)) return true;
    
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
  return allSubjects
    .filter(s => isSubjectForClass(s.name, className))
    .map(s => s.id);
}
