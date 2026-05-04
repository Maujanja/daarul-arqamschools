import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

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

  if (!BEEM_API_KEY || !BEEM_SECRET_KEY) {
    return new Response(JSON.stringify({ success: false, error: "Beem credentials not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { class_name, term, academic_year } = body || {};
  if (!class_name || !term || !academic_year) {
    return new Response(JSON.stringify({ success: false, error: "Missing class_name/term/academic_year" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, class, parent_phone")
    .eq("class", class_name);

  const refKeyBase = `${class_name}:${term}:${academic_year}`;
  const summary = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const s of students ?? []) {
    const phone = normalizePhone(s.parent_phone);
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

  return new Response(JSON.stringify({ success: true, summary }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});