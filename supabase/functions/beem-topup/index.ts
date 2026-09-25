import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, beem-secure-token",
};

const BEEM_API_KEY = Deno.env.get("BEEM_API_KEY") || "";
const BEEM_SECRET_KEY = Deno.env.get("BEEM_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ROLES = ["admin", "accountant", "head_nursery", "head_primary", "head_secondary"];

function basicAuth() {
  return "Basic " + btoa(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);
}

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

    // ---- Public webhook: Bpay POSTs payment status here ----
    if (action === "callback") {
      const token = req.headers.get("beem-secure-token") || "";
      const reference = String(body?.referenceNumber || "");
      const transactionId = String(body?.transactionID || "");
      const status = String(body?.status || "");
      const amount = String(body?.amount || "");
      const msisdn = String(body?.msisdn || "");

      if (!reference && !transactionId) {
        return json({ success: false, error: "referenceNumber or transactionID required" }, 400);
      }

      const q = supabase.from("sms_topups").select("*").limit(1);
      const { data: rows } = transactionId
        ? await q.eq("transaction_id", transactionId)
        : await q.eq("reference", reference);
      const topup = rows?.[0];

      if (!topup) {
        return json({ success: false, error: "Unknown transaction" }, 404);
      }
      if (topup.secure_token && token !== topup.secure_token) {
        return json({ success: false, error: "Invalid secure token" }, 403);
      }

      const newStatus = status === "success" ? "success" : "failed";
      await supabase
        .from("sms_topups")
        .update({
          status: newStatus,
          msisdn: msisdn || topup.msisdn,
          paid_at: status === "success" ? new Date().toISOString() : null,
          callback_payload: body,
        })
        .eq("id", topup.id);

      // Bpay expects this exact acknowledgement shape
      return json({
        amount,
        status: status === "success",
        referenceNumber: reference,
        statusMessage: status === "success" ? "Payment was successful!" : "Payment failed",
        transactionID: transactionId,
      });
    }

    // ---- Everything below requires Beem credentials + an allowed role ----
    if (!BEEM_API_KEY || !BEEM_SECRET_KEY) {
      return json({ success: false, error: "Beem credentials not configured" }, 500);
    }
    const userRole = String(body?.userRole || "");
    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ success: false, error: "Not allowed for this role" }, 403);
    }

    if (action === "whitelist") {
      const website = String(body?.website || "").trim();
      if (!/^https:\/\//.test(website)) {
        return json({ success: false, error: "Website must be an https:// URL" }, 400);
      }
      const res = await fetch("https://checkout.beem.africa/v1/whitelist/add-to-list", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: basicAuth() },
        body: JSON.stringify({ website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return json({ success: false, error: `Beem whitelist ${res.status}: ${JSON.stringify(data)}` }, 502);
      }
      return json({ success: true, result: data });
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

      const transactionId = crypto.randomUUID();
      const reference = "SMS-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const secureToken = crypto.randomUUID().replace(/-/g, "");

      const { error } = await supabase.from("sms_topups").insert({
        reference,
        transaction_id: transactionId,
        secure_token: secureToken,
        amount,
        msisdn: mobile,
        status: "pending",
        created_by: body?.userName ? String(body.userName).slice(0, 120) : null,
        created_by_role: userRole,
      });
      if (error) throw error;

      return json({ success: true, reference, transactionId, secureToken, amount, mobile });
    }

    if (action === "status") {
      const transactionId = String(body?.transactionId || "");
      if (!transactionId) return json({ success: false, error: "transactionId required" }, 400);
      const { data, error } = await supabase
        .from("sms_topups")
        .select("status, amount, reference, paid_at")
        .eq("transaction_id", transactionId)
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
