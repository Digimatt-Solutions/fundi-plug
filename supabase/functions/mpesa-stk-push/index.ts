import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MPESA_SHORTCODE = "174379";
const MPESA_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a1520bfc04c462872d4428e4bd8a2e6e3e7852";
const MPESA_BASE_URL = "https://sandbox.safaricom.co.ke";

async function getMpesaToken(): Promise<string> {
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY") || "";
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET") || "";
  
  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa consumer key/secret not configured");
  }
  
  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  console.log("Fetching M-Pesa token...");

  const res = await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  
  const text = await res.text();
  console.log("Token response status:", res.status);
  
  if (!res.ok) {
    throw new Error(`M-Pesa auth failed (${res.status}): ${text}`);
  }
  
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("No access_token in M-Pesa response");
  return data.access_token;
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) throw new Error("Not authenticated");

    const { jobId, amount, workerId, phoneNumber } = await req.json();
    if (!jobId || !amount || !workerId || !phoneNumber) {
      throw new Error("Missing jobId, amount, workerId, or phoneNumber");
    }

    // Format phone: ensure 254XXXXXXXXX
    let phone = phoneNumber.replace(/\s+/g, "").replace(/^0/, "254").replace(/^\+/, "");
    if (!phone.startsWith("254")) phone = "254" + phone;

    console.log("Processing M-Pesa payment for job:", jobId, "phone:", phone, "amount:", amount);

    // Get commission rate
    const { data: settings } = await supabaseClient
      .from("platform_settings")
      .select("value")
      .eq("key", "commission_rate")
      .single();
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
    }).select().single();

    if (payErr) {
      console.error("Payment insert error:", payErr);
      throw new Error(payErr.message);
    }

    // Get M-Pesa token
    const accessToken = await getMpesaToken();
    const timestamp = getTimestamp();
    const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

    const stkBody = {
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
      TransactionDesc: "Payment for service",
    };

    console.log("Sending STK Push...");
    const stkRes = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkBody),
    });

    const stkText = await stkRes.text();
    console.log("STK response status:", stkRes.status, "body:", stkText);

    let stkData;
    try {
      stkData = JSON.parse(stkText);
    } catch {
      throw new Error(`Invalid STK response: ${stkText}`);
    }

    if (stkData.ResponseCode !== "0") {
      await supabaseClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
      throw new Error(stkData.ResponseDescription || stkData.errorMessage || "STK Push failed");
    }

    // Store checkout request ID
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
    console.error("M-Pesa STK Push error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
