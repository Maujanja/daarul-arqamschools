// Edge function that pulls students from the external Enrollment Tracker
// and upserts them into this system. Triggered by the Secretary dashboard
// or by an admin "Sync Now" button.
//
// Required secrets:
//   EXTERNAL_ENROLLMENT_URL      - e.g. https://.../api/students
//   EXTERNAL_ENROLLMENT_API_KEY  - sent as X-API-Key (and as Bearer fallback)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXT_URL = Deno.env.get("EXTERNAL_ENROLLMENT_URL") ?? "";
const EXT_KEY = Deno.env.get("EXTERNAL_ENROLLMENT_API_KEY") ?? "";

function classPrefix(cls: string): string {
  const c = (cls || "").trim();
  if (/^nursery/i.test(c)) return "N";
  const m = c.match(/^(Primary|Senior)\s*(\d+)/i);
  if (m) return m[1][0].toUpperCase() + m[2];
  return c[0]?.toUpperCase() || "X";
}
const pad = (n: number, w = 3) => String(n).padStart(w, "0");

function normalizeClass(input: string): string {
  if (!input) return input;
  const s = input.trim();
  if (/^(Nursery|Primary \d|Senior \d)/i.test(s)) {
    return s.replace(/^primary/i, "Primary").replace(/^senior/i, "Senior").replace(/^nursery/i, "Nursery");
  }
  const p = s.match(/^p\s*(\d)$/i);
  if (p) return `Primary ${p[1]}`;
  const sr = s.match(/^s\s*(\d)$/i);
  if (sr) return `Senior ${sr[1]}`;
  if (/^n(ursery)?$/i.test(s)) return "Nursery";
  return s;
}
function normalizeBoarding(v: any): "day" | "boarding" {
  return String(v ?? "day").toLowerCase().startsWith("board") ? "boarding" : "day";
}
function normalizeGender(v: any): "Male" | "Female" {
  return String(v ?? "").toLowerCase().startsWith("f") ? "Female" : "Male";
}

async function nextRollNumber(supabase: any, cls: string) {
  const prefix = classPrefix(cls);
  const { data } = await supabase
    .from("students").select("roll_number")
    .eq("class", cls).like("roll_number", `${prefix}-%`);
  let max = 0;
  for (const r of data ?? []) {
    const m = String(r.roll_number || "").match(/^[A-Z]+-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${pad(max + 1)}`;
}

async function upsertStudent(supabase: any, raw: any) {
  if (!raw?.full_name || !raw?.class) return { ok: false, error: "Missing full_name/class" };
  const cls = normalizeClass(raw.class);
  let boarding = normalizeBoarding(raw.boarding_type);
  if (/^nursery/i.test(cls)) boarding = "day";
  let stream = raw.stream ?? null;
  if (!stream && /^Primary [4-7]$/i.test(cls)) stream = "A";

  const payload: Record<string, any> = {
    full_name: String(raw.full_name).trim(),
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

  if (raw.external_id) {
    const { data: existing } = await supabase.from("students")
      .select("id, roll_number").eq("external_id", String(raw.external_id)).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("students").update(payload).eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, action: "updated", id: existing.id };
    }
  }

  payload.roll_number = (raw.roll_number && String(raw.roll_number).trim()) ||
    (await nextRollNumber(supabase, cls));
  const { data, error } = await supabase.from("students").insert(payload).select("id, roll_number").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, action: "created", id: data.id, roll_number: data.roll_number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!EXT_URL || !EXT_KEY) {
    return new Response(
      JSON.stringify({ error: "External enrollment system is not configured yet. Set EXTERNAL_ENROLLMENT_URL and EXTERNAL_ENROLLMENT_API_KEY secrets." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let extResp: Response;
  try {
    extResp = await fetch(EXT_URL, {
      headers: {
        "X-API-Key": EXT_KEY,
        "Authorization": `Bearer ${EXT_KEY}`,
        "Accept": "application/json",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: `Failed to reach external system: ${e?.message || e}` }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!extResp.ok) {
    const txt = await extResp.text().catch(() => "");
    return new Response(JSON.stringify({ error: `External system returned ${extResp.status}`, detail: txt.slice(0, 500) }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await extResp.json().catch(() => null);
  const list: any[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.students) ? body.students
    : Array.isArray(body?.data) ? body.data
    : [];

  if (list.length === 0) {
    return new Response(JSON.stringify({ ok: true, count: 0, message: "No students returned by external system." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results: any[] = [];
  for (const it of list) {
    try { results.push(await upsertStudent(supabase, it)); }
    catch (e: any) { results.push({ ok: false, error: e?.message || String(e) }); }
  }
  const created = results.filter(r => r.action === "created").length;
  const updated = results.filter(r => r.action === "updated").length;
  const failed = results.filter(r => !r.ok).length;
  return new Response(JSON.stringify({ ok: failed === 0, total: results.length, created, updated, failed, results }), {
    status: failed === 0 ? 200 : 207,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});