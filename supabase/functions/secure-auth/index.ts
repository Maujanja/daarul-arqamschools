import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LoginRequest {
  loginType: "admin" | "teacher" | "parent" | "secretary" | "accountant" | "head_of_school";
  credentials: {
    username?: string;
    password?: string;
    name?: string;
    studentName?: string;
    rollNumber?: string;
    department?: string;
  };
}

interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    role: string;
    department?: string;
  };
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { loginType, credentials }: LoginRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let response: AuthResponse;

    switch (loginType) {
      case "admin": {
        const { username, password } = credentials;
        if (!username || !password) {
          response = { success: false, error: "Username and password required" };
          break;
        }

        const { data, error } = await supabase
          .from("admin_credentials")
          .select("id, username, password_hash")
          .eq("username", username.trim())
          .maybeSingle();

        if (error || !data) {
          response = { success: false, error: "Invalid username or password" };
          break;
        }

        if (data.password_hash !== password.trim()) {
          response = { success: false, error: "Invalid username or password" };
          break;
        }

        response = {
          success: true,
          user: { id: data.id, name: "Admin", role: "admin" },
        };
        break;
      }

      case "teacher": {
        const { name, password } = credentials;
        if (!name || !password) {
          response = { success: false, error: "Name and password required" };
          break;
        }

        const { data: allTeachers, error } = await supabase
          .from("teachers")
          .select("id, full_name, email, password_hash");

        const data = allTeachers?.find(
          (t: any) => t.full_name.trim().toLowerCase() === name.trim().toLowerCase()
        );

        if (error || !data) {
          response = { success: false, error: "Teacher name not found" };
          break;
        }

        if (data.password_hash !== password.trim()) {
          response = { success: false, error: "Incorrect password" };
          break;
        }

        response = {
          success: true,
          user: { id: data.id, name: data.full_name, role: "teacher" },
        };
        break;
      }

      case "parent": {
        const { studentName, rollNumber } = credentials;
        if (!studentName || !rollNumber) {
          response = { success: false, error: "Student name and roll number required" };
          break;
        }

        const normalizedName = studentName.trim().replace(/\s+/g, ' ');
        const normalizedRoll = rollNumber.trim().toUpperCase();

        const { data: rollMatches, error } = await supabase
          .from("students")
          .select("id, full_name, parent_id")
          .eq("roll_number", normalizedRoll);

        const student = rollMatches?.find((s: any) => 
          s.full_name.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedName.toLowerCase()
        ) || null;

        if (error || !student) {
          response = { success: false, error: "Student name or ID is incorrect" };
          break;
        }

        let parentName = `Parent of ${student.full_name}`;
        let parentId = student.id;

        if (student.parent_id) {
          const { data: parent } = await supabase
            .from("parents")
            .select("id, full_name")
            .eq("id", student.parent_id)
            .maybeSingle();
          
          if (parent) {
            parentId = parent.id;
            parentName = parent.full_name;
          }
        }

        response = {
          success: true,
          user: { id: parentId, name: parentName, role: "parent" },
        };
        break;
      }

      case "secretary": {
        const { username, password } = credentials;
        if (!username || !password) {
          response = { success: false, error: "Username and password required" };
          break;
        }

        const { data, error } = await supabase
          .from("secretary_credentials")
          .select("id, username, password_hash, full_name")
          .eq("username", username.trim())
          .maybeSingle();

        if (error || !data) {
          response = { success: false, error: "Invalid username or password" };
          break;
        }

        if (data.password_hash !== password.trim()) {
          response = { success: false, error: "Invalid username or password" };
          break;
        }

        response = {
          success: true,
          user: { id: data.id, name: data.full_name, role: "secretary" },
        };
        break;
      }

      case "accountant": {
        const { username, password } = credentials;
        if (!username || !password) {
          response = { success: false, error: "Username and password required" };
          break;
        }

        const { data, error } = await supabase
          .from("accountant_credentials")
          .select("id, username, password_hash, full_name")
          .eq("username", username.trim())
          .maybeSingle();

        if (error || !data) {
          response = { success: false, error: "Invalid username or password" };
          break;
        }

        if (data.password_hash !== password.trim()) {
          response = { success: false, error: "Invalid username or password" };
          break;
        }

        response = {
          success: true,
          user: { id: data.id, name: data.full_name, role: "accountant" },
        };
        break;
      }

      case "head_of_school": {
        const { username, password } = credentials;
        if (!username || !password) {
          response = { success: false, error: "Username and password required" };
          break;
        }

        const { data, error } = await supabase
          .from("head_of_school_credentials")
          .select("id, username, password_hash, full_name, department")
          .eq("username", username.trim())
          .maybeSingle();

        if (error || !data) {
          response = { success: false, error: "Invalid username or password" };
          break;
        }

        if (data.password_hash !== password.trim()) {
          response = { success: false, error: "Invalid username or password" };
          break;
        }

        // Map department to role: nursery -> head_nursery, primary -> head_primary, secondary -> head_secondary
        const roleMap: Record<string, string> = {
          nursery: "head_nursery",
          primary: "head_primary",
          secondary: "head_secondary",
        };

        response = {
          success: true,
          user: {
            id: data.id,
            name: data.full_name,
            role: roleMap[data.department] || "head_primary",
            department: data.department,
          },
        };
        break;
      }

      default:
        response = { success: false, error: "Invalid login type" };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.success ? 200 : 401,
    });
  } catch (error) {
    console.error("Auth error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Authentication failed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
