// Public read-replacement for the webauthn_credentials table.
// Returns the minimum needed to identify a registered passkey at login time.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const credentialId = typeof body.credential_id === "string" ? body.credential_id.trim() : "";

    if (!credentialId || credentialId.length > 512) {
      return new Response(JSON.stringify({ error: "credential_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return only minimal fields needed to continue the WebAuthn ceremony.
    const { data } = await admin
      .from("webauthn_credentials")
      .select("credential_id, email, user_id")
      .eq("credential_id", credentialId)
      .maybeSingle();

    if (!data) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      found: true,
      credential_id: data.credential_id,
      email: data.email,
      user_id: data.user_id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
