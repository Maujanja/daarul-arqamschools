import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AcademicYear {
  id: string;
  year_name: string;
  is_current: boolean;
}

export function useAcademicYears() {
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [currentYear, setCurrentYear] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAcademicYears = async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('year_name, is_current')
        .order('year_name', { ascending: false });

      if (error) {
        console.error('Error fetching academic years:', error);
        // Fallback to current years
        setAcademicYears(['2025-2026', '2024-2025']);
        setCurrentYear('2025-2026');
      } else {
        const years = data?.map((y: { year_name: string }) => y.year_name) || [];
        setAcademicYears(years.length > 0 ? years : ['2025-2026']);
        
        // Find the current year (is_current = true)
        const current = data?.find((y: { is_current: boolean }) => y.is_current);
        const currentYearValue = current?.year_name || years[0] || '2025-2026';
        setCurrentYear(currentYearValue);
        console.log('Academic years loaded, current:', currentYearValue);
      }
      setLoading(false);
    };

    fetchAcademicYears();
  }, []);

  return { academicYears, currentYear, loading };
}
