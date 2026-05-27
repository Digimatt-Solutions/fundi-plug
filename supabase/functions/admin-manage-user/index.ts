import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertTokenNotRevoked } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const preflightAdmin = createClient(supabaseUrl, serviceRoleKey);
    const revoked = await assertTokenNotRevoked(req, preflightAdmin);
    if (revoked) return revoked;


    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", caller.id).single();
    if (roleData?.role !== "admin") throw new Error("Admin access required");

    const { action, userId, newRole, isActive, paymentId } = await req.json();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Identify super admin (first admin by earliest profile creation date)
    const { data: superAdminId } = await adminClient.rpc("get_super_admin_id");
    const callerIsSuper = caller.id === superAdminId;
    const targetIsSuper = userId && userId === superAdminId;

    // Protect super admin from being modified by anyone other than themselves
    const protectedActions = ["change_role", "toggle_active", "delete_user", "promote_to_admin"];
    if (protectedActions.includes(action) && targetIsSuper && !callerIsSuper) {
      return new Response(
        JSON.stringify({ error: "The super admin account is protected. Only the super admin can modify it." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "change_role") {
      await adminClient.from("user_roles").update({ role: newRole }).eq("user_id", userId);
      await adminClient.from("activity_logs").insert({
        user_id: caller.id, action: "Role Changed",
        detail: `Changed user role to ${newRole}`, entity_type: "user", entity_id: userId,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "promote_to_admin") {
      const { data: existingRole } = await adminClient.from("user_roles").select("user_id").eq("user_id", userId).maybeSingle();
      if (existingRole) {
        await adminClient.from("user_roles").update({ role: "admin" }).eq("user_id", userId);
      } else {
        await adminClient.from("user_roles").insert({ user_id: userId, role: "admin" });
      }

      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      const targetEmail = userData?.user?.email;
      if (!targetEmail) throw new Error("Target user email not found");

      await adminClient.auth.admin.updateUserById(userId, {
        email_confirm: true,
        user_metadata: {
          ...(userData?.user?.user_metadata || {}),
          promoted_to_admin_at: new Date().toISOString(),
          promoted_by: caller.id,
        },
      });

      await adminClient.from("activity_logs").insert({
        user_id: caller.id, action: "User Promoted to Admin",
        detail: `Promoted ${targetEmail} to admin (no verification required)`, entity_type: "user", entity_id: userId,
      });
      return new Response(JSON.stringify({ success: true, email: targetEmail }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle_active") {
      await adminClient.from("profiles").update({ is_active: isActive }).eq("id", userId);
      await adminClient.from("activity_logs").insert({
        user_id: caller.id, action: isActive ? "User Activated" : "User Deactivated",
        detail: `User ${isActive ? "activated" : "deactivated"}`, entity_type: "user", entity_id: userId,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_user") {
      await adminClient.from("availability").delete().eq("worker_id", userId);
      await adminClient.from("withdrawals").delete().eq("worker_id", userId);
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      await adminClient.from("activity_logs").insert({
        user_id: caller.id, action: "User Deleted",
        detail: "Permanently deleted user account", entity_type: "user", entity_id: userId,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset_payment") {
      if (!paymentId) throw new Error("Missing paymentId");
      await adminClient.from("payments").delete().eq("id", paymentId).eq("status", "failed");
      await adminClient.from("activity_logs").insert({
        user_id: caller.id, action: "Payment Reset",
        detail: "Reset failed payment for customer retry", entity_type: "payment", entity_id: paymentId,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Invalid action");
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
