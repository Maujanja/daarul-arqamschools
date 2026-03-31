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
  | "admin_credentials"
  | "secretary_credentials"
  | "marks_unlock_requests";

type AllowedOperation = "insert" | "update" | "delete" | "upsert";

interface DataManagementResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function useSecureData() {
  const { user } = useAuth();

  const executeOperation = useCallback(async <T = unknown>(
    operation: AllowedOperation,
    table: AllowedTable,
    data?: Record<string, unknown> | Record<string, unknown>[],
    match?: Record<string, unknown>
  ): Promise<DataManagementResult<T>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data: result, error } = await supabase.functions.invoke('data-management', {
        body: {
          operation,
          table,
          data,
          match,
          userRole: user.role,
        },
      });

      if (error) {
        console.error('Data operation error:', error);
        return { success: false, error: error.message || 'Operation failed' };
      }

      return result as DataManagementResult<T>;
    } catch (err: unknown) {
      console.error('Data operation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Operation failed';
      return { success: false, error: errorMessage };
    }
  }, [user]);

  const insert = useCallback(<T = unknown>(
    table: AllowedTable,
    data: Record<string, unknown> | Record<string, unknown>[]
  ) => executeOperation<T>('insert', table, data), [executeOperation]);

  const update = useCallback(<T = unknown>(
    table: AllowedTable,
    data: Record<string, unknown>,
    match: Record<string, unknown>
  ) => executeOperation<T>('update', table, data, match), [executeOperation]);

  const remove = useCallback(<T = unknown>(
    table: AllowedTable,
    match: Record<string, unknown>
  ) => executeOperation<T>('delete', table, undefined, match), [executeOperation]);

  const upsert = useCallback(<T = unknown>(
    table: AllowedTable,
    data: Record<string, unknown> | Record<string, unknown>[]
  ) => executeOperation<T>('upsert', table, data), [executeOperation]);

  return {
    insert,
    update,
    remove,
    upsert,
    executeOperation,
  };
}
