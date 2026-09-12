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
      const msg = `DAARUL-ARQAM SCHOOLS: Dear ${group.parent_name}, leo ni tarehe ya kulipia awamu #${inst.installment_number} ya ada ya kundi la familia yako. Kiasi cha kulipa: ${amountTxt} (jumla ya wanafunzi wote wa kundi: ${studentNames || "watoto wako"}). Tafadhali fanya malipo. Asante.`;
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

    // Web Push to all parents/students of this family group
    try {
      const ids = new Set<string>();
      for (const sid of studentIds) ids.add(sid);
      const { data: stu } = await supabase
        .from("students")
        .select("id, parent_id")
        .in("id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
      for (const s of stu ?? []) {
        if (s.parent_id) ids.add(s.parent_id);
      }
      if (ids.size > 0) {
        await supabase.functions.invoke("push-send", {
          body: {
            payload: {
              title: "💰 Ukumbusho wa ada",
              body: `Leo ni tarehe ya kulipia awamu #${inst.installment_number} ya ada ya familia (${amountTxt}).`,
              url: "/dashboard",
              tag: `fee-family-${inst.family_group_id}-${inst.installment_number}`,
              requireInteraction: false,
            },
            target: { userIdentifiers: Array.from(ids) },
          },
        });
      }
    } catch (e) {
      console.error("push-send (family fee) failed", e);
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
      const msg = `DAARUL-ARQAM SCHOOLS: Mzazi mpendwa, leo ni tarehe ya kulipia awamu #${inst.installment_number} ya ada ya ${student.full_name} (${student.class}). Kiasi cha kulipa: ${amountTxt}. Tafadhali fanya malipo. Asante.`;
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

    // Web Push to parent/student of this special-case student
    try {
      const ids = new Set<string>([student.id]);
      const { data: stuRow } = await supabase
        .from("students")
        .select("parent_id")
        .eq("id", student.id)
        .limit(1);
      if (stuRow?.[0]?.parent_id) ids.add(stuRow[0].parent_id);
      await supabase.functions.invoke("push-send", {
        body: {
          payload: {
            title: "💰 Ukumbusho wa ada",
            body: `Leo ni tarehe ya kulipia awamu #${inst.installment_number} ya ada ya ${student.full_name} (${amountTxt}).`,
            url: "/dashboard",
            tag: `fee-special-${student.id}-${inst.installment_number}`,
            requireInteraction: false,
          },
          target: { userIdentifiers: Array.from(ids) },
        },
      });
    } catch (e) {
      console.error("push-send (special fee) failed", e);
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
        const msg = `DAARUL-ARQAM SCHOOLS: Mzazi mpendwa, leo ni tarehe ya kulipia awamu #${inst.installment_number} ya ada ya ${student.full_name} (${student.class}). Kiasi cha kulipa: ${amountTxt}. Tafadhali fanya malipo. Asante.`;
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

      // Web Push to this student's parent/student account
      try {
        const ids = new Set<string>([student.id]);
        const { data: stuRow } = await supabase
          .from("students")
          .select("parent_id")
          .eq("id", student.id)
          .limit(1);
        if (stuRow?.[0]?.parent_id) ids.add(stuRow[0].parent_id);
        await supabase.functions.invoke("push-send", {
          body: {
            payload: {
              title: "💰 Ukumbusho wa ada",
              body: `Leo ni tarehe ya kulipia awamu #${inst.installment_number} ya ada ya ${student.full_name} (${amountTxt}).`,
              url: "/dashboard",
              tag: `fee-class-${student.id}-${inst.installment_number}`,
              requireInteraction: false,
            },
            target: { userIdentifiers: Array.from(ids) },
          },
        });
      } catch (e) {
        console.error("push-send (class fee) failed", e);
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
    let alertInserted = false;
    if (balance <= 0) {
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
        alertInserted = true;
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
        alertInserted = true;
      }
    }

    // Broadcast realtime event so NotificationBell refreshes immediately
    // Send push notification when balance is low/zero — independent of whether
    // a new system_alerts row was inserted, so that admins who subscribed AFTER
    // today's alert was created still receive the push, and so re-runs of the
    // cron (or manual triggers) keep pushing while balance stays low.
    // Dedupe per day using sms_notifications_log so we don't spam.
    if (balance <= 0 || balance < LOW_CREDIT_THRESHOLD) {
      // Fire ONCE per low/zero cycle: only push if we haven't already pushed
      // since the last time the balance was healthy. When balance recovers
      // above the threshold, we insert a "recovery" marker so the next dip
      // pushes again.
      const stateKey = balance <= 0 ? "zero" : "low";
      const { data: lastRecovery } = await supabase
        .from("sms_notifications_log")
        .select("created_at")
        .eq("notification_type", "beem_credit_push")
        .eq("reference_key", "beem_credit_recovery")
        .order("created_at", { ascending: false })
        .limit(1);
      const recoveryAt = lastRecovery?.[0]?.created_at;

      const { data: lastPush } = await supabase
        .from("sms_notifications_log")
        .select("id, reference_key, created_at")
        .eq("notification_type", "beem_credit_push")
        .like("reference_key", "beem_%_push_cycle")
        .order("created_at", { ascending: false })
        .limit(1);
      const lastPushAt = lastPush?.[0]?.created_at;
      const lastPushState = lastPush?.[0]?.reference_key;

      // Already pushed in this cycle (no recovery since)?
      const alreadyInCycle =
        !!lastPushAt &&
        (!recoveryAt || new Date(lastPushAt) > new Date(recoveryAt)) &&
        // re-push only if state escalated from "low" -> "zero"
        !(lastPushState === "beem_low_push_cycle" && stateKey === "zero");

      if (!alreadyInCycle) {
        const pushKey = `beem_${stateKey}_push_cycle`;
        try {
          const isZero = balance <= 0;
          await supabase.functions.invoke("push-send", {
            body: {
              payload: {
                title: isZero ? "⚡ Beem credits zimeisha" : "⚠️ Beem credits zinaisha",
                body: isZero
                  ? `Salio la SMS limefika 0. Bulk SMS hazitatoka mpaka ujaze credits.`
                  : `Salio la SMS limepungua (${balance}). Tafadhali jaza credits hivi karibuni.`,
                url: "/dashboard",
                tag: "beem-credit",
                requireInteraction: true,
              },
              target: { roles: ["admin", "accountant"] },
            },
          });
          await logSms(supabase, {
            notification_type: "beem_credit_push",
            recipient_phone: "push-broadcast",
            reference_key: pushKey,
            message: `push sent for balance=${balance}`,
            status: "sent",
          });
        } catch (e) {
          console.error("push-send (beem credit) failed", e);
        }
      }
    } else {
      // Balance is healthy — clear any stale credit alerts so users stop
      // seeing "credits exhausted" notifications after a top-up.
      try {
        await supabase
          .from("system_alerts")
          .delete()
          .in("alert_type", ["zero_credit", "low_credit"]);
      } catch (e) {
        console.error("clearing stale credit alerts failed", e);
      }
      // Record a recovery marker so a future dip
      // counts as a new cycle and pushes again. Insert at most once per day.

      const recoveryKeyToday = `beem_credit_recovery_${today}`;
      const recordedToday = await alreadySent(
        supabase,
        "beem_credit_push",
        "push-broadcast",
        recoveryKeyToday
      );
      if (!recordedToday) {
        await logSms(supabase, {
          notification_type: "beem_credit_push",
          recipient_phone: "push-broadcast",
          reference_key: "beem_credit_recovery",
          message: `balance healthy=${balance}`,
          status: "sent",
        });
        await logSms(supabase, {
          notification_type: "beem_credit_push",
          recipient_phone: "push-broadcast",
          reference_key: recoveryKeyToday,
          message: `recovery marker for ${today}`,
          status: "sent",
        });
      }
    }

    if (alertInserted) {
      try {
        const ch = supabase.channel("table-changes-system_alerts");
        await ch.send({ type: "broadcast", event: "mutation", payload: { table: "system_alerts" } });
        await supabase.removeChannel(ch);
      } catch (e) {
        console.error("broadcast failed", e);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, summary }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});