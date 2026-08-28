import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

type AllowedTable = 
  | "students" 
  | "marks" 
  | "fee_payments" 
  | "fee_structure" 
  | "fee_installments"
  | "student_custom_installments"
  | "student_debt_history" 
  | "feedback" 
  | "parents" 
  | "teacher_assignments" 
  | "teacher_class_students" 
  | "subjects" 
  | "academic_years" 
  | "announcements"
  | "teachers"
  | "teachers_public"
  | "admin_credentials_public"
  | "secretary_credentials_public"
  | "secretary_credentials"
  | "marks_unlock_requests"
  | "family_groups"
  | "family_group_members"
  | "family_group_installments"
  | "result_release_statuses"
  | "system_alerts"
  | "marks_entry_windows"
  | "parent_login_events";

interface QueryFilters {
  [key: string]: unknown;
}

interface QueryOptions {
  select?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
  filters?: QueryFilters;
  range?: { from: number; to: number };
}

interface QueryResult<T = unknown> {
  success: boolean;
  data?: T[];
  error?: string;
}

interface CountResult {
  success: boolean;
  count?: number;
  error?: string;
}

export function useSecureQuery() {
  const { user } = useAuth();

  const query = useCallback(async <T = unknown>(
    table: AllowedTable,
    options?: QueryOptions
  ): Promise<QueryResult<T>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data: result, error } = await supabase.functions.invoke('data-query', {
        body: {
          table,
          userRole: user.role,
          userId: user.id,
          filters: options?.filters,
          select: options?.select,
          limit: options?.limit,
          offset: options?.offset,
          orderBy: options?.orderBy,
          range: options?.range,
        },
      });

      if (error) {
        console.error('Secure query error:', error);
        return { success: false, error: error.message || 'Query failed' };
      }

      return result as QueryResult<T>;
    } catch (err: unknown) {
      console.error('Secure query error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Query failed';
      return { success: false, error: errorMessage };
    }
  }, [user]);

  const count = useCallback(async (
    table: AllowedTable,
    filters?: QueryFilters
  ): Promise<number> => {
    if (!user) {
      return 0;
    }

    try {
      const { data: result, error } = await supabase.functions.invoke('data-query', {
        body: {
          table,
          userRole: user.role,
          userId: user.id,
          filters,
          countOnly: true,
        },
      });

      if (error) {
        console.error('Secure count error:', error);
        return 0;
      }

      const countResult = result as CountResult;
      return countResult.success ? (countResult.count || 0) : 0;
    } catch (err: unknown) {
      console.error('Secure count error:', err);
      return 0;
    }
  }, [user]);

  // Convenience method for fetching with common patterns
  const fetchTable = useCallback(async <T = unknown>(
    table: AllowedTable,
    filters?: QueryFilters,
    options?: Omit<QueryOptions, 'filters'>
  ): Promise<T[]> => {
    const result = await query<T>(table, { ...options, filters });
    if (result.success && result.data) {
      return result.data;
    }
    console.error(`Failed to fetch ${table}:`, result.error);
    return [];
  }, [query]);

  // Helper for paginated fetching (for large datasets like marks)
  const fetchAllPaginated = useCallback(async <T = unknown>(
    table: AllowedTable,
    filters?: QueryFilters,
    pageSize = 1000
  ): Promise<T[]> => {
    const allData: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await query<T>(table, {
        filters,
        range: { from: page * pageSize, to: (page + 1) * pageSize - 1 },
        orderBy: { column: 'id', ascending: true },
      });

      if (result.success && result.data && result.data.length > 0) {
        allData.push(...result.data);
        page++;
        hasMore = result.data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allData;
  }, [query]);

  return {
    query,
    count,
    fetchTable,
    fetchAllPaginated,
  };
}

// Standalone function for non-hook contexts (use with caution)
export async function secureQuery<T = unknown>(
  table: AllowedTable,
  userRole: string,
  userId: string,
  options?: QueryOptions
): Promise<QueryResult<T>> {
  try {
    const { data: result, error } = await supabase.functions.invoke('data-query', {
      body: {
        table,
        userRole,
        userId,
        filters: options?.filters,
        select: options?.select,
        limit: options?.limit,
        offset: options?.offset,
        orderBy: options?.orderBy,
        range: options?.range,
      },
    });

    if (error) {
      console.error('Secure query error:', error);
      return { success: false, error: error.message || 'Query failed' };
    }

    return result as QueryResult<T>;
  } catch (err: unknown) {
    console.error('Secure query error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Query failed';
    return { success: false, error: errorMessage };
  }
}

export async function secureCount(
  table: AllowedTable,
  userRole: string,
  userId: string,
  filters?: QueryFilters
): Promise<number> {
  try {
    const { data: result, error } = await supabase.functions.invoke('data-query', {
      body: {
        table,
        userRole,
        userId,
        filters,
        countOnly: true,
      },
    });

    if (error) {
      console.error('Secure count error:', error);
      return 0;
    }

    const countResult = result as CountResult;
    return countResult.success ? (countResult.count || 0) : 0;
  } catch (err: unknown) {
    console.error('Secure count error:', err);
    return 0;
  }
}
