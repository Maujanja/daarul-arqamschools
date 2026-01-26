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
  | "secretary_credentials_public";

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
    "students", "marks", "fee_payments", "fee_structure", "student_debt_history",
    "feedback", "parents", "teacher_assignments", "teacher_class_students",
    "subjects", "academic_years", "announcements", "teachers", "teachers_public",
    "admin_credentials_public", "secretary_credentials_public"
  ],
  teacher: [
    "students", "marks", "teacher_assignments", "teacher_class_students",
    "subjects", "academic_years", "announcements", "feedback", "teachers_public", "teachers"
  ],
  secretary: [
    "students", "marks", "fee_payments", "fee_structure", "student_debt_history",
    "parents", "subjects", "academic_years", "announcements", "feedback",
    "teachers_public", "secretary_credentials_public"
  ],
  parent: [
    "students", "marks", "fee_payments", "fee_structure", "student_debt_history",
    "subjects", "academic_years", "announcements", "feedback", "parents"
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

    // Handle count-only queries
    if (countOnly) {
      let countQuery = supabase.from(table).select("*", { count: "exact", head: true });
      
      // Apply role-based filtering for count queries
      if (userRole === "parent" && userId) {
        if (table === "students") {
          countQuery = countQuery.eq("parent_id", userId);
        } else if (table === "marks" || table === "fee_payments" || table === "student_debt_history") {
          const { data: studentIds } = await supabase
            .from("students")
            .select("id")
            .eq("parent_id", userId);
          
          if (studentIds && studentIds.length > 0) {
            countQuery = countQuery.in("student_id", studentIds.map(s => s.id));
          } else {
            return new Response(
              JSON.stringify({ success: true, count: 0 }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else if (table === "feedback") {
          countQuery = countQuery.eq("parent_id", userId);
        }
      }

      // Apply filters
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              countQuery = countQuery.in(key, value);
            } else {
              countQuery = countQuery.eq(key, value);
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

    // Apply role-based data filtering for sensitive tables
    if (userRole === "parent" && userId) {
      // Parents can only see their own children's data
      if (table === "students") {
        query = query.eq("parent_id", userId);
      } else if (table === "marks" || table === "fee_payments" || table === "student_debt_history") {
        // Get student IDs for this parent first
        const { data: studentIds } = await supabase
          .from("students")
          .select("id")
          .eq("parent_id", userId);
        
        if (studentIds && studentIds.length > 0) {
          query = query.in("student_id", studentIds.map(s => s.id));
        } else {
          // No students found, return empty result
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
      // Teachers can see their own data
      if (table === "teachers") {
        query = query.eq("id", userId);
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
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
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
    if (table === "teachers" && userRole !== "admin" && Array.isArray(data)) {
      // Remove password_hash for non-admin roles
      // deno-lint-ignore no-explicit-any
      sanitizedData = data.map((teacher: any) => {
        const { password_hash, ...rest } = teacher;
        return rest;
      });
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
