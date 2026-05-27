import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FAILED = 6;
const LOCK_HOURS = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email: rawEmail, password } = await req.json();
    if (!rawEmail || !password) {
      return json({ error: "Email and password are required" }, 400);
    }
    const email = String(rawEmail).trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Check lockout
    const { data: existing } = await admin
      .from("login_attempts")
      .select("failed_count, locked_until")
      .eq("email", email)
      .maybeSingle();

    if (existing?.locked_until && new Date(existing.locked_until) > new Date()) {
      const msLeft = new Date(existing.locked_until).getTime() - Date.now();
      const minsLeft = Math.ceil(msLeft / 60000);
      const human = minsLeft >= 60 ? `${Math.ceil(minsLeft / 60)} hour(s)` : `${minsLeft} minute(s)`;
      return json(
        {
          error: `Account temporarily locked due to too many failed login attempts. Try again in ${human}.`,
          locked: true,
          locked_until: existing.locked_until,
        },
        423
      );
    }

    // 2. Attempt sign-in via anon client (does not consume admin privileges)
    const anon = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session) {
      // 3. Record failure
      const newCount = (existing?.failed_count ?? 0) + 1;
      const shouldLock = newCount >= MAX_FAILED;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCK_HOURS * 60 * 60 * 1000).toISOString()
        : null;

      await admin.from("login_attempts").upsert(
        {
          email,
          failed_count: shouldLock ? 0 : newCount, // reset counter once locked
          locked_until: lockedUntil,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

      if (shouldLock) {
        return json(
          {
            error: `Account locked for ${LOCK_HOURS} hours due to ${MAX_FAILED} failed login attempts.`,
            locked: true,
            locked_until: lockedUntil,
          },
          423
        );
      }

      const remaining = MAX_FAILED - newCount;
      return json(
        {
          error: `Invalid email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`,
          attempts_remaining: remaining,
        },
        401
      );
    }

    // 4. Success — reset counter
    await admin
      .from("login_attempts")
      .upsert(
        {
          email,
          failed_count: 0,
          locked_until: null,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

    return json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    });
  } catch (err) {
    console.error("secure-login error:", err);
    return json({ error: "Internal server error" }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
