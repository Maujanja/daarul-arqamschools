import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { buildStudentProgress, canonicalTerm, type ProgressMark } from "../_shared/student-progress.ts";
import { makeProgressNotification } from "../_shared/progress-notification.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BEEM_API_KEY = Deno.env.get("BEEM_API_KEY") || "";
const BEEM_SECRET_KEY = Deno.env.get("BEEM_SECRET_KEY") || "";
const BEEM_SENDER_ID = Deno.env.get("BEEM_SENDER_ID") || "DAARUL";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function basicAuth() {
  return "Basic " + btoa(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.trim().replace(/[^0-9+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0") && p.length === 10) p = "255" + p.slice(1);
  if (p.startsWith("7") && p.length === 9) p = "255" + p;
  if (!/^255\d{9}$/.test(p)) return null;
  return p;
}

async function sendSms(phone: string, message: string) {
  try {
    const res = await fetch("https://apisms.beem.africa/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: basicAuth() },
      body: JSON.stringify({
        source_addr: BEEM_SENDER_ID,
        schedule_time: "",
        encoding: 0,
        message,
        recipients: [{ recipient_id: 1, dest_addr: phone }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.successful === false) {
      return { success: false, error: `[${res.status}] ${JSON.stringify(data)}` };
    }
    return { success: true, request_id: String(data?.request_id ?? "") };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { class_name, term, academic_year } = body || {};
  if (!class_name || !term || !academic_year) {
    return new Response(JSON.stringify({ success: false, error: "Missing class_name/term/academic_year" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Notifications can never disclose an examination that is not released.
  const { data: releases, error: releaseError } = await supabase.from("result_release_statuses")
    .select("class_name,term,academic_year,approved_by_admin").eq("class_name", class_name).eq("academic_year", academic_year);
  if (releaseError || !releases?.some(r => r.approved_by_admin && canonicalTerm(r.term) === canonicalTerm(term))) {
    return new Response(JSON.stringify({ success: false, error: "Results are not approved" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, class, parent_phone")
    .eq("class", class_name);

  const refKeyBase = `${class_name}:${term}:${academic_year}`;
  const summary = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const s of students ?? []) {
    const phone = BEEM_API_KEY && BEEM_SECRET_KEY ? normalizePhone(s.parent_phone) : null;
    if (!phone) { summary.skipped++; continue; }
    const refKey = `${refKeyBase}:${s.id}`;

    const { data: existing } = await supabase
      .from("sms_notifications_log")
      .select("id")
      .eq("notification_type", "results_approved")
      .eq("recipient_phone", phone)
      .eq("reference_key", refKey)
      .eq("status", "sent")
      .limit(1);
    if (existing && existing.length > 0) { summary.skipped++; continue; }

    const msg = `DAARUL-ARQAM SCHOOLS: Mzazi mpendwa, matokeo ya ${s.full_name} (${s.class}) kwa ${term} - ${academic_year} sasa yameidhinishwa na yanapatikana kwenye dashbodi ya mwanafunzi. Tafadhali ingia kwenye mfumo kuyakagua. Asante.`;
    const r = await sendSms(phone, msg);
    await supabase.from("sms_notifications_log").insert({
      notification_type: "results_approved",
      recipient_phone: phone,
      reference_key: refKey,
      message: msg,
      status: r.success ? "sent" : "failed",
      beem_request_id: r.request_id,
      error: r.error,
    });
    if (r.success) summary.sent++;
    else { summary.failed++; if (r.error) summary.errors.push(r.error); }
  }

  // ---- Send Web Push notifications to all parents of the class ----
  try {
    const { data: stWithParents } = await supabase
      .from("students")
      .select("id, parent_id")
      .eq("class", class_name);
    const ids = new Set<string>();
    for (const s of stWithParents ?? []) {
      // Parent users login as parent.id (when linked) or student.id (fallback)
      if (s.parent_id) ids.add(s.parent_id);
      ids.add(s.id);
    }
    if (ids.size > 0) {
      await supabase.functions.invoke("push-send", {
        body: {
          payload: {
            title: "📊 Matokeo yako yamefunguliwa",
            body: `Matokeo ya ${class_name} - ${term} (${academic_year}) sasa yanapatikana kwenye dashibodi.`,
            url: "/dashboard",
            tag: `results-${class_name}-${term}`,
            requireInteraction: false,
          },
          target: { userIdentifiers: Array.from(ids) },
        },
      });
    }
  } catch (e) {
    console.error("push-send (results) failed", e);
  }

  // Subject alerts are sent individually, never to the whole class.
  try {
    const { data: subjects, error: subjectError } = await supabase.from("subjects").select("id,name");
    if (subjectError) throw subjectError;
    const names = new Map((subjects || []).map(s => [s.id, s.name]));
    const marksByStudent = new Map<string, ProgressMark[]>();
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await supabase.from("marks").select("id,student_id,subject_id,total,term,academic_year,class")
        .eq("class", class_name).eq("academic_year", academic_year).order("id").range(offset, offset + 999);
      if (error) throw error;
      for (const row of rows || []) {
        const marks = marksByStudent.get(row.student_id) || [];
        marks.push({ ...row, subject: names.get(row.subject_id) || "Archived subject", class_name: row.class });
        marksByStudent.set(row.student_id, marks);
      }
      if ((rows || []).length < 1000) break;
    }
    const ids = Array.from(marksByStudent.keys());
    for (let offset = 0; offset < ids.length; offset += 100) {
      const { data: children, error } = await supabase.from("students").select("id,full_name,parent_id").in("id", ids.slice(offset, offset + 100));
      if (error) throw error;
      await Promise.all((children || []).map(async child => {
        const progress = buildStudentProgress(marksByStudent.get(child.id) || [], releases || [], academic_year, class_name, term);
        const notification = makeProgressNotification(child, progress);
        if (!notification || progress.latest !== canonicalTerm(term)) return;
        const { error } = await supabase.functions.invoke("push-send", { body: notification });
        if (error) throw error;
      }));
    }
  } catch {
    summary.errors.push("Some performance push notifications could not be sent.");
  }

  return new Response(JSON.stringify({ success: true, summary }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});