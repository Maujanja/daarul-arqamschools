import { Dormitory, DormBed, DormAssignment, DormStudent, DormHistory, DormWaiting } from '@/types/dorm';

export interface DormData {
  dorms: Dormitory[];
  beds: DormBed[];
  assignments: DormAssignment[];
  students: DormStudent[];
  history: DormHistory[];
  waiting: DormWaiting[];
  selectedYear: string;
  canManage: boolean;
  userName: string;
  reload: () => void;
  studentById: Map<string, DormStudent>;
  bedById: Map<string, DormBed>;
  dormById: Map<string, Dormitory>;
  /** bed_id -> assignment */
  assignmentByBed: Map<string, DormAssignment>;
}

export const bedIsFree = (data: DormData, bedId: string) => {
  const b = data.bedById.get(bedId);
  return !!b && (b.status || 'available') === 'available' && !data.assignmentByBed.has(bedId);
};

export const dormStats = (data: DormData, dormId: string) => {
  const beds = data.beds.filter((b) => b.dormitory_id === dormId);
  const occupied = beds.filter((b) => data.assignmentByBed.has(b.id)).length;
  const blocked = beds.filter(
    (b) => !data.assignmentByBed.has(b.id) && (b.status || 'available') !== 'available',
  ).length;
  const total = beds.length;
  return {
    total,
    occupied,
    blocked,
    available: total - occupied - blocked,
    upperFree: beds.filter((b) => b.bed_position === 'upper' && bedIsFree(data, b.id)).length,
    lowerFree: beds.filter((b) => b.bed_position === 'lower' && bedIsFree(data, b.id)).length,
    pct: total ? Math.round((occupied / total) * 1000) / 10 : 0,
  };
};
