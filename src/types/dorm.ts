export interface Dormitory {
  id: string;
  name: string;
  gender: 'male' | 'female';
  capacity: number;
  section?: 'nursery' | 'primary' | 'secondary';
  room_count?: number;
  notes: string | null;
}

export interface DormBed {
  id: string;
  dormitory_id: string;
  bed_number: number;
  room_number?: number | null;
  bed_code?: string | null;
}

export interface DormAssignment {
  id: string;
  student_id: string;
  dormitory_id: string;
  bed_id: string;
  academic_year: string;
  assigned_by: string | null;
  notes: string | null;
}

export const normalizeGender = (value?: string | null): 'male' | 'female' | null => {
  const g = (value || '').trim().toLowerCase();
  if (g.startsWith('m') || g === 'mwanaume' || g === 'kiume') return 'male';
  if (g.startsWith('f') || g === 'mwanamke' || g === 'kike') return 'female';
  return null;
};
