import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const SYSTEM = `You prepare WhatsApp broadcast audience lists for a Tanzanian school.

From the user's instruction, extract every phone number and, when present, the matching full name.
Rules:
- Return numbers in the 255XXXXXXXXX format (convert 0XXXXXXXXX, +255..., or bare 7XXXXXXXX / 6XXXXXXXX).
- If a number has no name, invent a plausible Tanzanian full name (two or three words, e.g. "Asha Juma Mwinyi"). Never leave a name empty and never reuse the same invented name twice.
- Keep the order given by the user and remove duplicate numbers.
- Ignore text that is not a phone number or a name.
- "reply" is a short friendly answer in Swahili summarising what you built (count of recipients, how many names were invented).`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    recipients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          name_generated: { type: "boolean" },
        },
        required: ["name", "phone", "name_generated"],
      },
    },
  },
  required: ["reply", "recipients"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ success: false, error: "AI service not configured" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim();
    const userRole = String(body?.userRole || "");

    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ success: false, error: "Not allowed for this role" }, 403);
    }
    if (!prompt) return json({ success: false, error: "Prompt is required" }, 400);
    if (prompt.length > 20000) return json({ success: false, error: "Prompt too long" }, 400);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        instructions: SYSTEM,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        reasoning: { effort: "low", summary: "auto" },
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "broadcast_audience",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      if (res.status === 402) {
        return json({ success: false, error: "AI credits zimeisha. Ongeza credits kuendelea." }, 402);
      }
      if (res.status === 429) {
        return json({ success: false, error: "Maombi ni mengi kwa sasa, jaribu tena baada ya sekunde kadhaa." }, 429);
      }
      return json({ success: false, error: `AI error [${res.status}] ${errText.slice(0, 400)}` }, 500);
    }

    // Read the SSE stream and accumulate the output text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt?.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          } else if (evt?.type === "response.completed" && !text) {
            text = String(evt?.response?.output_text ?? "");
          }
        } catch {
          // ignore non-JSON keepalives
        }
      }
    }

    let parsed: { reply?: string; recipients?: Array<{ name?: string; phone?: string; name_generated?: boolean }> } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ success: false, error: "AI haikutoa majibu yanayoeleweka. Jaribu tena." }, 500);
    }

    const seen = new Set<string>();
    const recipients: Array<{ name: string; phone: string; generated: boolean }> = [];
    const invalid: string[] = [];
    for (const r of parsed.recipients ?? []) {
      const phone = normalizePhone(r?.phone);
      if (!phone) {
        if (r?.phone) invalid.push(String(r.phone));
        continue;
      }
      if (seen.has(phone)) continue;
      seen.add(phone);
      recipients.push({
        name: String(r?.name || "").trim().slice(0, 120) || "Mteja",
        phone,
        generated: Boolean(r?.name_generated),
      });
      if (recipients.length >= 2000) break;
    }

    return json({
      success: true,
      reply: String(parsed.reply || "").slice(0, 2000),
      recipients,
      invalid,
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
