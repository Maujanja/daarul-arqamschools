import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TeacherPerformanceLetter } from '@/types/teacherPerformance';

export function useTeacherPerformanceLetters(academicYear: string, term: string) {
  const { user } = useAuth();
  const [letters, setLetters] = useState<TeacherPerformanceLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !academicYear || !term) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('teacher-performance-letters', {
        body: { userRole: user.role, userId: user.id, academicYear, term },
      });
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Unable to load performance letters');
      setLetters(data.data || []);
    } catch (caught) {
      setLetters([]);
      setError(caught instanceof Error ? caught.message : 'Unable to load performance letters');
    } finally {
      setLoading(false);
    }
  }, [academicYear, term, user]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { letters, loading, error, refresh };
}
