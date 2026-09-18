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
  | "admin_credentials"
  | "secretary_credentials"
  | "accountant_credentials"
  | "head_of_school_credentials"
  | "marks_unlock_requests"
  | "family_groups"
  | "family_group_members"
  | "family_group_installments"
  | "result_release_statuses"
  | "system_alerts"
  | "marks_entry_windows"
  | "dormitories"
  | "dorm_beds"
  | "dorm_assignments";

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
    fee_installments: ["insert", "update", "delete"],
    student_custom_installments: ["insert", "update", "delete"],
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
    accountant_credentials: ["insert", "update", "delete"],
    head_of_school_credentials: ["insert", "update", "delete"],
    marks_unlock_requests: ["insert", "update", "delete"],
    family_groups: ["insert", "update", "delete"],
    family_group_members: ["insert", "update", "delete"],
    family_group_installments: ["insert", "update", "delete"],
    result_release_statuses: ["insert", "update", "delete"],
    system_alerts: ["update", "delete"],
    marks_entry_windows: ["insert", "update", "delete", "upsert"],
    dormitories: ["insert", "update", "delete"],
    dorm_beds: ["insert", "update", "delete"],
    dorm_assignments: ["insert", "update", "delete", "upsert"],
  },
  teacher: {
    students: [],
    marks: ["insert", "update", "delete", "upsert"],
    fee_payments: [],
    fee_structure: [],
    fee_installments: [],
    student_custom_installments: [],
    student_debt_history: [],
    feedback: ["update"],
    parents: [],
    teacher_assignments: [],
    teacher_class_students: ["insert", "delete", "upsert"],
    subjects: [],
    academic_years: [],
    announcements: [],
    teachers: [],
    admin_credentials: [],
    secretary_credentials: [],
    accountant_credentials: [],
    head_of_school_credentials: [],
    marks_unlock_requests: ["insert", "update"],
    family_groups: [],
    family_group_members: [],
    family_group_installments: [],
    result_release_statuses: [],
    system_alerts: [],
    marks_entry_windows: [],
    dormitories: [],
    dorm_beds: [],
    dorm_assignments: [],
  },
  secretary: {
    students: ["insert", "update", "delete"],
    marks: [],
    fee_payments: [],
    fee_structure: [],
    fee_installments: [],
    student_custom_installments: [],
    student_debt_history: [],
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
    accountant_credentials: [],
    head_of_school_credentials: [],
    marks_unlock_requests: [],
    family_groups: [],
    family_group_members: [],
    family_group_installments: [],
    result_release_statuses: [],
    system_alerts: [],
    marks_entry_windows: [],
    dormitories: ["insert", "update", "delete"],
    dorm_beds: [],
    dorm_assignments: ["insert", "update", "delete", "upsert"],
  },
  accountant: {
    students: [],
    marks: [],
    fee_payments: ["insert", "update", "delete"],
    fee_structure: ["insert", "update", "delete"],
    fee_installments: ["insert", "update", "delete"],
    student_custom_installments: ["insert", "update", "delete"],
    student_debt_history: ["insert", "update", "delete"],
    feedback: ["update"],
    parents: [],
    teacher_assignments: [],
    teacher_class_students: [],
    subjects: [],
    academic_years: [],
    announcements: [],
    teachers: [],
    admin_credentials: [],
    secretary_credentials: [],
    accountant_credentials: [],
    head_of_school_credentials: [],
    marks_unlock_requests: [],
    family_groups: ["insert", "update", "delete"],
    family_group_members: ["insert", "update", "delete"],
    family_group_installments: ["insert", "update", "delete"],
    result_release_statuses: [],
    system_alerts: ["update"],
    marks_entry_windows: [],
    dormitories: [],
    dorm_beds: [],
    dorm_assignments: [],
  },
  parent: {
    students: [],
    marks: [],
    fee_payments: [],
    fee_structure: [],
    fee_installments: [],
    student_custom_installments: [],
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
    accountant_credentials: [],
    head_of_school_credentials: [],
    marks_unlock_requests: [],
    family_groups: [],
    family_group_members: [],
    family_group_installments: [],
    result_release_statuses: [],
    system_alerts: [],
    marks_entry_windows: [],
    dormitories: [],
    dorm_beds: [],
    dorm_assignments: [],
  },
  head_nursery: {
    students: [],
    marks: ["insert", "update", "delete", "upsert"],
    fee_payments: [],
    fee_structure: [],
    fee_installments: [],
    student_custom_installments: [],
    student_debt_history: [],
    feedback: ["update", "delete"],
    parents: [],
    teacher_assignments: ["insert", "update", "delete"],
    teacher_class_students: ["insert", "delete", "upsert"],
    subjects: ["insert", "update", "delete"],
    academic_years: [],
    announcements: ["insert", "update", "delete"],
    teachers: [],
    admin_credentials: [],
    secretary_credentials: [],
    accountant_credentials: [],
    head_of_school_credentials: [],
    marks_unlock_requests: ["update", "delete"],
    family_groups: [],
    family_group_members: [],
    family_group_installments: [],
    result_release_statuses: ["insert", "update", "delete"],
    system_alerts: [],
    marks_entry_windows: ["insert", "update", "delete", "upsert"],
    dormitories: [],
    dorm_beds: [],
    dorm_assignments: [],
  },
  head_primary: {
    students: [],
    marks: ["insert", "update", "delete", "upsert"],
    fee_payments: [],
    fee_structure: [],
    fee_installments: [],
    student_custom_installments: [],
    student_debt_history: [],
    feedback: ["update", "delete"],
    parents: [],
    teacher_assignments: ["insert", "update", "delete"],
    teacher_class_students: ["insert", "delete", "upsert"],
    subjects: ["insert", "update", "delete"],
    academic_years: [],
    announcements: ["insert", "update", "delete"],
    teachers: [],
    admin_credentials: [],
    secretary_credentials: [],
    accountant_credentials: [],
    head_of_school_credentials: [],
    marks_unlock_requests: ["update", "delete"],
    family_groups: [],
    family_group_members: [],
    family_group_installments: [],
    result_release_statuses: ["insert", "update", "delete"],
    system_alerts: [],
    marks_entry_windows: ["insert", "update", "delete", "upsert"],
    dormitories: [],
    dorm_beds: [],
    dorm_assignments: [],
  },
  head_secondary: {
    students: [],
    marks: ["insert", "update", "delete", "upsert"],
    fee_payments: [],
    fee_structure: [],
    fee_installments: [],
    student_custom_installments: [],
    student_debt_history: [],
    feedback: ["update", "delete"],
    parents: [],
    teacher_assignments: ["insert", "update", "delete"],
    teacher_class_students: ["insert", "delete", "upsert"],
    subjects: ["insert", "update", "delete"],
    academic_years: [],
    announcements: ["insert", "update", "delete"],
    teachers: [],
    admin_credentials: [],
    secretary_credentials: [],
    accountant_credentials: [],
    head_of_school_credentials: [],
    marks_unlock_requests: ["update", "delete"],
    family_groups: [],
    family_group_members: [],
    family_group_installments: [],
    result_release_statuses: ["insert", "update", "delete"],
    system_alerts: [],
    marks_entry_windows: ["insert", "update", "delete", "upsert"],
    dormitories: [],
    dorm_beds: [],
    dorm_assignments: [],
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

    const classesWithStreams = new Set([
      "Primary 1",
      "Primary 2",
      "Primary 3",
      "Primary 4",
      "Primary 5",
      "Primary 6",
      "Primary 7",
      "Senior 1",
      "Senior 2",
      "Senior 3",
      "Senior 4",
    ]);

    const normalizeMarksTerm = (record: Record<string, unknown>): Record<string, unknown> => {
      if (table === "marks" && typeof record.term === "string") {
        const testMatch = record.term.match(/^Test\s+(\d+)$/i);
        if (testMatch) {
          return { ...record, term: `Series ${testMatch[1]}` };
        }
      }
      return record;
    };

    const normalizeStudentScopedRecords = async (
      records: Record<string, unknown>[]
    ): Promise<Record<string, unknown>[]> => {
      if (!["marks", "teacher_class_students"].includes(table) || records.length === 0) {
        return records;
      }

      const studentIds = Array.from(
        new Set(
          records
            .map((record) => (typeof record.student_id === "string" ? record.student_id : ""))
            .filter(Boolean)
        )
      );

      if (studentIds.length === 0) {
        return records;
      }

      const { data: studentRows, error: studentError } = await supabase
        .from("students")
        .select("id, class, stream")
        .in("id", studentIds);

      if (studentError) throw studentError;

      const studentMap = new Map((studentRows || []).map((student) => [student.id, student]));

      return records.map((record) => {
        const studentId = typeof record.student_id === "string" ? record.student_id : null;
        const student = studentId ? studentMap.get(studentId) : null;

        if (!student) {
          return record;
        }

        const recordClass = typeof record.class === "string" ? record.class : (typeof student.class === "string" ? student.class : record.class);
        const normalizedStream = typeof recordClass === "string" && classesWithStreams.has(recordClass)
          ? (student.stream ?? null)
          : null;

        return {
          ...record,
          class: recordClass,
          stream: normalizedStream,
        };
      });
    };

    const applyMatchFilters = (queryBuilder: any, filters: Record<string, unknown>) => {
      let scopedQuery = queryBuilder;

      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          if (value.length === 0) continue;
          scopedQuery = scopedQuery.in(key, value);
        } else if (value === null) {
          scopedQuery = scopedQuery.is(key, null);
        } else {
          scopedQuery = scopedQuery.eq(key, value);
        }
      }

      return scopedQuery;
    };

    // Series-level gate: teachers can only write marks when Admin/Head has opened that series
    if (table === "marks" && userRole === "teacher" && ["insert", "update", "upsert"].includes(operation)) {
      const records = Array.isArray(data) ? data : data ? [data] : [];
      const combos = new Map<string, { class: string; term: string; academic_year: string }>();

      for (const record of records) {
        const cls = typeof record.class === "string" ? record.class : "";
        const rawTerm = typeof record.term === "string" ? record.term : "";
        const term = rawTerm.replace(/^Test\s+/i, "Series ");
        const year = typeof record.academic_year === "string" ? record.academic_year : "";
        if (cls && term && year) {
          combos.set(`${cls}|${term}|${year}`, { class: cls, term, academic_year: year });
        }
      }

      for (const combo of combos.values()) {
        const { data: windowRow, error: windowError } = await supabase
          .from("marks_entry_windows")
          .select("is_open")
          .eq("class", combo.class)
          .eq("term", combo.term)
          .eq("academic_year", combo.academic_year)
          .maybeSingle();

        if (windowError) throw windowError;

        if (!windowRow || windowRow.is_open !== true) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `${combo.term} for ${combo.class} (${combo.academic_year}) is not open yet. Please wait for Admin or Head of School to open it.`,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    let result;

    switch (operation) {
      case "insert": {
        if (!data) {
          return new Response(
            JSON.stringify({ success: false, error: "Data required for insert" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const normalizedRecords = await normalizeStudentScopedRecords(
          (Array.isArray(data) ? data : [data]).map((record) => normalizeMarksTerm(record as Record<string, unknown>))
        );
        const insertPayload = Array.isArray(data) ? normalizedRecords : normalizedRecords[0];

        const { data: insertData, error } = await supabase
          .from(table)
          .insert(insertPayload)
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

        const updateQuery = applyMatchFilters(
          supabase.from(table).update(data as Record<string, unknown>),
          match
        );

        const { data: updateData, error } = await updateQuery.select();

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

        if (table === "subjects") {
          const subjectId = typeof match.id === "string" ? match.id : null;

          if (!subjectId) {
            return new Response(
              JSON.stringify({ success: false, error: "Subject id is required for delete" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const [marksUsage, assignmentsUsage, classStudentsUsage, unlockUsage] = await Promise.all([
            supabase.from("marks").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
            supabase.from("teacher_assignments").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
            supabase.from("teacher_class_students").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
            supabase.from("marks_unlock_requests").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
          ]);

          const usageErrors = [marksUsage.error, assignmentsUsage.error, classStudentsUsage.error, unlockUsage.error].filter(Boolean);
          if (usageErrors.length > 0) {
            throw usageErrors[0];
          }

          const hasHistory = [marksUsage.count, assignmentsUsage.count, classStudentsUsage.count, unlockUsage.count]
            .some((count) => (count ?? 0) > 0);

          if (hasHistory) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Subject cannot be deleted because it already has historical marks or class assignments. Edit the subject instead so old records remain visible.",
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const deleteQuery = applyMatchFilters(supabase.from(table).delete(), match);
        const { data: deleteData, error } = await deleteQuery.select();

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
        const normalizedRecords = await normalizeStudentScopedRecords(
          (Array.isArray(data) ? data : [data]).map((record) => normalizeMarksTerm(record as Record<string, unknown>))
        );
        const normalizedData = Array.isArray(data) ? normalizedRecords : normalizedRecords[0];

        const upsertOptions: Record<string, string> = {};
        if (table === "marks") {
          upsertOptions.onConflict = "student_id,subject_id,term,academic_year";
        } else if (table === "teacher_assignments") {
          upsertOptions.onConflict = "teacher_id,class,subject_id,academic_year,stream";
        } else if (table === "teacher_class_students") {
          upsertOptions.onConflict = "teacher_id,student_id,class,subject_id,academic_year";
        }
        const { data: upsertData, error } = await supabase
          .from(table)
          .upsert(normalizedData, upsertOptions)
          .select();

        if (error) throw error;
        result = upsertData;
        break;
      }
    }

    // Broadcast mutation event so all connected clients refresh
    try {
      const broadcastChannel = supabase.channel(`table-changes-${table}`);
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'mutation',
        payload: { table, operation },
      });
      await supabase.removeChannel(broadcastChannel);
    } catch (broadcastErr) {
      console.warn('Broadcast failed (non-fatal):', broadcastErr);
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
