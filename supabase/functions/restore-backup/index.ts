import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables that may be safely restored. Order matters for FK-like dependencies.
const RESTORABLE_TABLES = [
  "profiles",
  "user_roles",
  "service_categories",
  "worker_profiles",
  "jobs",
  "bookings",
  "payments",
  "withdrawals",
  "reviews",
  "job_applications",
  "availability",
  "certifications",
  "complaints",
  "platform_settings",
  "module_settings",
  "activity_logs",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", caller.id).single();
    if (roleData?.role !== "admin") throw new Error("Admin access required");

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Only super admin may restore
    const { data: superAdminId } = await admin.rpc("get_super_admin_id");
    if (caller.id !== superAdminId) {
      return new Response(JSON.stringify({ error: "Only the super admin can import a backup." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const backup = body?.backup;
    if (!backup || typeof backup !== "object") throw new Error("Invalid backup payload");

    const summary: Record<string, { inserted: number; failed: number; error?: string }> = {};

    for (const table of RESTORABLE_TABLES) {
      const rows = backup[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        summary[table] = { inserted: 0, failed: 0 };
        continue;
      }
      // Upsert by id if present
      const { error, count } = await admin.from(table).upsert(rows, { onConflict: "id", ignoreDuplicates: false, count: "exact" });
      if (error) {
        summary[table] = { inserted: 0, failed: rows.length, error: error.message };
      } else {
        summary[table] = { inserted: count ?? rows.length, failed: 0 };
      }
    }

    await admin.from("activity_logs").insert({
      user_id: caller.id,
      action: "Backup Restored",
      detail: `Imported backup affecting ${Object.keys(summary).length} tables`,
      entity_type: "system",
      entity_id: caller.id,
    });

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
