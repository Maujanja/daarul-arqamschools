import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ROLES = ["admin", "accountant", "head_nursery", "head_primary", "head_secondary"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let p = String(raw).trim().replace(/[^0-9+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0") && p.length === 10) p = "255" + p.slice(1);
  if ((p.startsWith("7") || p.startsWith("6")) && p.length === 9) p = "255" + p;
  return /^255\d{9}$/.test(p) ? p : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ---- Public webhook: Bpay Collection POSTs payment details here ----
    // Beem collection payload: transaction_id, amount_collected, source_currency,
    // target_currency, subscriber_msisdn, reference_number, paybill_number,
    // timestamp, mcc_network, mnc_network, network_name
    // We must reply: { transaction_id, successful: "true" | "false" }
    if (action === "callback" || body?.reference_number) {
      const transactionId = String(body?.transaction_id || "");
      const reference = String(body?.reference_number || "").trim();
      const amountCollected = Number(body?.amount_collected || 0);
      const msisdn = String(body?.subscriber_msisdn || "");

      if (!reference || !transactionId) {
        return json({ transaction_id: transactionId, successful: "false" }, 400);
      }

      const { data: rows } = await supabase
        .from("sms_topups")
        .select("*")
        .eq("reference", reference)
        .limit(1);
      const topup = rows?.[0];

      // Unknown reference or already processed -> decline so funds are refunded
      if (!topup || topup.status === "success") {
        return json({ transaction_id: transactionId, successful: "false" });
      }

      // Amount must match what was requested (allow tiny float drift)
      if (Math.abs(Number(topup.amount) - amountCollected) > 1) {
        await supabase
          .from("sms_topups")
          .update({ status: "failed", callback_payload: body })
          .eq("id", topup.id);
        return json({ transaction_id: transactionId, successful: "false" });
      }

      await supabase
        .from("sms_topups")
        .update({
          status: "success",
          transaction_id: transactionId,
          msisdn: msisdn || topup.msisdn,
          paid_at: new Date().toISOString(),
          callback_payload: body,
        })
        .eq("id", topup.id);

      return json({ transaction_id: transactionId, successful: "true" });
    }

    // ---- Everything below requires an allowed role ----
    const userRole = String(body?.userRole || "");
    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ success: false, error: "Not allowed for this role" }, 403);
    }

    if (action === "create") {
      const amount = Math.floor(Number(body?.amount));
      if (!Number.isFinite(amount) || amount < 100) {
        return json({ success: false, error: "Kiasi lazima kiwe angalau TZS 100" }, 400);
      }
      if (amount > 10000000) {
        return json({ success: false, error: "Kiasi ni kikubwa mno" }, 400);
      }
      const mobile = normalizePhone(body?.mobile);
      if (body?.mobile && !mobile) {
        return json({ success: false, error: "Namba ya simu si sahihi" }, 400);
      }

      const reference = "SMS" + Math.random().toString(36).slice(2, 8).toUpperCase();

      const { error } = await supabase.from("sms_topups").insert({
        reference,
        transaction_id: crypto.randomUUID(),
        secure_token: null,
        amount,
        msisdn: mobile,
        status: "pending",
        created_by: body?.userName ? String(body.userName).slice(0, 120) : null,
        created_by_role: userRole,
      });
      if (error) throw error;

      return json({ success: true, reference, amount, mobile });
    }

    if (action === "status") {
      const reference = String(body?.reference || "");
      if (!reference) return json({ success: false, error: "reference required" }, 400);
      const { data, error } = await supabase
        .from("sms_topups")
        .select("status, amount, reference, paid_at")
        .eq("reference", reference)
        .limit(1);
      if (error) throw error;
      return json({ success: true, topup: data?.[0] ?? null });
    }

    if (action === "history") {
      const { data, error } = await supabase
        .from("sms_topups")
        .select("id, reference, amount, msisdn, status, created_by, created_at, paid_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return json({ success: true, topups: data ?? [] });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
