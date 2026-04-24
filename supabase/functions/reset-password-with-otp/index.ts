import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone_number, otp, new_password } = await req.json();

    if (!phone_number || !otp || !new_password) {
      return new Response(JSON.stringify({ error: "Phone, code and new password are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^\d{6}$/.test(otp)) {
      return new Response(JSON.stringify({ error: "Code must be 6 digits" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof new_password !== "string" || new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find latest unverified OTP for this phone
    const { data: otpRecord } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone_number", phone_number)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!otpRecord) {
      return new Response(JSON.stringify({ error: "No pending verification. Request a new code." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Code has expired. Request a new one." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the OTP hash matches (whether or not it was already marked verified by verify-otp)
    const inputHash = await hashOtp(otp);
    if (inputHash !== otpRecord.otp_hash) {
      if (otpRecord.attempts >= 5) {
        return new Response(JSON.stringify({ error: "Too many attempts. Request a new code." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("phone_otps").update({ attempts: otpRecord.attempts + 1 }).eq("id", otpRecord.id);
      return new Response(JSON.stringify({ error: "Invalid code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find profile by phone (signup stores phone on profiles.phone)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("phone", phone_number)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "No account found with this phone number" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update password using admin API
    const { error: updateErr } = await supabase.auth.admin.updateUserById(profile.id, {
      password: new_password,
    });
    if (updateErr) {
      console.error("password update failed", updateErr);
      return new Response(JSON.stringify({ error: "Failed to update password" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Burn the OTP
    await supabase.from("phone_otps").update({ verified: true }).eq("id", otpRecord.id);

    await supabase.from("activity_logs").insert({
      user_id: profile.id,
      action: "Password Reset",
      detail: "Password reset via phone OTP",
      entity_type: "user",
      entity_id: profile.id,
    });

    return new Response(JSON.stringify({ success: true, email: profile.email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("reset-password-with-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
