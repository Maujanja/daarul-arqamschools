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
  | "admin_credentials"
  | "secretary_credentials"
  | "marks_unlock_requests";

type AllowedOperation = "insert" | "update" | "delete" | "upsert";

interface DataRequest {
  operation: AllowedOperation;
  table: AllowedTable;
  data?: Record<string, unknown> | Record<string, unknown>[];
  match?: Record<string, unknown>;
  userRole: string;
}

// Define which roles can perform which operations on which tables
const permissions: Record<string, Record<AllowedTable, AllowedOperation[]>> = {
  admin: {
    students: ["insert", "update", "delete"],
    marks: ["insert", "update", "delete", "upsert"],
    fee_payments: ["insert", "update", "delete"],
    fee_structure: ["insert", "update", "delete"],
    student_debt_history: ["insert", "update", "delete"],
    feedback: ["update", "delete"],
    parents: ["insert", "update", "delete"],
    teacher_assignments: ["insert", "update", "delete"],
    teacher_class_students: ["insert", "update", "delete"],
    subjects: ["insert", "update", "delete"],
    academic_years: ["insert", "update", "delete"],
    announcements: ["insert", "update", "delete"],
    teachers: ["insert", "update", "delete"],
    admin_credentials: ["update"],
    secretary_credentials: ["insert", "update", "delete"],
    marks_unlock_requests: ["insert", "update", "delete"],
  },
  teacher: {
    students: [],
    marks: ["insert", "update", "upsert"],
    fee_payments: [],
    fee_structure: [],
    student_debt_history: [],
    feedback: ["update"],
    parents: [],
    teacher_assignments: [],
    teacher_class_students: ["insert", "delete"],
    subjects: [],
    academic_years: [],
    announcements: [],
    teachers: [],
    admin_credentials: [],
    secretary_credentials: [],
    marks_unlock_requests: ["insert", "update"],
  },
  secretary: {
    students: ["insert", "update", "delete"],
    marks: [],
    fee_payments: ["insert", "update", "delete"],
    fee_structure: ["insert", "update", "delete"],
    student_debt_history: ["insert", "update", "delete"],
    feedback: ["update"],
    parents: ["insert", "update"],
    teacher_assignments: [],
    teacher_class_students: ["delete"],
    subjects: [],
    academic_years: [],
    announcements: [],
    teachers: [],
    admin_credentials: [],
    secretary_credentials: [],
    marks_unlock_requests: [],
  },
  parent: {
    students: [],
    marks: [],
    fee_payments: [],
    fee_structure: [],
    student_debt_history: [],
    feedback: ["insert"],
    parents: [],
    teacher_assignments: [],
    teacher_class_students: [],
    subjects: [],
    academic_years: [],
    announcements: [],
    teachers: [],
    admin_credentials: [],
    secretary_credentials: [],
    marks_unlock_requests: [],
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: DataRequest = await req.json();
    const { operation, table, data, match, userRole } = request;

    // Validate role
    if (!userRole || !permissions[userRole]) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid user role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check permission
    const allowedOps = permissions[userRole][table];
    if (!allowedOps || !allowedOps.includes(operation)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Operation '${operation}' on '${table}' not allowed for role '${userRole}'` 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result;

    switch (operation) {
      case "insert": {
        if (!data) {
          return new Response(
            JSON.stringify({ success: false, error: "Data required for insert" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data: insertData, error } = await supabase
          .from(table)
          .insert(data)
          .select();
        
        if (error) throw error;
        result = insertData;
        break;
      }

      case "update": {
        if (!data || !match) {
          return new Response(
            JSON.stringify({ success: false, error: "Data and match required for update" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        let query = supabase.from(table).update(data as Record<string, unknown>);
        
        // Apply match conditions
        for (const [key, value] of Object.entries(match)) {
          query = query.eq(key, value);
        }
        
        const { data: updateData, error } = await query.select();
        
        if (error) throw error;
        result = updateData;
        break;
      }

      case "delete": {
        if (!match) {
          return new Response(
            JSON.stringify({ success: false, error: "Match required for delete" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        let query = supabase.from(table).delete();
        
        // Apply match conditions
        for (const [key, value] of Object.entries(match)) {
          query = query.eq(key, value);
        }
        
        const { data: deleteData, error } = await query.select();
        
        if (error) throw error;
        result = deleteData;
        break;
      }

      case "upsert": {
        if (!data) {
          return new Response(
            JSON.stringify({ success: false, error: "Data required for upsert" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // For marks table, specify the unique constraint columns for proper upsert
        const upsertOptions: Record<string, string> = {};
        if (table === "marks") {
          upsertOptions.onConflict = "student_id,subject_id,term,academic_year";
        } else if (table === "teacher_assignments") {
          upsertOptions.onConflict = "teacher_id,class,subject_id,academic_year,stream";
        }
        const { data: upsertData, error } = await supabase
          .from(table)
          .upsert(data, upsertOptions)
          .select();
        
        if (error) throw error;
        result = upsertData;
        break;
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Data management error:", error);
    const errorMessage = error instanceof Error ? error.message : "Operation failed";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
