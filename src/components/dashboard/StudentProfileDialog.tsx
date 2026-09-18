import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { Loader2, BedDouble, GraduationCap, Calendar, User, Phone, Hash } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Student {
  id: string;
  full_name: string;
  class: string;
  stream: string | null;
  roll_number: string;
  admission_date: string;
  boarding_type: string;
  gender?: string;
  avatar_url?: string | null;
  parent_phone?: string | null;
}

interface DormInfo {
  dormitory: string;
  room: number | null;
  bed: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  academicYear: string;
}

export function StudentProfileDialog({ open, onOpenChange, student, academicYear }: Props) {
  const { fetchTable } = useSecureQuery();
  const [dormInfo, setDormInfo] = useState<DormInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    setDormInfo(null);
    if (student.boarding_type !== 'boarding') return;
    const load = async () => {
      setLoading(true);
      const assignments = await fetchTable<any>('dorm_assignments', {
        student_id: student.id,
        academic_year: academicYear,
      });
      const assignment = assignments?.[0];
      if (assignment) {
        const [dorms, beds] = await Promise.all([
          fetchTable<any>('dormitories', { id: assignment.dormitory_id }),
          fetchTable<any>('dorm_beds', { id: assignment.bed_id }),
        ]);
        const bed = beds?.[0];
        setDormInfo({
          dormitory: dorms?.[0]?.name || 'Unknown',
          room: bed?.room_number ?? null,
          bed: bed?.bed_code || (bed?.bed_number ? `Bed ${bed.bed_number}` : null),
        });
      }
      setLoading(false);
    };
    load();
  }, [open, student, academicYear, fetchTable]);

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Student Profile</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <AvatarImage src={student.avatar_url || undefined} alt={student.full_name} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-xl">
              {student.full_name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-display font-semibold text-lg text-card-foreground">{student.full_name}</h3>
            <p className="text-sm text-muted-foreground">Roll No: {student.roll_number}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Class</p>
            <p className="font-semibold text-card-foreground">{student.stream ? `${student.class} ${student.stream}` : student.class}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Gender</p>
            <p className="font-semibold text-card-foreground capitalize">{student.gender || 'N/A'}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Admission</p>
            <p className="font-semibold text-card-foreground">{new Date(student.admission_date).toLocaleDateString('en-GB')}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Parent Phone</p>
            <p className="font-semibold text-card-foreground">{student.parent_phone || 'N/A'}</p>
          </div>
        </div>

        {/* Dormitory section */}
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-sm font-semibold text-card-foreground flex items-center gap-2 mb-2">
            <BedDouble className="w-4 h-4 text-primary" /> Dormitory
          </p>
          {student.boarding_type !== 'boarding' ? (
            <p className="text-sm text-muted-foreground">Day student — no dormitory</p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading dormitory details...
            </div>
          ) : dormInfo ? (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Dormitory</p>
                <p className="font-semibold text-card-foreground">{dormInfo.dormitory}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Room</p>
                <p className="font-semibold text-card-foreground">{dormInfo.room ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Bed</p>
                <p className="font-semibold text-card-foreground">{dormInfo.bed ?? 'N/A'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-warning">Boarding student — no bed assigned yet for {academicYear}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
