import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { question, userId, userRole } = body ?? {};

    // Input validation
    if (typeof question !== "string" || question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (question.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Question is too long (max 1000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof userId !== "string" || typeof userRole !== "string") {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Restrict to financial roles only
    if (userRole !== "admin" && userRole !== "accountant") {
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch all fee-related data from the database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the userId actually exists in the corresponding credentials table.
    // This prevents unauthenticated callers from forging userRole.
    const credentialsTable =
      userRole === "admin" ? "admin_credentials" : "accountant_credentials";
    const { data: cred, error: credErr } = await supabase
      .from(credentialsTable)
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (credErr || !cred) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [studentsRes, paymentsRes, structureRes] = await Promise.all([
      supabase.from("students").select("id, full_name, class, roll_number"),
      supabase.from("fee_payments").select("student_id, amount, payment_date, term, academic_year"),
      supabase.from("fee_structure").select("class, term, academic_year, total_fee"),
    ]);

    // Build context for the AI
    const students = studentsRes.data || [];
    const payments = paymentsRes.data || [];
    const structure = structureRes.data || [];

    // Calculate balances for each student
    const studentBalances = students.map((student) => {
      const studentStructure = structure.find((s) => s.class === student.class);
      const expectedFee = studentStructure?.total_fee || 0;
      const paidAmount = payments
        .filter((p) => p.student_id === student.id)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const balance = expectedFee - paidAmount;

      return {
        name: student.full_name,
        class: student.class,
        roll_number: student.roll_number,
        expected_fee: expectedFee,
        paid: paidAmount,
        balance: balance,
        status: balance <= 0 ? "Fully Paid" : "Has Debt",
      };
    });

    // Summary stats
    const totalStudents = students.length;
    const totalExpected = studentBalances.reduce((sum, s) => sum + s.expected_fee, 0);
    const totalPaid = studentBalances.reduce((sum, s) => sum + s.paid, 0);
    const totalDebt = studentBalances.reduce((sum, s) => sum + Math.max(0, s.balance), 0);
    const studentsWithDebt = studentBalances.filter((s) => s.balance > 0);

    // Class breakdown
    const classSummary: Record<string, { students: number; paid: number; debt: number }> = {};
    studentBalances.forEach((s) => {
      if (!classSummary[s.class]) {
        classSummary[s.class] = { students: 0, paid: 0, debt: 0 };
      }
      classSummary[s.class].students++;
      classSummary[s.class].paid += s.paid;
      classSummary[s.class].debt += Math.max(0, s.balance);
    });

    const systemPrompt = `You are a helpful fee management assistant for a school secretary. You have access to the following fee data:

SUMMARY:
- Total Students: ${totalStudents}
- Total Expected Fees: TZS ${totalExpected.toLocaleString()}
- Total Collected: TZS ${totalPaid.toLocaleString()}
- Total Outstanding: TZS ${totalDebt.toLocaleString()}
- Students with Outstanding Balance: ${studentsWithDebt.length}

CLASS BREAKDOWN:
${Object.entries(classSummary)
  .map(([cls, data]) => `- ${cls}: ${data.students} students, Collected: TZS ${data.paid.toLocaleString()}, Outstanding: TZS ${data.debt.toLocaleString()}`)
  .join("\n")}

STUDENTS WITH OUTSTANDING BALANCES:
${studentsWithDebt
  .slice(0, 50)
  .map((s) => `- ${s.name} (${s.class}): Paid TZS ${s.paid.toLocaleString()}, Balance: TZS ${s.balance.toLocaleString()}`)
  .join("\n")}

ALL STUDENT DETAILS:
${studentBalances
  .slice(0, 100)
  .map((s) => `- ${s.name} (${s.class}, Roll: ${s.roll_number}): Expected TZS ${s.expected_fee.toLocaleString()}, Paid TZS ${s.paid.toLocaleString()}, Balance TZS ${s.balance.toLocaleString()} - ${s.status}`)
  .join("\n")}

Answer the user's question based on this data. Be helpful, accurate, and concise. Format numbers properly with commas. If asked about a specific student, search through all student details.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Sorry, I could not process your question.";

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fee assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
