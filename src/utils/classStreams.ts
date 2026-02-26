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
