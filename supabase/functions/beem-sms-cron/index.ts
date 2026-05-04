import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PHONE = "255718999777";
const LOW_CREDIT_THRESHOLD = 10;

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

async function sendSms(phone: string, message: string): Promise<{ success: boolean; request_id?: string; error?: string }> {
  try {
    const res = await fetch("https://apisms.beem.africa/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(),
      },
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

async function checkBalance(): Promise<number | null> {
  try {
    const res = await fetch("https://apisms.beem.africa/public/v1/vendors/balance", {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    const bal = Number(data?.data?.credit_balance);
    return Number.isFinite(bal) ? bal : null;
  } catch {
    return null;
  }
}

function todayInTZ(tz = "Africa/Dar_es_Salaam"): string {
  // Returns YYYY-MM-DD in given timezone
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
}

async function logSms(
  supabase: ReturnType<typeof createClient>,
  entry: {
    notification_type: string;
    recipient_phone: string;
    reference_key: string;
    message: string;
    status: string;
    beem_request_id?: string;
    error?: string;
  }
) {
  await supabase.from("sms_notifications_log").insert(entry);
}

async function alreadySent(
  supabase: ReturnType<typeof createClient>,
  notification_type: string,
  recipient_phone: string,
  reference_key: string
): Promise<boolean> {
  const { data } = await supabase
    .from("sms_notifications_log")
    .select("id")
    .eq("notification_type", notification_type)
    .eq("recipient_phone", recipient_phone)
    .eq("reference_key", reference_key)
    .eq("status", "sent")
    .limit(1);
  return !!(data && data.length > 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!BEEM_API_KEY || !BEEM_SECRET_KEY) {
    return new Response(JSON.stringify({ success: false, error: "Beem credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = todayInTZ();
  const summary = {
    today,
    family_sent: 0,
    special_sent: 0,
    class_sent: 0,
    admin_sent: 0,
    skipped: 0,
    errors: [] as string[],
    balance: null as number | null,
  };

  // ------------- 1) FAMILY GROUP INSTALLMENTS DUE TODAY -------------
  const { data: familyInstallments } = await supabase
    .from("family_group_installments")
    .select("id, family_group_id, installment_number, amount, due_date, academic_year")
    .eq("due_date", today);

  for (const inst of familyInstallments ?? []) {
    const refKey = `${inst.family_group_id}:${inst.installment_number}:${inst.academic_year}`;

    // Get family group
    const { data: groupRows } = await supabase
      .from("family_groups")
      .select("id, parent_name, parent_phone")
      .eq("id", inst.family_group_id)
      .limit(1);
    const group = groupRows?.[0];
    if (!group) continue;

    const phone = normalizePhone(group.parent_phone);
    const amountTxt = `TZS ${Number(inst.amount).toLocaleString()}`;

    // Get member names
    const { data: members } = await supabase
      .from("family_group_members")
      .select("student_id")
      .eq("family_group_id", inst.family_group_id)
      .eq("academic_year", inst.academic_year);
    const studentIds = (members ?? []).map((m) => m.student_id);
    let studentNames = "";
    if (studentIds.length) {
      const { data: studs } = await supabase.from("students").select("full_name").in("id", studentIds);
      studentNames = (studs ?? []).map((s) => s.full_name).join(", ");
    }

    // Send to parent
    if (phone && !(await alreadySent(supabase, "family_installment", phone, refKey))) {
      const msg = `DAARUL-ARQAM SCHOOLS: Dear ${group.parent_name}, today is the due date for family fee installment #${inst.installment_number} of ${amountTxt} for ${studentNames || "your children"}. Please make payment. Thank you.`;
      const r = await sendSms(phone, msg);
      await logSms(supabase, {
        notification_type: "family_installment",
        recipient_phone: phone,
        reference_key: refKey,
        message: msg,
        status: r.success ? "sent" : "failed",
        beem_request_id: r.request_id,
        error: r.error,
      });
      if (r.success) summary.family_sent++;
      else summary.errors.push(`family ${refKey}: ${r.error}`);
    } else if (!phone) {
      summary.skipped++;
    }

    // Send to admin
    const adminRefKey = `family:${refKey}`;
    if (!(await alreadySent(supabase, "admin_alert", ADMIN_PHONE, adminRefKey))) {
      const adminMsg = `DAARUL-ARQAM SCHOOLS: Family group "${group.parent_name}" installment #${inst.installment_number} (${amountTxt}) for ${studentNames || "students"} is due today (${today}).`;
      const r = await sendSms(ADMIN_PHONE, adminMsg);
      await logSms(supabase, {
        notification_type: "admin_alert",
        recipient_phone: ADMIN_PHONE,
        reference_key: adminRefKey,
        message: adminMsg,
        status: r.success ? "sent" : "failed",
        beem_request_id: r.request_id,
        error: r.error,
      });
      if (r.success) summary.admin_sent++;
    }
  }

  // ------------- 2) SPECIAL CASE (CUSTOM) INSTALLMENTS DUE TODAY -------------
  const { data: customInstallments } = await supabase
    .from("student_custom_installments")
    .select("id, student_id, installment_number, amount, due_date, academic_year")
    .eq("due_date", today);

  for (const inst of customInstallments ?? []) {
    const refKey = `${inst.student_id}:${inst.installment_number}:${inst.academic_year}`;

    const { data: studs } = await supabase
      .from("students")
      .select("id, full_name, class, parent_phone")
      .eq("id", inst.student_id)
      .limit(1);
    const student = studs?.[0];
    if (!student) continue;

    // Skip if this student is already in a family group for this year (family installment supersedes)
    const { data: familyMember } = await supabase
      .from("family_group_members")
      .select("id")
      .eq("student_id", inst.student_id)
      .eq("academic_year", inst.academic_year)
      .limit(1);
    if (familyMember && familyMember.length > 0) {
      summary.skipped++;
      continue;
    }

    const phone = normalizePhone(student.parent_phone);
    const amountTxt = `TZS ${Number(inst.amount).toLocaleString()}`;

    if (phone && !(await alreadySent(supabase, "special_case_installment", phone, refKey))) {
      const msg = `DAARUL-ARQAM SCHOOLS: Dear Parent, today is the due date for fee installment #${inst.installment_number} of ${amountTxt} for ${student.full_name} (${student.class}). Please make payment. Thank you.`;
      const r = await sendSms(phone, msg);
      await logSms(supabase, {
        notification_type: "special_case_installment",
        recipient_phone: phone,
        reference_key: refKey,
        message: msg,
        status: r.success ? "sent" : "failed",
        beem_request_id: r.request_id,
        error: r.error,
      });
      if (r.success) summary.special_sent++;
      else summary.errors.push(`special ${refKey}: ${r.error}`);
    } else if (!phone) {
      summary.skipped++;
    }

    // Admin alert
    const adminRefKey = `special:${refKey}`;
    if (!(await alreadySent(supabase, "admin_alert", ADMIN_PHONE, adminRefKey))) {
      const adminMsg = `DAARUL-ARQAM SCHOOLS: Special case student ${student.full_name} (${student.class}) installment #${inst.installment_number} (${amountTxt}) is due today (${today}).`;
      const r = await sendSms(ADMIN_PHONE, adminMsg);
      await logSms(supabase, {
        notification_type: "admin_alert",
        recipient_phone: ADMIN_PHONE,
        reference_key: adminRefKey,
        message: adminMsg,
        status: r.success ? "sent" : "failed",
        beem_request_id: r.request_id,
        error: r.error,
      });
      if (r.success) summary.admin_sent++;
    }
  }

  // ------------- 2.5) CLASS-LEVEL INSTALLMENTS DUE TODAY (regular students) -------------
  const { data: classInstallments } = await supabase
    .from("fee_installments")
    .select("id, class, boarding_type, installment_number, amount, due_date, academic_year")
    .eq("due_date", today);

  // Group unique (class, academic_year, installment_number) so admin gets ONE summary SMS per group
  const adminGroupsSent = new Set<string>();

  for (const inst of classInstallments ?? []) {
    const amountTxt = `TZS ${Number(inst.amount).toLocaleString()}`;

    // Fetch all students in this class + boarding_type for the academic year
    const { data: studs } = await supabase
      .from("students")
      .select("id, full_name, class, parent_phone, boarding_type")
      .eq("class", inst.class)
      .eq("boarding_type", inst.boarding_type);

    for (const student of studs ?? []) {
      // Skip if student is in a family group for this academic year (family installment supersedes)
      const { data: familyMember } = await supabase
        .from("family_group_members")
        .select("id")
        .eq("student_id", student.id)
        .eq("academic_year", inst.academic_year)
        .limit(1);
      if (familyMember && familyMember.length > 0) {
        summary.skipped++;
        continue;
      }

      // Skip if student has custom installments (special case)
      const { data: customRows } = await supabase
        .from("student_custom_installments")
        .select("id")
        .eq("student_id", student.id)
        .eq("academic_year", inst.academic_year)
        .limit(1);
      if (customRows && customRows.length > 0) {
        summary.skipped++;
        continue;
      }

      const phone = normalizePhone(student.parent_phone);
      const refKey = `${student.id}:${inst.installment_number}:${inst.academic_year}`;

      if (phone && !(await alreadySent(supabase, "class_installment", phone, refKey))) {
        const msg = `DAARUL-ARQAM SCHOOLS: Dear Parent, today is the due date for fee installment #${inst.installment_number} of ${amountTxt} for ${student.full_name} (${student.class}). Please make payment. Thank you.`;
        const r = await sendSms(phone, msg);
        await logSms(supabase, {
          notification_type: "class_installment",
          recipient_phone: phone,
          reference_key: refKey,
          message: msg,
          status: r.success ? "sent" : "failed",
          beem_request_id: r.request_id,
          error: r.error,
        });
        if (r.success) summary.class_sent++;
        else summary.errors.push(`class ${refKey}: ${r.error}`);
      } else if (!phone) {
        summary.skipped++;
      }
    }

    // Admin: send ONE summary SMS per (class, boarding_type, installment, academic_year)
    const adminRefKey = `class:${inst.class}:${inst.boarding_type}:${inst.installment_number}:${inst.academic_year}`;
    if (!adminGroupsSent.has(adminRefKey) && !(await alreadySent(supabase, "admin_alert", ADMIN_PHONE, adminRefKey))) {
      adminGroupsSent.add(adminRefKey);
      const adminMsg = `DAARUL-ARQAM SCHOOLS: ${inst.class} (${inst.boarding_type}) fee installment #${inst.installment_number} of ${amountTxt} is due today (${today}). Parents have been notified.`;
      const r = await sendSms(ADMIN_PHONE, adminMsg);
      await logSms(supabase, {
        notification_type: "admin_alert",
        recipient_phone: ADMIN_PHONE,
        reference_key: adminRefKey,
        message: adminMsg,
        status: r.success ? "sent" : "failed",
        beem_request_id: r.request_id,
        error: r.error,
      });
      if (r.success) summary.admin_sent++;
    }
  }

  // ------------- 3) BEEM CREDIT BALANCE CHECK -------------
  const balance = await checkBalance();
  summary.balance = balance;

  if (balance !== null) {
    if (balance <= 0) {
      const dayKey = `zero_credit:${today}`;
      const { data: existing } = await supabase
        .from("system_alerts")
        .select("id")
        .eq("alert_type", "zero_credit")
        .gte("created_at", `${today}T00:00:00Z`)
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from("system_alerts").insert({
          alert_type: "zero_credit",
          title: "Beem SMS credits exhausted",
          message: `Beem Africa SMS credits have run out (balance: ${balance}). Bulk SMS notifications will FAIL until you top up credits.`,
          severity: "critical",
          target_roles: ["admin", "accountant"],
          metadata: { balance, day: today },
        });
      }
    } else if (balance < LOW_CREDIT_THRESHOLD) {
      const { data: existing } = await supabase
        .from("system_alerts")
        .select("id")
        .eq("alert_type", "low_credit")
        .gte("created_at", `${today}T00:00:00Z`)
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from("system_alerts").insert({
          alert_type: "low_credit",
          title: "Beem SMS credits running low",
          message: `Beem Africa SMS credits are low (balance: ${balance}). Please top up soon to keep automated SMS notifications running.`,
          severity: "warning",
          target_roles: ["admin", "accountant"],
          metadata: { balance, day: today },
        });
      }
    }
  }

  return new Response(JSON.stringify({ success: true, summary }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});