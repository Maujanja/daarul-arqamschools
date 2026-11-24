import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  | "accountant_credentials"
  | "accountant_credentials_public"
  | "head_of_school_credentials"
  | "head_of_school_credentials_public"
  | "marks_unlock_requests"
  | "family_groups"
  | "family_group_members"
  | "family_group_installments"
  | "result_release_statuses"
  | "system_alerts"
  | "marks_entry_windows"
  | "parent_login_events"
  | "dormitories"
  | "dorm_beds"
  | "dorm_assignments"
  | "dorm_allocation_history"
  | "dorm_waiting_list";

interface QueryRequest {
  table: AllowedTable;
  userRole: string;
  userId?: string;
  filters?: Record<string, unknown>;
  select?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
  countOnly?: boolean;
  range?: { from: number; to: number };
}

// Define which roles can read which tables
const readPermissions: Record<string, AllowedTable[]> = {
  admin: [
    "students", "marks", "fee_payments", "fee_structure", "fee_installments",
    "student_custom_installments", "student_debt_history",
    "feedback", "parents", "teacher_assignments", "teacher_class_students",
    "subjects", "academic_years", "announcements", "teachers", "teachers_public",
    "admin_credentials_public", "secretary_credentials_public", "secretary_credentials",
    "accountant_credentials", "accountant_credentials_public",
    "head_of_school_credentials", "head_of_school_credentials_public",
    "marks_unlock_requests",
    "family_groups", "family_group_members", "family_group_installments",
    "result_release_statuses",
    "system_alerts", "marks_entry_windows", "parent_login_events",
    "dormitories", "dorm_beds", "dorm_assignments", "dorm_allocation_history", "dorm_waiting_list"
  ],
  teacher: [
    "students", "marks", "teacher_assignments", "teacher_class_students",
    "subjects", "academic_years", "announcements", "feedback", "teachers_public", "teachers",
    "marks_unlock_requests",
    "result_release_statuses", "marks_entry_windows"
  ],
  secretary: [
    "students", "parents", "subjects", "academic_years", "announcements", "feedback",
    "teachers_public", "secretary_credentials_public",
    "result_release_statuses",
    "dormitories", "dorm_beds", "dorm_assignments", "dorm_allocation_history", "dorm_waiting_list"
  ],
  accountant: [
    "students", "marks", "fee_payments", "fee_structure", "fee_installments",
    "student_custom_installments", "student_debt_history",
    "parents", "subjects", "academic_years", "announcements", "feedback",
    "teachers_public", "accountant_credentials_public",
    "family_groups", "family_group_members", "family_group_installments",
    "result_release_statuses",
    "system_alerts",
    "dormitories", "dorm_beds", "dorm_assignments"
  ],
  parent: [
    "students", "marks", "fee_payments", "fee_structure", "fee_installments",
    "student_custom_installments", "student_debt_history",
    "subjects", "academic_years", "announcements", "feedback", "parents",
    "family_groups", "family_group_members", "family_group_installments",
    "result_release_statuses",
    "dormitories", "dorm_beds", "dorm_assignments"
  ],
  head_nursery: [
    "students", "marks", "teacher_assignments", "teacher_class_students",
    "subjects", "academic_years", "announcements", "feedback", "teachers_public", "teachers",
    "marks_unlock_requests", "result_release_statuses",
    "head_of_school_credentials_public", "marks_entry_windows", "parent_login_events",
    "dormitories", "dorm_beds", "dorm_assignments", "dorm_allocation_history", "dorm_waiting_list"
  ],
  head_primary: [
    "students", "marks", "teacher_assignments", "teacher_class_students",
    "subjects", "academic_years", "announcements", "feedback", "teachers_public", "teachers",
    "marks_unlock_requests", "result_release_statuses",
    "head_of_school_credentials_public", "marks_entry_windows", "parent_login_events",
    "dormitories", "dorm_beds", "dorm_assignments", "dorm_allocation_history", "dorm_waiting_list"
  ],
  head_secondary: [
    "students", "marks", "teacher_assignments", "teacher_class_students",
    "subjects", "academic_years", "announcements", "feedback", "teachers_public", "teachers",
    "marks_unlock_requests", "result_release_statuses",
    "head_of_school_credentials_public", "marks_entry_windows", "parent_login_events",
    "dormitories", "dorm_beds", "dorm_assignments", "dorm_allocation_history", "dorm_waiting_list"
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: QueryRequest = await req.json();
    const { table, userRole, userId, filters, select, limit, offset, orderBy, countOnly, range } = request;

    // Validate role
    if (!userRole || !readPermissions[userRole]) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid user role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check read permission
    const allowedTables = readPermissions[userRole];
    if (!allowedTables.includes(table)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Read access to '${table}' not allowed for role '${userRole}'` 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve teacher identity (supports both teachers.id and teachers.user_id login IDs)
    let resolvedTeacherIds: string[] = [];
    if (userRole === "teacher" && userId) {
      const { data: teacherRows } = await supabase
        .from("teachers")
        .select("id")
        .or(`id.eq.${userId},user_id.eq.${userId}`);

      resolvedTeacherIds = Array.from(
        new Set([
          userId,
          ...(teacherRows?.map((row) => row.id).filter(Boolean) ?? []),
        ])
      );
    }

    // Expand term aliases: "Series X" ↔ "Test X" so marks stored under either name are found
    const expandTermAliases = (value: unknown): unknown => {
      const expand = (v: string): string[] => {
        const seriesMatch = v.match(/^Series\s+(\d+)$/i);
        if (seriesMatch) return [`Series ${seriesMatch[1]}`, `Test ${seriesMatch[1]}`];
        const testMatch = v.match(/^Test\s+(\d+)$/i);
        if (testMatch) return [`Series ${testMatch[1]}`, `Test ${testMatch[1]}`];
        return [v];
      };

      if (Array.isArray(value)) {
        const expanded = value.flatMap((v) => (typeof v === "string" ? expand(v) : [v]));
        return Array.from(new Set(expanded));
      }
      if (typeof value === "string") {
        const aliases = expand(value);
        return aliases.length > 1 ? aliases : value;
      }
      return value;
    };

    const normalizeTeacherFilter = (value: unknown): unknown => {
      if (userRole !== "teacher" || !userId || resolvedTeacherIds.length === 0) {
        return value;
      }

      if (Array.isArray(value)) {
        const normalized = value.map((v) => String(v));
        if (normalized.includes(userId)) {
          return Array.from(new Set([...normalized.filter((v) => v !== userId), ...resolvedTeacherIds]));
        }
        return value;
      }

      if (typeof value === "string" && value === userId) {
        return resolvedTeacherIds;
      }

      return value;
    };

    // Handle count-only queries
    if (countOnly) {
      let countQuery = supabase.from(table).select("*", { count: "exact", head: true });
      if (table === "students" && userRole !== "parent") countQuery = countQuery.neq("source", "progress_demo");
      
      // Apply role-based filtering for count queries
      if (userRole === "parent" && userId) {
        // Resolve student IDs (parent_id match or direct student ID fallback)
        const resolveIds = async (): Promise<string[]> => {
          const { data: byParent } = await supabase.from("students").select("id").eq("parent_id", userId);
          if (byParent && byParent.length > 0) return byParent.map(s => s.id);
          const { data: direct } = await supabase.from("students").select("id").eq("id", userId).maybeSingle();
          return direct ? [direct.id] : [];
        };

        if (table === "students") {
          const ids = await resolveIds();
          if (ids.length > 0) { countQuery = countQuery.in("id", ids); }
          else { return new Response(JSON.stringify({ success: true, count: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        } else if (table === "marks" || table === "fee_payments" || table === "student_debt_history" || table === "dorm_assignments") {
          const ids = await resolveIds();
          if (ids.length > 0) { countQuery = countQuery.in("student_id", ids); }
          else { return new Response(JSON.stringify({ success: true, count: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        } else if (table === "feedback") {
          countQuery = countQuery.eq("parent_id", userId);
        }
      } else if (userRole === "teacher" && userId) {
        if (table === "teachers") {
          countQuery = countQuery.or(`id.eq.${userId},user_id.eq.${userId}`);
        } else if (["teacher_assignments", "teacher_class_students", "marks_unlock_requests"].includes(table)) {
          const teacherIds = resolvedTeacherIds.length > 0 ? resolvedTeacherIds : [userId];
          countQuery = countQuery.in("teacher_id", teacherIds);
        }
      }

    // Apply filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          let normalizedValue = key === "teacher_id" ? normalizeTeacherFilter(value) : value;
          if (key === "term" && table === "marks") normalizedValue = expandTermAliases(normalizedValue);
          if (Array.isArray(normalizedValue)) {
            countQuery = countQuery.in(key, normalizedValue);
          } else {
            countQuery = countQuery.eq(key, normalizedValue);
          }
        }
      }
    }

      const { count, error } = await countQuery;
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, count: count || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build regular query
    let query = supabase.from(table).select(select || "*");
    if (table === "students" && userRole !== "parent") query = query.neq("source", "progress_demo");

    // Apply role-based data filtering for sensitive tables
    if (userRole === "parent" && userId) {
      // Parents can only see their own children's data
      // userId could be a parent record ID OR a student ID (fallback when no parent record exists)
      
      // Helper: resolve student IDs for this parent
      const resolveStudentIds = async (): Promise<string[]> => {
        // First try: find students by parent_id
        const { data: byParent } = await supabase
          .from("students")
          .select("id")
          .eq("parent_id", userId);
        
        if (byParent && byParent.length > 0) {
          return byParent.map(s => s.id);
        }
        
        // Fallback: userId might be the student's own ID
        const { data: directStudent } = await supabase
          .from("students")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        
        return directStudent ? [directStudent.id] : [];
      };

      if (table === "students") {
        const studentIds = await resolveStudentIds();
        if (studentIds.length > 0) {
          query = query.in("id", studentIds);
        } else {
          return new Response(
            JSON.stringify({ success: true, data: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (table === "marks") {
        // Allow parents to fetch class-wide marks for ranking when class filter is present
        const hasClassFilter = filters && ("class" in filters);
        if (!hasClassFilter) {
          // No class filter = personal marks only
          const studentIds = await resolveStudentIds();
          if (studentIds.length > 0) {
            query = query.in("student_id", studentIds);
          } else {
            return new Response(
              JSON.stringify({ success: true, data: [] }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        // When class filter IS present, don't restrict by student - allows ranking calculation
      } else if (table === "fee_payments" || table === "student_debt_history" || table === "dorm_assignments") {
        const studentIds = await resolveStudentIds();
        if (studentIds.length > 0) {
          query = query.in("student_id", studentIds);
        } else {
          return new Response(
            JSON.stringify({ success: true, data: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (table === "feedback") {
        query = query.eq("parent_id", userId);
      } else if (table === "parents") {
        query = query.eq("id", userId);
      }
    } else if (userRole === "teacher" && userId) {
      // Teachers can see their own record even if login id maps via teachers.user_id
      if (table === "teachers") {
        query = query.or(`id.eq.${userId},user_id.eq.${userId}`);
      } else if (["teacher_assignments", "teacher_class_students", "marks_unlock_requests"].includes(table)) {
        const teacherIds = resolvedTeacherIds.length > 0 ? resolvedTeacherIds : [userId];
        query = query.in("teacher_id", teacherIds);
      } else if (table === "feedback") {
        query = query.eq("recipient_type", "teacher");
      }
    } else if (userRole === "secretary") {
      // Secretaries can see feedback directed to them
      if (table === "feedback") {
        query = query.eq("recipient_type", "secretary");
      }
    }

    // Apply additional filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          let normalizedValue = key === "teacher_id" ? normalizeTeacherFilter(value) : value;
          if (key === "term" && table === "marks") normalizedValue = expandTermAliases(normalizedValue);
          if (Array.isArray(normalizedValue)) {
            query = query.in(key, normalizedValue);
          } else {
            query = query.eq(key, normalizedValue);
          }
        }
      }
    }

    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }

    // Apply range (for pagination)
    if (range) {
      query = query.range(range.from, range.to);
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Sanitize sensitive data before returning
    // deno-lint-ignore no-explicit-any
    let sanitizedData: any = data;
    const canViewTeacherPasswords = userRole === "admin" || userRole.startsWith("head_");
    if (table === "teachers" && !canViewTeacherPasswords && Array.isArray(data)) {
      // Remove password_hash for non-admin roles
      // deno-lint-ignore no-explicit-any
      sanitizedData = data.map((teacher: any) => {
        const { password_hash, ...rest } = teacher;
        return rest;
      });
    }

    // Approved unlocks cease to be actionable when the student is removed
    // from this teacher's subject roster. Never return those stale approvals
    // to a teacher, otherwise the global guard would lock their dashboard for
    // an edit that can no longer be completed.
    if (table === "marks_unlock_requests" && userRole === "teacher" && Array.isArray(data)) {
      const approvedRows = data.filter((row: any) => row.status === "approved" && row.student_id);
      if (approvedRows.length > 0) {
        const studentIds = Array.from(new Set(approvedRows.map((row: any) => row.student_id)));
        const teacherIds = resolvedTeacherIds.length > 0 ? resolvedTeacherIds : (userId ? [userId] : []);
        const { data: rosterRows, error: rosterError } = await supabase
          .from("teacher_class_students")
          .select("teacher_id,student_id,subject_id,class,academic_year")
          .in("teacher_id", teacherIds)
          .in("student_id", studentIds);

        if (rosterError) throw rosterError;

        const actionable = new Set((rosterRows || []).map((row) =>
          `${row.teacher_id}|${row.student_id}|${row.subject_id}|${row.class}|${row.academic_year}`
        ));
        sanitizedData = data.filter((row: any) => {
          if (row.status !== "approved" || !row.student_id) return true;
          return teacherIds.some((teacherId) => actionable.has(
            `${teacherId}|${row.student_id}|${row.subject_id}|${row.class}|${row.academic_year}`
          ));
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: sanitizedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Data query error:", error);
    const errorMessage = error instanceof Error ? error.message : "Query failed";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
