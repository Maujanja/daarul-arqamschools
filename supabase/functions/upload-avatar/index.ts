import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UploadRequest {
  studentId: string;
  fileName: string;
  fileBase64: string;
  contentType: string;
  userRole: string;
}

interface DeleteRequest {
  studentId: string;
  userRole: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "upload";

    if (action === "delete") {
      const request: DeleteRequest = await req.json();
      const { studentId, userRole } = request;

      // Only admin and secretary can delete avatars
      if (!["admin", "secretary"].includes(userRole)) {
        return new Response(
          JSON.stringify({ success: false, error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // List and delete all files in the student's folder
      const { data: files, error: listError } = await supabase.storage
        .from("student-avatars")
        .list(studentId);

      if (listError) {
        console.error("List error:", listError);
      }

      if (files && files.length > 0) {
        const filePaths = files.map((file) => `${studentId}/${file.name}`);
        const { error: deleteError } = await supabase.storage
          .from("student-avatars")
          .remove(filePaths);

        if (deleteError) {
          console.error("Delete error:", deleteError);
        }
      }

      // Update student record to remove avatar_url
      const { error: updateError } = await supabase
        .from("students")
        .update({ avatar_url: null })
        .eq("id", studentId);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ success: true, message: "Avatar deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle upload
    const request: UploadRequest = await req.json();
    const { studentId, fileName, fileBase64, contentType, userRole } = request;

    // Only admin and secretary can upload avatars
    if (!["admin", "secretary"].includes(userRole)) {
      return new Response(
        JSON.stringify({ success: false, error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!studentId || !fileName || !fileBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 to binary
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique filename
    const fileExt = fileName.split(".").pop() || "jpg";
    const uniqueFileName = `${studentId}-${Date.now()}.${fileExt}`;
    const filePath = `${studentId}/${uniqueFileName}`;

    // Delete old files in the student's folder first
    const { data: existingFiles } = await supabase.storage
      .from("student-avatars")
      .list(studentId);

    if (existingFiles && existingFiles.length > 0) {
      const oldPaths = existingFiles.map((file) => `${studentId}/${file.name}`);
      await supabase.storage.from("student-avatars").remove(oldPaths);
    }

    // Upload new file
    const { error: uploadError } = await supabase.storage
      .from("student-avatars")
      .upload(filePath, bytes, {
        contentType: contentType || "image/jpeg",
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("student-avatars")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Update student record with avatar URL
    const { error: updateError } = await supabase
      .from("students")
      .update({ avatar_url: publicUrl })
      .eq("id", studentId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Avatar upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Upload failed";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
