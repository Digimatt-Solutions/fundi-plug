import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sandbox defaults from Safaricom
const MPESA_SHORTCODE = "174379";
const MPESA_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a1520bfc04c462872d4428e4bd8a2e6e3e7852";
const MPESA_BASE_URL = "https://sandbox.safaricom.co.ke";

async function getMpesaToken(): Promise<string> {
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY") || "";
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET") || "";
  const auth = btoa(`${consumerKey}:${consumerSecret}`);

  const res = await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get M-Pesa access token");
  return data.access_token;
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) throw new Error("Not authenticated");

    const { jobId, amount, workerId, phoneNumber } = await req.json();
    if (!jobId || !amount || !workerId || !phoneNumber) {
      throw new Error("Missing jobId, amount, workerId, or phoneNumber");
    }

    // Format phone: ensure 254XXXXXXXXX format
    let phone = phoneNumber.replace(/\s+/g, "").replace(/^0/, "254").replace(/^\+/, "");
    if (!phone.startsWith("254")) phone = "254" + phone;

    // Get commission rate
    const { data: settings } = await supabaseClient.from("platform_settings").select("value").eq("key", "commission_rate").single();
    const commissionRate = settings ? parseFloat(settings.value) : 15;
    const commission = Math.round(amount * commissionRate) / 100;
    const workerPay = amount - commission;

    // Create payment record
    const { data: payment, error: payErr } = await supabaseClient.from("payments").insert({
      job_id: jobId,
      payer_id: user.id,
      payee_id: workerId,
      amount: workerPay,
      commission,
      status: "pending",
      stripe_payment_id: null,
    }).select().single();
    if (payErr) throw new Error(payErr.message);

    // Get M-Pesa token
    const accessToken = await getMpesaToken();
    const timestamp = getTimestamp();
    const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

    const stkRes = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amount),
        PartyA: phone,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: `Job-${jobId.slice(0, 8)}`,
        TransactionDesc: `Payment for service`,
      }),
    });

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== "0") {
      // Update payment as failed
      await supabaseClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
      throw new Error(stkData.ResponseDescription || "STK Push failed");
    }

    // Store the checkout request ID
    await supabaseClient.from("payments").update({
      stripe_payment_id: `mpesa_${stkData.CheckoutRequestID}`,
    }).eq("id", payment.id);

    return new Response(JSON.stringify({
      success: true,
      paymentId: payment.id,
      checkoutRequestId: stkData.CheckoutRequestID,
      message: "STK Push sent. Check your phone to complete payment.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
