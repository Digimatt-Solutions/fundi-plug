import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PESAPAL_BASE = "https://cybqa.pesapal.com/pesapalv3";

async function getAuthToken() {
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: Deno.env.get("PESAPAL_CONSUMER_KEY"),
      consumer_secret: Deno.env.get("PESAPAL_CONSUMER_SECRET"),
    }),
  });
  const data = await res.json();
  return data.token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const orderTrackingId = url.searchParams.get("OrderTrackingId");
    const merchantRef = url.searchParams.get("OrderMerchantReference");

    if (!orderTrackingId || !merchantRef) {
      return new Response(JSON.stringify({ status: 200 }), { headers: corsHeaders });
    }

    const token = await getAuthToken();
    const statusRes = await fetch(
      `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    const statusData = await statusRes.json();
    const code = statusData?.status_code; // 1=COMPLETED, 2=FAILED, 3=REVERSED, 0=INVALID

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const newStatus = code === 1 ? "completed" : code === 2 || code === 3 ? "failed" : "pending";

    await supabase
      .from("payments")
      .update({ status: newStatus })
      .eq("stripe_payment_id", `pesapal_${merchantRef}`);

    return new Response(
      JSON.stringify({ orderNotificationType: "IPNCHANGE", orderTrackingId, orderMerchantReference: merchantRef, status: 200 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("pesapal-ipn-callback error:", err);
    return new Response(JSON.stringify({ status: 500, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
