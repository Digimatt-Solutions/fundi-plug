// Admin-only: change a user's auth email via the Supabase Auth Admin API.
// Standard client-side email updates are blocked by the prevent_profile_email_change
// trigger; this is the audited path that requires admin privileges.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const accessToken = auth.slice(7).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: callerData, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !callerData.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await userClient
      .from("user_roles").select("role").eq("user_id", callerData.user.id).single();
    if (roleRow?.role !== "admin") return json({ error: "Admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetUserId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const newEmail = typeof body?.new_email === "string" ? body.new_email.trim().toLowerCase() : "";
    if (!targetUserId || !isValidEmail(newEmail)) {
      return json({ error: "user_id and a valid new_email are required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Update auth.users via Admin API (already-confirmed so user can keep signing in).
    const { error: updErr } = await admin.auth.admin.updateUserById(targetUserId, {
      email: newEmail,
      email_confirm: true,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    // Mirror to public.profiles (service_role bypasses the prevent_profile_email_change trigger).
    await admin.from("profiles").update({ email: newEmail }).eq("id", targetUserId);

    await admin.from("activity_logs").insert({
      user_id: callerData.user.id,
      action: "Email Changed (Admin)",
      detail: `Changed email for ${targetUserId} to ${newEmail}`,
      entity_type: "user",
      entity_id: targetUserId,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("admin-change-email error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
