export type DormSection = 'nursery' | 'primary' | 'secondary';
export type BedStatus = 'available' | 'reserved' | 'maintenance' | 'out_of_service';

export interface Dormitory {
  id: string;
  name: string;
  code?: string | null;
  gender: 'male' | 'female';
  capacity: number;
  section?: DormSection;
  room_count?: number;
  beds_per_room?: number;
  bed_type?: 'double' | 'single';
  partitions_enabled?: boolean;
  is_active?: boolean;
  notes: string | null;
}

export interface DormBed {
  id: string;
  dormitory_id: string;
  bed_number: number;
  room_number?: number | null;
  bunk_number?: number | null;
  bed_position?: 'upper' | 'lower' | 'single';
  partition?: string | null;
  status?: BedStatus;
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
  allocated_at?: string | null;
}

export interface DormHistory {
  id: string;
  student_id: string;
  academic_year: string;
  action: 'allocated' | 'transferred' | 'removed';
  from_dormitory: string | null;
  from_room: number | null;
  from_bed: string | null;
  to_dormitory: string | null;
  to_room: number | null;
  to_bed: string | null;
  reason: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface DormWaiting {
  id: string;
  student_id: string;
  academic_year: string;
  priority: number;
  reason: string | null;
  status: 'waiting' | 'allocated' | 'cancelled';
  added_by: string | null;
  created_at: string;
}

export interface DormStudent {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
  stream: string | null;
  gender: string | null;
  boarding_type: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
}

export const normalizeGender = (value?: string | null): 'male' | 'female' | null => {
  const g = (value || '').trim().toLowerCase();
  if (g.startsWith('m') || g === 'mwanaume' || g === 'kiume') return 'male';
  if (g.startsWith('f') || g === 'mwanamke' || g === 'kike') return 'female';
  return null;
};

export const sectionOfClass = (cls?: string | null): DormSection => {
  const c = (cls || '').toLowerCase();
  if (c.startsWith('senior') || c.startsWith('form')) return 'secondary';
  if (c.startsWith('primary')) return 'primary';
  return 'nursery';
};

export const SECTION_LABEL: Record<DormSection, string> = {
  nursery: 'Nursery',
  primary: 'Primary',
  secondary: 'Senior',
};

export const POSITION_LABEL = { upper: 'Upper', lower: 'Lower', single: 'Single' } as const;

export const BED_STATUS_LABEL: Record<BedStatus | 'occupied', string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  maintenance: 'Maintenance',
  out_of_service: 'Out of Service',
};

export const bedLabel = (b?: DormBed | null) => (b ? b.bed_code || `Bed ${b.bed_number}` : '-');

export const isBoarding = (s?: DormStudent | null) => (s?.boarding_type || 'day') === 'boarding';

/** Is the student allowed in this dormitory? */
export const isEligible = (s: DormStudent | undefined, d: Dormitory) => {
  if (!s) return false;
  if (d.is_active === false) return false;
  const g = normalizeGender(s.gender);
  if (g && g !== d.gender) return false;
  if ((d.section || 'primary') !== sectionOfClass(s.class)) return false;
  return true;
};

export const NO_SPACE_MESSAGE =
  'No available boarding space for this student. Please select another eligible dormitory or place the student on the waiting list.';
