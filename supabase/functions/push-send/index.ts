import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  image?: string;
  tag?: string;
  requireInteraction?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@daarul-arqam.sc.tz";

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const { payload, target } = (await req.json()) as {
      payload: PushPayload;
      target?: {
        role?: string;
        roles?: string[];
        userIdentifier?: string;
        userIdentifiers?: string[];
      };
    };

    if (!payload?.title || !payload?.body) {
      return new Response(JSON.stringify({ error: "Missing title/body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_identifier, last_used_at")
      .order("last_used_at", { ascending: false });
    if (target?.role) query = query.eq("user_role", target.role);
    if (target?.roles && target.roles.length) query = query.in("user_role", target.roles);
    if (target?.userIdentifier) query = query.eq("user_identifier", target.userIdentifier);
    if (target?.userIdentifiers && target.userIdentifiers.length)
      query = query.in("user_identifier", target.userIdentifiers);

    const { data: subsRaw, error } = await query;
    if (error) throw error;

    // Dedupe: keep only the most recently used subscription per user_identifier
    // so users with multiple devices get a single notification per event.
    const seen = new Set<string>();
    const subs = (subsRaw || []).filter((s) => {
      const key = s.user_identifier || s.endpoint; // fallback when no identifier
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const message = JSON.stringify(payload);
    let sent = 0;
    let removed = 0;
    const stale: string[] = [];

    await Promise.all(
      (subs || []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            message
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            stale.push(s.endpoint);
          }
        }
      })
    );

    if (stale.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", stale);
      removed = stale.length;
    }

    return new Response(JSON.stringify({ success: true, sent, removed, total: subs?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});