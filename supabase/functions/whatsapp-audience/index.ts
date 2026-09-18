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

/** Pull every phone number out of free text, deterministically. AI never invents numbers. */
function extractPhones(text: string): { phones: string[]; invalid: string[] } {
  const phones: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  // Match one Tanzanian number at a time. Separators are allowed inside a
  // number, but whitespace between two complete numbers must never join them.
  const candidatePattern = /(?<!\d)(?:(?:\+|00)?255[\s().-]*|0[\s().-]*)?[67](?:[\s().-]*\d){8}(?!\d)/g;
  for (const match of text.matchAll(candidatePattern)) {
    const phone = normalizePhone(match[0]);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    phones.push(phone);
  }

  // Also support numbers pasted without any delimiter, for example
  // 07541234560789112233 or 255754123456255789112233.
  const digitRuns = text.match(/\d{9,}/g) ?? [];
  for (const run of digitRuns) {
    let cursor = 0;
    let foundInRun = false;
    while (cursor < run.length) {
      const rest = run.slice(cursor);
      const size = rest.startsWith("255") ? 12 : rest.startsWith("0") ? 10 : 9;
      const chunk = rest.slice(0, size);
      const phone = chunk.length === size ? normalizePhone(chunk) : null;
      if (!phone) break;
      foundInRun = true;
      if (!seen.has(phone)) {
        seen.add(phone);
        phones.push(phone);
      }
      cursor += size;
    }
    if (!foundInRun && normalizePhone(run) === null) invalid.push(run);
  }

  return { phones, invalid };
}


const TZ_FIRST = ["Asha", "Juma", "Neema", "Hamisi", "Zawadi", "Salma", "Rashid", "Amina", "Baraka", "Fatuma", "Yusuf", "Halima", "Said", "Mwanaidi", "Ibrahim", "Rehema"];
const TZ_MID = ["Juma", "Ally", "Hassan", "Mussa", "Shabani", "Omary", "Kassim", "Mohamed"];
const TZ_LAST = ["Mwinyi", "Mkwawa", "Ndugu", "Kimaro", "Mlowe", "Mbwana", "Chande", "Nyerere", "Mkapa", "Kileo"];

function fallbackName(i: number): string {
  return `${TZ_FIRST[i % TZ_FIRST.length]} ${TZ_MID[(i * 3) % TZ_MID.length]} ${TZ_LAST[(i * 7) % TZ_LAST.length]}`;
}

const SYSTEM = `You prepare WhatsApp broadcast audience lists for a Tanzanian school.

You are given the EXACT list of phone numbers already extracted from the user's text, plus the original text.
Rules:
- NEVER invent, guess, complete, correct or alter a phone number. Use only the numbers in the provided list, digit for digit.
- Do not add extra numbers and do not drop any number from the list.
- Match a name from the user's text to a number when the text pairs them.
- If a number has no name in the text, invent a plausible Tanzanian full name (two or three words, e.g. "Asha Juma Mwinyi") and set name_generated true. Never reuse the same invented name twice.
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

    if (/\d+(?:\.\d+)?e\+\d+/i.test(prompt)) {
      return json({
        success: false,
        error: "Namba hizi zimefupishwa na Excel na tarakimu zake za mwisho hazipo kwenye maandiko uliyocopy. Tumia kitufe cha Upload Excel yenye namba ili mfumo usome namba kamili moja kwa moja.",
      }, 400);
    }

    // Numbers come ONLY from the user's text — the AI never produces them.
    const { phones: allowed, invalid } = extractPhones(prompt);
    const phones = allowed.slice(0, 2000);
    if (!phones.length) {
      return json({
        success: false,
        error: "Sikuona namba yoyote sahihi kwenye maandiko yako. Weka namba kama 0754123456, 255754123456 au 754123456.",
      }, 400);
    }

    const nameByPhone = new Map<string, { name: string; generated: boolean }>();
    let reply = "";

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
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `EXACT PHONE NUMBERS (use these only, unchanged):\n${phones.join("\n")}\n\nORIGINAL TEXT:\n${prompt}`,
              },
            ],
          },
        ],
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
      console.error(`AI gateway failed [${res.status}]: ${errText.slice(0, 400)}`);
    } else {
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

      try {
        const parsed = JSON.parse(text) as {
          reply?: string;
          recipients?: Array<{ name?: string; phone?: string; name_generated?: boolean }>;
        };
        reply = String(parsed.reply || "");
        for (const r of parsed.recipients ?? []) {
          const phone = normalizePhone(r?.phone);
          // Hard guard: ignore anything the model made up.
          if (!phone || !phones.includes(phone) || nameByPhone.has(phone)) continue;
          const name = String(r?.name || "").trim().slice(0, 120);
          if (!name) continue;
          nameByPhone.set(phone, { name, generated: Boolean(r?.name_generated) });
        }
      } catch {
        console.error("AI returned unparsable JSON; using fallback names.");
      }
    }

    const usedNames = new Set(Array.from(nameByPhone.values()).map((v) => v.name.toLowerCase()));
    const recipients = phones.map((phone, i) => {
      const hit = nameByPhone.get(phone);
      if (hit) return { name: hit.name, phone, generated: hit.generated };
      let name = fallbackName(i);
      let k = i;
      while (usedNames.has(name.toLowerCase())) name = fallbackName(++k + 17);
      usedNames.add(name.toLowerCase());
      return { name, phone, generated: true };
    });

    const generatedCount = recipients.filter((r) => r.generated).length;

    return json({
      success: true,
      reply:
        reply.slice(0, 2000) ||
        `Nimepata namba ${recipients.length} kutoka kwenye maandiko yako${
          generatedCount ? `, na ${generatedCount} zimetungiwa majina` : ""
        }.`,
      recipients,
      invalid,
    });

  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
