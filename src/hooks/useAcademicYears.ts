import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AcademicYear {
  id: string;
  year_name: string;
  is_current: boolean;
}

export function useAcademicYears() {
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [currentYear, setCurrentYear] = useState<string>('2024-2025');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAcademicYears = async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('year_name, is_current')
        .order('year_name', { ascending: false });

      if (error) {
        console.error('Error fetching academic years:', error);
        // Fallback to default years
        setAcademicYears(['2024-2025', '2023-2024']);
        setCurrentYear('2024-2025');
      } else {
        const years = data?.map((y: { year_name: string }) => y.year_name) || [];
        setAcademicYears(years.length > 0 ? years : ['2024-2025']);
        
        const current = data?.find((y: { is_current: boolean }) => y.is_current);
        setCurrentYear(current?.year_name || years[0] || '2024-2025');
      }
      setLoading(false);
    };

    fetchAcademicYears();
  }, []);

  return { academicYears, currentYear, loading };
}
