import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ALLOWED_ROLES = ["admin", "accountant", "head_nursery", "head_primary", "head_secondary"];
const PAY_URL = "https://snippe.me/pay/whatsapp-broadcast-payment";
const APPROVER_PHONE = "255750424704";
const PACK_CREDITS = 10000;
const PACK_AMOUNT = 50000;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function notifyApprover(msg: string) {
  const key = Deno.env.get("BEEM_API_KEY"), sec = Deno.env.get("BEEM_SECRET_KEY");
  if (!key || !sec) return;
  try {
    const r = await fetch("https://apisms.beem.africa/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${key}:${sec}`) },
      body: JSON.stringify({
        source_addr: Deno.env.get("BEEM_SENDER_ID") || "DAARUL",
        schedule_time: "", encoding: 0, message: msg,
        recipients: [{ recipient_id: 1, dest_addr: APPROVER_PHONE }],
      }),
    });
    if (!r.ok) console.error("Beem notify failed", r.status, await r.text());
  } catch (e) { console.error("Beem notify error", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ---- Approver actions (secret key only) ----
    if (action.startsWith("approver_")) {
      const token = String(body?.token || "");
      const { data: acc } = await db.from("wa_approver_access").select("token").eq("id", 1).single();
      if (!token || !acc || token !== acc.token) return json({ success: false, error: "Hauna ruhusa" }, 403);

      if (action === "approver_list") {
        const { data } = await db.from("wa_credit_purchases").select("*").order("created_at", { ascending: false }).limit(200);
        return json({ success: true, purchases: data ?? [] });
      }
      const id = String(body?.id || "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ success: false, error: "ID si sahihi" }, 400);
      if (action === "approver_approve") {
        const { data, error } = await db.rpc("wa_approve_purchase", { _id: id });
        if (error) throw error;
        return json({ success: Boolean(data), error: data ? undefined : "Tayari imeshashughulikiwa" });
      }
      if (action === "approver_reject") {
        await db.from("wa_credit_purchases").update({ status: "rejected", decided_at: new Date().toISOString() })
          .eq("id", id).eq("status", "pending");
        return json({ success: true });
      }
      return json({ success: false, error: "Unknown action" }, 400);
    }

    // ---- App user actions ----
    const userId = String(body?.userId || "").slice(0, 100);
    const userRole = String(body?.userRole || "");
    const userName = String(body?.userName || "").slice(0, 120);
    if (!userId || !ALLOWED_ROLES.includes(userRole)) return json({ success: false, error: "Not allowed" }, 403);

    if (action === "status") {
      const [{ data: bal }, { data: pend }] = await Promise.all([
        db.from("wa_credit_balances").select("balance").eq("user_id", userId).maybeSingle(),
        db.from("wa_credit_purchases").select("id, created_at").eq("user_id", userId).eq("status", "pending"),
      ]);
      return json({ success: true, balance: bal?.balance ?? 0, pending: pend?.length ?? 0 });
    }

    if (action === "purchase") {
      const { data, error } = await db.from("wa_credit_purchases")
        .insert({ user_id: userId, user_name: userName, user_role: userRole, credits: PACK_CREDITS, amount_tzs: PACK_AMOUNT })
        .select("id").single();
      if (error) throw error;
      await notifyApprover(
        `DAARUL-ARQAM: ${userName || userId} (${userRole}) amebonyeza kununua credit ${PACK_CREDITS} za WhatsApp broadcast (TZS ${PACK_AMOUNT}). Hakiki Snippe kisha idhinisha.`,
      );
      return json({ success: true, id: data.id, payUrl: PAY_URL });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
