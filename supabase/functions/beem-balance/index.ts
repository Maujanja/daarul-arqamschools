import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BEEM_API_KEY = Deno.env.get("BEEM_API_KEY") || "";
const BEEM_SECRET_KEY = Deno.env.get("BEEM_SECRET_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!BEEM_API_KEY || !BEEM_SECRET_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "Beem credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const auth = "Basic " + btoa(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);
    const res = await fetch("https://apisms.beem.africa/public/v1/vendors/balance", {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: auth },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Beem API ${res.status}`, raw: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const balance = Number(data?.data?.credit_balance ?? 0);
    return new Response(
      JSON.stringify({ success: true, balance, checked_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});