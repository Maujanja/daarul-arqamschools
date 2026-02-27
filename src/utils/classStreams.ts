// Class Stream definitions
// Nursery: no streams
// Primary 1-7: A, B
// Senior 1: A, B
// Senior 2: A1, A2, B1, B2
// Senior 3: A, B
// Senior 4: A, B

export const CLASS_STREAMS: Record<string, string[]> = {
  'Nursery': [],
  'Primary 1': ['A', 'B'],
  'Primary 2': ['A', 'B'],
  'Primary 3': ['A', 'B'],
  'Primary 4': ['A', 'B'],
  'Primary 5': ['A', 'B'],
  'Primary 6': ['A', 'B'],
  'Primary 7': ['A', 'B'],
  'Senior 1': ['A', 'B'],
  'Senior 2': ['A1', 'A2', 'B1', 'B2'],
  'Senior 3': ['A', 'B'],
  'Senior 4': ['A', 'B'],
};

export function getStreamsForClass(className: string): string[] {
  return CLASS_STREAMS[className] || [];
}

export function hasStreams(className: string): boolean {
  const streams = CLASS_STREAMS[className];
  return !!streams && streams.length > 0;
}

// Get display name for class + stream combination
export function getClassStreamDisplay(className: string, stream?: string | null): string {
  if (!stream) return className;
  return `${className} ${stream}`;
}

// Parse a class+stream string like "Senior 3 B" or "Senior 2 A1" into { baseClass, stream }
// Also handles already-clean class names like "Senior 3"
export function parseClassStream(classWithStream: string): { baseClass: string; stream: string | null } {
  // Check against known base class names (longest match first)
  const knownClasses = Object.keys(CLASS_STREAMS).sort((a, b) => b.length - a.length);
  
  for (const knownClass of knownClasses) {
    if (classWithStream.startsWith(knownClass)) {
      const remainder = classWithStream.slice(knownClass.length).trim();
      if (remainder) {
        // Verify remainder is a valid stream for this class
        const streams = CLASS_STREAMS[knownClass];
        if (streams && streams.includes(remainder)) {
          return { baseClass: knownClass, stream: remainder };
        }
      }
      // Exact match or no valid stream suffix
      if (!remainder) {
        return { baseClass: knownClass, stream: null };
      }
    }
  }
  
  // Fallback: return as-is
  return { baseClass: classWithStream, stream: null };
}

// Extract unique base class names from an array of class+stream strings
export function extractUniqueBaseClasses(classStrings: string[]): string[] {
  const baseClasses = new Set<string>();
  classStrings.forEach(cls => {
    const { baseClass } = parseClassStream(cls);
    baseClasses.add(baseClass);
  });
  return Array.from(baseClasses);
}
