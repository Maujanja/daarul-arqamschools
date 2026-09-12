import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIQ_API_KEY = Deno.env.get("BRIQ_API_KEY") || "";
const BRIQ_BASE_URL = Deno.env.get("BRIQ_BASE_URL") || "https://karibu.briq.tz/v1";
const BRIQ_SENDER_ID = Deno.env.get("BRIQ_SENDER_ID") || "";

const ALLOWED_ROLES = ["admin", "accountant", "head_nursery", "head_primary", "head_secondary"];
const BUCKET = "voice-messages";

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
  if (!/^255\d{9}$/.test(p)) return null;
  return p;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const briqConfigured = () => Boolean(BRIQ_API_KEY);

async function placeCall(phone: string, audioUrl: string) {
  if (!briqConfigured()) {
    return { success: false, error: "Voice service (Briq) haijaunganishwa bado" };
  }
  try {
    const res = await fetch(`${BRIQ_BASE_URL.replace(/\/$/, "")}/voice/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": BRIQ_API_KEY,
        Authorization: `Bearer ${BRIQ_API_KEY}`,
      },
      body: JSON.stringify({
        sender_id: BRIQ_SENDER_ID || undefined,
        recipients: [phone],
        audio_url: audioUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: `[${res.status}] ${JSON.stringify(data)}` };
    const callId = data?.data?.id ?? data?.id ?? data?.request_id ?? null;
    return { success: true, call_id: callId ? String(callId) : null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function briqCallStatus(callId: string) {
  if (!briqConfigured()) return { status: null };
  try {
    const res = await fetch(
      `${BRIQ_BASE_URL.replace(/\/$/, "")}/voice/status/${encodeURIComponent(callId)}`,
      {
        headers: { "X-API-Key": BRIQ_API_KEY, Authorization: `Bearer ${BRIQ_API_KEY}` },
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { status: null };
    const status = data?.data?.status ?? data?.status ?? null;
    const duration = Number(data?.data?.duration ?? data?.duration ?? NaN);
    return { status: status ? String(status) : null, duration: Number.isFinite(duration) ? duration : null };
  } catch {
    return { status: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const userRole = String(body?.userRole || "");
    const userName = body?.userName ? String(body.userName).slice(0, 120) : null;

    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ success: false, error: "Not allowed for this role" }, 403);
    }

    const balanceSeconds = async () => {
      const { data } = await supabase.from("voice_credit_ledger").select("seconds_delta").limit(10000);
      return (data ?? []).reduce((s: number, r: { seconds_delta: number }) => s + Number(r.seconds_delta || 0), 0);
    };

    if (action === "balance") {
      return json({
        success: true,
        seconds: await balanceSeconds(),
        configured: briqConfigured(),
      });
    }

    if (action === "send") {
      const title = body?.title ? String(body.title).slice(0, 200) : null;
      const source = ["upload", "record"].includes(String(body?.source)) ? String(body.source) : "upload";
      const audioBase64 = String(body?.audioBase64 || "");
      const audioMime = String(body?.audioMime || "audio/mpeg");
      const rawRecipients: Array<{ phone?: string; name?: string } | string> = Array.isArray(body?.recipients)
        ? body.recipients
        : [];

      if (!audioBase64) return json({ success: false, error: "Sauti inahitajika" }, 400);
      if (rawRecipients.length === 0) return json({ success: false, error: "Hakuna wapokeaji" }, 400);
      if (rawRecipients.length > 2000) return json({ success: false, error: "Wapokeaji wengi mno (max 2000)" }, 400);

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

      if (valid.length === 0) return json({ success: false, error: "Hakuna namba sahihi", invalid }, 400);

      const bytes = base64ToBytes(audioBase64);
      const ext = audioMime.includes("wav") ? "wav" : audioMime.includes("ogg") ? "ogg" : audioMime.includes("webm") ? "webm" : "mp3";
      const audioPath = `campaigns/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(audioPath, bytes, { contentType: audioMime, upsert: false });
      if (upErr) throw upErr;

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(audioPath, 60 * 60 * 24 * 7);
      const audioUrl = signed?.signedUrl || "";

      const { data: campaignRows, error: campErr } = await supabase
        .from("voice_campaigns")
        .insert({
          created_by: userName,
          created_by_role: userRole,
          title,
          audio_path: audioPath,
          audio_mime: audioMime,
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
          error: "Namba si sahihi",
        });
      }

      const CHUNK = 10;
      for (let i = 0; i < valid.length; i += CHUNK) {
        const chunk = valid.slice(i, i + CHUNK);
        const results = await Promise.all(chunk.map((r) => placeCall(r.phone, audioUrl)));
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
            provider_call_id: res.success ? (res as { call_id?: string | null }).call_id ?? null : null,
            error: res.success ? null : res.error,
          });
        });
      }

      for (let i = 0; i < rows.length; i += 200) {
        await supabase.from("voice_recipients").insert(rows.slice(i, i + 200));
      }

      const secondsUsed = Number(body?.audioSeconds) > 0 ? Math.ceil(Number(body.audioSeconds)) * sent : 0;
      if (secondsUsed > 0) {
        await supabase.from("voice_credit_ledger").insert({
          seconds_delta: -secondsUsed,
          reason: "campaign",
          reference: campaignId,
          created_by: userName,
          campaign_id: campaignId,
        });
      }

      const balance = await balanceSeconds();
      await supabase
        .from("voice_campaigns")
        .update({ sent_count: sent, failed_count: failed, seconds_used: secondsUsed, balance_after: balance })
        .eq("id", campaignId);

      if (sent === 0 && !briqConfigured()) {
        return json({
          success: false,
          error: "Voice service (Briq) haijaunganishwa bado — weka BRIQ_API_KEY ili simu ziende.",
          campaign_id: campaignId,
        }, 400);
      }

      return json({ success: true, campaign_id: campaignId, sent, failed, total: rows.length, seconds: balance });
    }

    if (action === "campaigns") {
      const { data, error } = await supabase
        .from("voice_campaigns")
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
        .from("voice_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true })
        .limit(3000);
      if (error) throw error;
      return json({ success: true, recipients: data ?? [] });
    }

    if (action === "audio_url") {
      const campaignId = String(body?.campaignId || "");
      const { data: camp } = await supabase
        .from("voice_campaigns")
        .select("audio_path")
        .eq("id", campaignId)
        .limit(1);
      const path = camp?.[0]?.audio_path;
      if (!path) return json({ success: false, error: "Hakuna sauti" }, 404);
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      return json({ success: true, url: signed?.signedUrl ?? null });
    }

    if (action === "refresh_status") {
      const campaignId = String(body?.campaignId || "");
      if (!campaignId) return json({ success: false, error: "campaignId required" }, 400);
      const { data: recs } = await supabase
        .from("voice_recipients")
        .select("id, provider_call_id")
        .eq("campaign_id", campaignId)
        .eq("status", "sent")
        .not("provider_call_id", "is", null)
        .limit(1000);

      let updated = 0;
      for (const rec of recs ?? []) {
        const st = await briqCallStatus(String(rec.provider_call_id));
        const patch: Record<string, unknown> = { delivery_checked_at: new Date().toISOString() };
        if (st.status) {
          patch.delivery_status = st.status;
          updated++;
        }
        if (st.duration) patch.duration_seconds = Math.ceil(st.duration);
        await supabase.from("voice_recipients").update(patch).eq("id", rec.id);
      }
      return json({ success: true, updated, checked: (recs ?? []).length });
    }

    if (action === "delete_campaign") {
      if (userRole !== "admin") return json({ success: false, error: "Only admin can delete" }, 403);
      const campaignId = String(body?.campaignId || "");
      if (!campaignId) return json({ success: false, error: "campaignId required" }, 400);
      const { data: camp } = await supabase
        .from("voice_campaigns")
        .select("audio_path")
        .eq("id", campaignId)
        .limit(1);
      const path = camp?.[0]?.audio_path;
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      await supabase.from("voice_campaigns").delete().eq("id", campaignId);
      return json({ success: true });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
