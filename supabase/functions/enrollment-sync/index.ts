// Edge function for receiving student registrations from the external Enrollment Tracker.
// External system POSTs here with header `X-API-Key: <ENROLLMENT_INBOUND_API_KEY>`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INBOUND_KEY = Deno.env.get("ENROLLMENT_INBOUND_API_KEY") ?? "";

function classPrefix(cls: string): string {
  const c = (cls || "").trim();
  if (/^nursery/i.test(c)) return "N";
  const m = c.match(/^(Primary|Senior)\s*(\d+)/i);
  if (m) return (m[1][0].toUpperCase()) + m[2];
  // Fallback: first letter
  return c[0]?.toUpperCase() || "X";
}

function pad(n: number, width = 3) {
  return String(n).padStart(width, "0");
}

function normalizeClass(input: string): string {
  if (!input) return input;
  const s = input.trim();
  // Accept already-correct names
  if (/^(Nursery|Primary \d|Senior \d)/i.test(s)) {
    return s.replace(/^primary/i, "Primary").replace(/^senior/i, "Senior").replace(/^nursery/i, "Nursery");
  }
  // Accept P1..P7, S1..S4
  const p = s.match(/^p\s*(\d)$/i);
  if (p) return `Primary ${p[1]}`;
  const sr = s.match(/^s\s*(\d)$/i);
  if (sr) return `Senior ${sr[1]}`;
  if (/^n(ursery)?$/i.test(s)) return "Nursery";
  return s;
}

function normalizeBoarding(v: any): "day" | "boarding" {
  const s = String(v ?? "day").toLowerCase().trim();
  if (s.startsWith("board")) return "boarding";
  return "day";
}

function normalizeGender(v: any): "Male" | "Female" {
  const s = String(v ?? "").toLowerCase().trim();
  if (s.startsWith("f")) return "Female";
  return "Male";
}

async function nextRollNumber(supabase: any, cls: string): Promise<string> {
  const prefix = classPrefix(cls);
  const { data, error } = await supabase
    .from("students")
    .select("roll_number")
    .eq("class", cls)
    .like("roll_number", `${prefix}-%`);
  if (error) throw error;
  let max = 0;
  for (const row of data ?? []) {
    const m = String(row.roll_number || "").match(/^[A-Z]+-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${pad(max + 1)}`;
}

interface IncomingStudent {
  external_id?: string;
  full_name: string;
  gender?: string;
  date_of_birth?: string;
  class: string;
  stream?: string | null;
  boarding_type?: string;
  parent_name?: string;
  parent_phone?: string;
  roll_number?: string;
}

async function upsertStudent(supabase: any, raw: IncomingStudent) {
  if (!raw || !raw.full_name || !raw.class) {
    return { ok: false, error: "full_name and class are required" };
  }
  const cls = normalizeClass(raw.class);
  // Nursery boarding constraint (project rule)
  let boarding = normalizeBoarding(raw.boarding_type);
  if (/^nursery/i.test(cls)) boarding = "day";

  // Default stream for Primary 4-7 to "A" (project rule). Leave other classes as provided.
  let stream = raw.stream ?? null;
  if (!stream && /^Primary [4-7]$/i.test(cls)) stream = "A";

  const payload: Record<string, any> = {
    full_name: raw.full_name.trim(),
    class: cls,
    stream,
    gender: normalizeGender(raw.gender),
    boarding_type: boarding,
    date_of_birth: raw.date_of_birth || null,
    parent_name: raw.parent_name || null,
    parent_phone: raw.parent_phone || null,
    source: "external",
  };
  if (raw.external_id) payload.external_id = String(raw.external_id);

  // Existing by external_id?
  if (raw.external_id) {
    const { data: existing } = await supabase
      .from("students")
      .select("id, roll_number, class")
      .eq("external_id", String(raw.external_id))
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("students")
        .update(payload)
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: existing.id, roll_number: existing.roll_number, action: "updated" };
    }
  }

  payload.roll_number =
    (raw.roll_number && raw.roll_number.trim()) ||
    (await nextRollNumber(supabase, cls));

  const { data, error } = await supabase
    .from("students")
    .insert(payload)
    .select("id, roll_number")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id, roll_number: data.roll_number, action: "created" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: shared secret in X-API-Key header
  const provided =
    req.headers.get("x-api-key") ||
    req.headers.get("X-API-Key") ||
    "";
  if (!INBOUND_KEY || provided !== INBOUND_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Accept either a single student object or { students: [...] }
  const list: IncomingStudent[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.students)
    ? body.students
    : [body];

  const results: any[] = [];
  for (const item of list) {
    try {
      results.push(await upsertStudent(supabase, item));
    } catch (e: any) {
      results.push({ ok: false, error: e?.message || String(e) });
    }
  }

  const ok = results.every((r) => r.ok);
  return new Response(
    JSON.stringify({ ok, count: results.length, results }),
    {
      status: ok ? 200 : 207,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});