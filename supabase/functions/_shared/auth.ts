// Shared helper: verify that the bearer token in the request has not been
// revoked (i.e. user has logged out). Returns null when the token is OK,
// otherwise returns a 401 Response that the caller should return as-is.
//
// Usage:
//   const revoked = await assertTokenNotRevoked(req, admin);
//   if (revoked) return revoked;
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function assertTokenNotRevoked(
  req: Request,
  admin: SupabaseClient,
): Promise<Response | null> {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null; // not authenticated; downstream code decides

  const token = auth.slice(7).trim();
  if (!token) return null;

  const hash = await sha256Hex(token);
  const { data } = await admin
    .from("token_blacklist")
    .select("token_hash, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (data && new Date(data.expires_at) > new Date()) {
    return new Response(
      JSON.stringify({ error: "Your session has been revoked. Please sign in again." }),
      { status: 401, headers: corsHeaders },
    );
  }
  return null;
}
