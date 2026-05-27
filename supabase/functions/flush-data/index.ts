import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertTokenNotRevoked } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const preflight = createClient(supabaseUrl, serviceRoleKey);
    const revoked = await assertTokenNotRevoked(req, preflight);
    if (revoked) return revoked;


    // Identify caller via JWT, NOT via a body parameter.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Caller must be an admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller must be the super admin (the only person allowed to wipe data)
    const { data: superAdminId } = await supabase.rpc("get_super_admin_id");
    if (caller.id !== superAdminId) {
      return new Response(JSON.stringify({ error: "Only the super admin can flush all data." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional confirmation token re-auth: require explicit confirm
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "FLUSH_ALL_DATA") {
      return new Response(JSON.stringify({ error: "Confirmation token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all admin user IDs to preserve
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (adminRoles || []).map((r: any) => r.user_id);

    // Delete in dependency order
    if (adminIds.length > 0) {
      await supabase.from("activity_logs").delete().not("user_id", "in", `(${adminIds.join(",")})`);
    }
    await supabase.from("certifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("availability").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("reviews").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("withdrawals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("job_applications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("bookings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("worker_profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { data: nonAdminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .neq("role", "admin");
    const nonAdminIds = (nonAdminRoles || []).map((r: any) => r.user_id);

    if (nonAdminIds.length > 0) {
      await supabase.from("user_roles").delete().in("user_id", nonAdminIds);
      await supabase.from("profiles").delete().in("id", nonAdminIds);
      for (const uid of nonAdminIds) {
        await supabase.auth.admin.deleteUser(uid);
      }
    }

    await supabase.from("activity_logs").insert({
      user_id: caller.id,
      action: "Data Flush",
      detail: "All platform data was flushed by super admin",
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
