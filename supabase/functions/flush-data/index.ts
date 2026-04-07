import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { admin_id } = await req.json();
    if (!admin_id) throw new Error("Missing admin_id");

    // Verify the user is an admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", admin_id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      throw new Error("Unauthorized: admin access required");
    }

    // Get all admin user IDs to preserve
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (adminRoles || []).map((r: any) => r.user_id);

    // Delete in dependency order
    await supabase.from("activity_logs").delete().not("user_id", "in", `(${adminIds.join(",")})`);
    await supabase.from("certifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("availability").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("reviews").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("withdrawals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("job_applications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("bookings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("worker_profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Delete non-admin user roles and profiles
    const { data: nonAdminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .neq("role", "admin");
    const nonAdminIds = (nonAdminRoles || []).map((r: any) => r.user_id);

    if (nonAdminIds.length > 0) {
      await supabase.from("user_roles").delete().in("user_id", nonAdminIds);
      await supabase.from("profiles").delete().in("id", nonAdminIds);

      // Delete non-admin auth users
      for (const uid of nonAdminIds) {
        await supabase.auth.admin.deleteUser(uid);
      }
    }

    // Log the flush action
    await supabase.from("activity_logs").insert({
      user_id: admin_id,
      action: "Data Flush",
      detail: "All platform data was flushed by admin",
      entity_type: "system",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
