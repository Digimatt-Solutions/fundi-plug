import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "@supabase/supabase-js/cors";

const RATE_LIMIT_SECONDS = 60;
const OTP_EXPIRY_MINUTES = 5;

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone_number } = await req.json();

    if (!phone_number || typeof phone_number !== "string") {
      return new Response(JSON.stringify({ error: "Phone number is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate Kenyan format: 2547XXXXXXXX (12 digits starting with 2547)
    const kenyanRegex = /^2547\d{8}$/;
    if (!kenyanRegex.test(phone_number)) {
      return new Response(JSON.stringify({ error: "Invalid Kenyan phone number. Use format 2547XXXXXXXX" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Rate limiting: check last OTP sent to this number
    const { data: recent } = await supabase
      .from("phone_otps")
      .select("created_at")
      .eq("phone_number", phone_number)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recent) {
      const diff = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (diff < RATE_LIMIT_SECONDS) {
        const wait = Math.ceil(RATE_LIMIT_SECONDS - diff);
        return new Response(JSON.stringify({ error: `Please wait ${wait} seconds before requesting another code` }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Store hashed OTP
    const { error: insertError } = await supabase.from("phone_otps").insert({
      phone_number,
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to generate code" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send SMS via Airtouch
    const smsUsername = Deno.env.get("SMS_USERNAME");
    const smsPassword = Deno.env.get("SMS_PASSWORD");
    if (!smsUsername || !smsPassword) {
      console.error("SMS credentials not configured");
      return new Response(JSON.stringify({ error: "SMS service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = `Your FundiPlug verification code is ${otp}`;
    const smsUrl = `https://client.airtouch.co.ke:9012/sms/api/?issn=DIGIMATT&msisdn=${phone_number}&text=${encodeURIComponent(message)}&username=${encodeURIComponent(smsUsername)}&password=${encodeURIComponent(smsPassword)}`;

    const smsRes = await fetch(smsUrl);
    if (!smsRes.ok) {
      console.error("SMS send failed:", smsRes.status, await smsRes.text());
      return new Response(JSON.stringify({ error: "Failed to send SMS" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
