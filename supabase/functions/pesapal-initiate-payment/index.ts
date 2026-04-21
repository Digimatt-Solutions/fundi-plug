import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PESAPAL_BASE = "https://cybqa.pesapal.com/pesapalv3"; // sandbox

async function getAuthToken() {
  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET");
  if (!consumerKey || !consumerSecret) throw new Error("Pesapal credentials not configured");

  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });
  const data = await res.json();
  if (!data?.token) throw new Error(data?.error?.message || "Failed to get Pesapal token");
  return data.token as string;
}

async function registerIpn(token: string, ipnUrl: string) {
  const res = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });
  const data = await res.json();
  if (!data?.ipn_id) throw new Error(data?.error?.message || "Failed to register IPN");
  return data.ipn_id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("Unauthorized");

    const { jobId, amount, workerId } = await req.json();
    if (!jobId || !amount || !workerId) throw new Error("Missing required fields");

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, name, phone")
      .eq("id", user.id)
      .single();

    const pesapalToken = await getAuthToken();

    const origin = req.headers.get("origin") || Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".lovable.app");
    const projectId = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
    const ipnUrl = `https://${projectId}.supabase.co/functions/v1/pesapal-ipn-callback`;
    const ipnId = await registerIpn(pesapalToken, ipnUrl);

    const merchantRef = `${jobId}-${Date.now()}`;

    // Create pending payment
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        job_id: jobId,
        payer_id: user.id,
        payee_id: workerId,
        amount,
        status: "pending",
        stripe_payment_id: `pesapal_${merchantRef}`,
      })
      .select()
      .single();
    if (payErr) throw payErr;

    const orderRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${pesapalToken}`,
      },
      body: JSON.stringify({
        id: merchantRef,
        currency: "KES",
        amount: Number(amount),
        description: `FundiPlug Job Payment ${jobId.slice(0, 8)}`,
        callback_url: `${origin}/dashboard/bookings?payment=success&payment_id=${payment.id}`,
        notification_id: ipnId,
        billing_address: {
          email_address: profile?.email || user.email,
          phone_number: profile?.phone || "",
          first_name: (profile?.name || "Customer").split(" ")[0],
          last_name: (profile?.name || "User").split(" ").slice(1).join(" ") || "User",
        },
      }),
    });

    const orderData = await orderRes.json();
    if (!orderData?.redirect_url) {
      throw new Error(orderData?.error?.message || JSON.stringify(orderData));
    }

    return new Response(JSON.stringify({ url: orderData.redirect_url, paymentId: payment.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("pesapal-initiate-payment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
