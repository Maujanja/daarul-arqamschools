import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.25.76";
import { verifyParentSession } from "../_shared/parent-session.ts";
import { loadStudentProgress } from "../_shared/load-student-progress.ts";
import { progressNarration } from "../_shared/student-progress.ts";

const schema = z.object({
  action: z.enum(["report", "speak", "test-voice"]), sessionToken: z.string().min(20).max(3000),
  year: z.string().regex(/^\d{4}-\d{4}$/),
  className: z.string().min(1).max(80).optional(),
  throughTerm: z.string().min(1).max(80).optional(),
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid progress request" }, 400);
    const { action, sessionToken, year, className, throughTerm } = parsed.data;
    let session;
    try { session = await verifyParentSession(sessionToken); }
    catch { return json({ error: "Please sign in again to view your child's progress." }, 401); }
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Progress service unavailable" }, 503);
    const db = createClient(url, key);
    const { student, progress, isDemo } = await loadStudentProgress(db, session.studentId, year, className, throughTerm);
    if ((student.parent_id || student.id) !== session.parentId) return json({ error: "Please sign in again." }, 401);
    const narration = action === "test-voice"
      ? "Karibu DAARUL-ARQAM SCHOOLS. Hii ni sauti ya majaribio ya taarifa za maendeleo ya mtoto."
      : progressNarration(student.full_name, progress);
    if (action === "report") return json({ progress, narration, studentName: student.full_name, isDemo });
    if (action !== "test-voice" && !progress.latest) return json({ error: "There are no approved results to read yet." }, 409);
    const apiKey = Deno.env.get("SAUTI_TTS_API_KEY");
    if (!apiKey) return json({ error: "Voice reports are not configured yet." }, 503);
    const audio = await fetch("https://sauti-tts.vercel.app/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ text: narration, voice: "sw-TZ-Standard-A", rate: 1, pitch: 0, volume: 1 }),
      signal: AbortSignal.timeout(45000),
    });
    if (!audio.ok) {
      // Provider responses may echo credentials; expose status, never credential-bearing bodies.
      return json({ error: `The voice service could not generate audio (${audio.status}). Please try again.`, providerStatus: audio.status }, 502);
    }
    if (!audio.headers.get("Content-Type")?.toLowerCase().startsWith("audio/mpeg"))
      return json({ error: "The voice service did not return an MP3 audio file." }, 502);
    const buffer = await audio.arrayBuffer();
    if (buffer.byteLength === 0) return json({ error: "The voice service returned empty audio." }, 502);
    return new Response(buffer, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    return json({ error: error instanceof Error && error.name === "TimeoutError" ? "Voice generation timed out. Please try again." : "Unable to load child progress. Please try again." }, 500);
  }
});