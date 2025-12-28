// Class to Subject mapping
// Each class level has specific subjects assigned to it

export const CLASS_SUBJECTS: { [classLevel: string]: string[] } = {
  // Primary 1-2: 9 subjects
  'Primary 1': [
    'Arithmetic',
    'English Reading',
    'English Writing',
    'Health Care',
    'Kusoma',
    'Kuandika',
    'Arts & Sports',
    'EDK',
    'Arabic'
  ],
  'Primary 2': [
    'Arithmetic',
    'English Reading',
    'English Writing',
    'Health Care',
    'Kusoma',
    'Kuandika',
    'Arts & Sports',
    'EDK',
    'Arabic'
  ],
  
  // Primary 3-7: 9 subjects
  'Primary 3': [
    'English',
    'Mathematics',
    'Science & Technology',
    'Historia ya Tanzania na Maadili',
    'Kiswahili',
    'Geography',
    'Arabic',
    'EDK',
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
    'EDK',
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
    'EDK',
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
    'EDK',
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
    'EDK',
    'Civics'
  ],
  
  // Secondary (Senior 1-4 and Form 3 A): 13 subjects
  'Senior 1': [
    'English',
    'Arabic Language',
    'Kiswahili',
    'Historia ya Tanzania',
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
    'English',
    'Arabic Language',
    'Kiswahili',
    'Historia ya Tanzania',
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
    'English',
    'Arabic Language',
    'Kiswahili',
    'Historia ya Tanzania',
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
    'English',
    'Arabic Language',
    'Kiswahili',
    'Historia ya Tanzania',
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
    'English',
    'Arabic Language',
    'Kiswahili',
    'Historia ya Tanzania',
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

// Check if a subject belongs to a class
export function isSubjectForClass(subjectName: string, className: string): boolean {
  const classSubjects = CLASS_SUBJECTS[className] || [];
  return classSubjects.some(s => 
    s.toLowerCase() === subjectName.toLowerCase() ||
    subjectName.toLowerCase().includes(s.toLowerCase()) ||
    s.toLowerCase().includes(subjectName.toLowerCase())
  );
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
