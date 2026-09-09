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
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ROLES = ["admin", "accountant", "head_nursery", "head_primary", "head_secondary"];

function basicAuth() {
  return "Basic " + btoa(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);
}

function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let p = String(raw).trim().replace(/[^0-9+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0") && p.length === 10) p = "255" + p.slice(1);
  if (p.startsWith("7") && p.length === 9) p = "255" + p;
  if (p.startsWith("6") && p.length === 9) p = "255" + p;
  if (!/^255\d{9}$/.test(p)) return null;
  return p;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getBalance(): Promise<number | null> {
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

async function sendOne(phone: string, message: string) {
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

async function fetchDelivery(dest: string, requestId: string) {
  try {
    const url = `https://dlrapi.beem.africa/public/v1/delivery-reports?dest_addr=${encodeURIComponent(
      dest
    )}&request_id=${encodeURIComponent(requestId)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { status: null, error: `[${res.status}] ${JSON.stringify(data)}` };
    const status = data?.data?.status ?? data?.status ?? null;
    return { status: status ? String(status) : null, error: null };
  } catch (e) {
    return { status: null, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!BEEM_API_KEY || !BEEM_SECRET_KEY) {
    return json({ success: false, error: "Beem credentials not configured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const userRole = String(body?.userRole || "");

    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ success: false, error: "Not allowed for this role" }, 403);
    }

    if (action === "balance") {
      return json({ success: true, balance: await getBalance() });
    }

    if (action === "send") {
      const message = String(body?.message || "").trim();
      const title = body?.title ? String(body.title).slice(0, 200) : null;
      const source = body?.source === "excel" ? "excel" : "manual";
      const rawRecipients: Array<{ phone?: string; name?: string } | string> =
        Array.isArray(body?.recipients) ? body.recipients : [];

      if (!message) return json({ success: false, error: "Message is required" }, 400);
      if (message.length > 1000) return json({ success: false, error: "Message too long" }, 400);
      if (rawRecipients.length === 0) return json({ success: false, error: "No recipients" }, 400);
      if (rawRecipients.length > 2000) return json({ success: false, error: "Too many recipients (max 2000)" }, 400);

      // Normalize + dedupe
      const seen = new Set<string>();
      const valid: Array<{ phone: string; raw: string; name: string | null }> = [];
      const invalid: Array<{ raw: string; name: string | null }> = [];
      for (const r of rawRecipients) {
        const rawStr = typeof r === "string" ? r : String(r?.phone ?? "");
        const name = typeof r === "string" ? null : r?.name ? String(r.name).slice(0, 120) : null;
        const p = normalizePhone(rawStr);
        if (!p) {
          if (rawStr.trim()) invalid.push({ raw: rawStr.trim(), name });
          continue;
        }
        if (seen.has(p)) continue;
        seen.add(p);
        valid.push({ phone: p, raw: rawStr.trim(), name });
      }

      if (valid.length === 0) {
        return json({ success: false, error: "No valid phone numbers found", invalid }, 400);
      }

      const { data: campaignRows, error: campErr } = await supabase
        .from("bulk_sms_campaigns")
        .insert({
          created_by: body?.userName ? String(body.userName).slice(0, 120) : null,
          created_by_role: userRole,
          title,
          message,
          source,
          total_recipients: valid.length + invalid.length,
        })
        .select("id")
        .limit(1);
      if (campErr) throw campErr;
      const campaignId = campaignRows?.[0]?.id;

      let sent = 0;
      let failed = 0;
      const rows: Record<string, unknown>[] = [];

      for (const inv of invalid) {
        failed++;
        rows.push({
          campaign_id: campaignId,
          name: inv.name,
          phone: inv.raw,
          raw_phone: inv.raw,
          status: "failed",
          error: "Invalid phone number format",
        });
      }

      const CHUNK = 20;
      for (let i = 0; i < valid.length; i += CHUNK) {
        const chunk = valid.slice(i, i + CHUNK);
        const results = await Promise.all(chunk.map((r) => sendOne(r.phone, message)));
        results.forEach((res, idx) => {
          const r = chunk[idx];
          if (res.success) sent++;
          else failed++;
          rows.push({
            campaign_id: campaignId,
            name: r.name,
            phone: r.phone,
            raw_phone: r.raw,
            status: res.success ? "sent" : "failed",
            beem_request_id: res.success ? (res as { request_id?: string }).request_id ?? null : null,
            error: res.success ? null : res.error,
          });
        });
      }

      // Persist recipients in batches
      for (let i = 0; i < rows.length; i += 200) {
        await supabase.from("bulk_sms_recipients").insert(rows.slice(i, i + 200));
      }

      const balance = await getBalance();
      await supabase
        .from("bulk_sms_campaigns")
        .update({ sent_count: sent, failed_count: failed, balance_after: balance })
        .eq("id", campaignId);

      return json({
        success: true,
        campaign_id: campaignId,
        sent,
        failed,
        total: rows.length,
        balance,
      });
    }

    if (action === "campaigns") {
      const { data, error } = await supabase
        .from("bulk_sms_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(Number(body?.limit) || 50);
      if (error) throw error;
      return json({ success: true, campaigns: data ?? [] });
    }

    if (action === "recipients") {
      const campaignId = String(body?.campaignId || "");
      if (!campaignId) return json({ success: false, error: "campaignId required" }, 400);
      const { data, error } = await supabase
        .from("bulk_sms_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true })
        .limit(3000);
      if (error) throw error;
      return json({ success: true, recipients: data ?? [] });
    }

    if (action === "refresh_delivery") {
      const campaignId = String(body?.campaignId || "");
      if (!campaignId) return json({ success: false, error: "campaignId required" }, 400);
      const { data: recs } = await supabase
        .from("bulk_sms_recipients")
        .select("id, phone, beem_request_id, delivery_status")
        .eq("campaign_id", campaignId)
        .eq("status", "sent")
        .not("beem_request_id", "is", null)
        .limit(1000);

      let updated = 0;
      for (const rec of recs ?? []) {
        const dl = await fetchDelivery(String(rec.phone), String(rec.beem_request_id));
        if (dl.status) {
          await supabase
            .from("bulk_sms_recipients")
            .update({ delivery_status: dl.status, delivery_checked_at: new Date().toISOString() })
            .eq("id", rec.id);
          updated++;
        } else {
          await supabase
            .from("bulk_sms_recipients")
            .update({ delivery_checked_at: new Date().toISOString() })
            .eq("id", rec.id);
        }
      }
      return json({ success: true, updated, checked: (recs ?? []).length });
    }

    if (action === "delete_campaign") {
      if (userRole !== "admin") return json({ success: false, error: "Only admin can delete" }, 403);
      const campaignId = String(body?.campaignId || "");
      if (!campaignId) return json({ success: false, error: "campaignId required" }, 400);
      await supabase.from("bulk_sms_campaigns").delete().eq("id", campaignId);
      return json({ success: true });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
