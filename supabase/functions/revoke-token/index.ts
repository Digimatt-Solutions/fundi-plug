import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { sha256Hex } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeJwt(jwt: string): { sub?: string; exp?: number } | null {
  try {
    const payload = jwt.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { access_token, refresh_token } = await req.json().catch(() => ({}));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const tokens: string[] = [];
    if (typeof access_token === "string" && access_token) tokens.push(access_token);
    if (typeof refresh_token === "string" && refresh_token) tokens.push(refresh_token);

    if (tokens.length === 0) {
      return json({ ok: true });
    }

    // Derive user id and access-token expiry from the JWT itself.
    const claims = decodeJwt(access_token || "");
    const userId = claims?.sub;
    // Each row's expires_at: use JWT exp for the access token, +30 days for refresh token.
    const accessExp = claims?.exp ? new Date(claims.exp * 1000).toISOString() : new Date(Date.now() + 3600 * 1000).toISOString();
    const refreshExp = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    const rows = await Promise.all(tokens.map(async (t, i) => ({
      token_hash: await sha256Hex(t),
      user_id: userId ?? null,
      expires_at: i === 0 ? accessExp : refreshExp,
    })));

    await admin.from("token_blacklist").upsert(rows, { onConflict: "token_hash" });

    // Force global sign-out so every other refresh-token for this user is also invalidated.
    if (userId) {
      try { await admin.auth.admin.signOut(userId, "global" as any); } catch { /* best effort */ }
    }

    return json({ ok: true });
  } catch (err) {
    console.error("revoke-token error:", err);
    return json({ error: "Internal server error" }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
