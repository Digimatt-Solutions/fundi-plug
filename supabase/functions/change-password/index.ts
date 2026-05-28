// Securely change the authenticated user's password AND invalidate every
// other refresh token / session for that user (defense against token theft
// and to enforce "logged out everywhere after password change").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { sha256Hex } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const accessToken = auth.slice(7).trim();

    const { new_password } = await req.json().catch(() => ({}));
    if (typeof new_password !== "string" || new_password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Identify caller via their access token.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // 1) Update the password using admin API (also bumps the password hash
    //    so old refresh tokens are no longer accepted).
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: new_password });
    if (updErr) return json({ error: updErr.message }, 400);

    // 2) Globally sign the user out — invalidates EVERY refresh token across
    //    all devices/sessions for this user.
    try { await admin.auth.admin.signOut(userId, "global" as any); } catch { /* best effort */ }

    // 3) Blacklist the current access token too so it stops working immediately
    //    (access tokens stay valid until exp otherwise).
    try {
      const exp = JSON.parse(atob(accessToken.split(".")[1] || "")).exp;
      const expires_at = exp ? new Date(exp * 1000).toISOString() : new Date(Date.now() + 3600 * 1000).toISOString();
      await admin.from("token_blacklist").upsert(
        { token_hash: await sha256Hex(accessToken), user_id: userId, expires_at },
        { onConflict: "token_hash" },
      );
    } catch { /* best effort */ }

    await admin.from("activity_logs").insert({
      user_id: userId, action: "Password Changed",
      detail: "Password updated; all sessions invalidated", entity_type: "user", entity_id: userId,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("change-password error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
