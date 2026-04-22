import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_BASE = "https://api.paystack.co";

function respond(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) throw new Error("Paystack secret key not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("Unauthorized");

    const { jobId, amount, workerId } = await req.json();
    if (!jobId || !amount || !workerId) throw new Error("Missing required fields");

    // Compute commission split (matches create-payment behavior)
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "commission_rate")
      .single();
    const commissionRate = settings ? parseFloat(settings.value) : 15;
    const commission = Math.round(Number(amount) * commissionRate) / 100;
    const workerPay = Number(amount) - commission;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, name, phone")
      .eq("id", user.id)
      .single();

    const origin = req.headers.get("origin") || "https://app.fundiplug.com";
    const reference = `paystack_${jobId.slice(0, 8)}_${Date.now()}`;

    // Create pending payment row with commission split
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        job_id: jobId,
        payer_id: user.id,
        payee_id: workerId,
        amount: workerPay,
        commission,
        status: "pending",
        stripe_payment_id: reference,
      })
      .select()
      .single();
    if (payErr) throw payErr;

    // Initialize Paystack transaction (charge full amount; commission is recorded internally)
    const initRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: profile?.email || user.email,
        amount: Math.round(Number(amount) * 100),
        currency: "KES",
        reference,
        callback_url: `${origin}/dashboard/bookings?payment=success&payment_id=${payment.id}`,
        metadata: {
          jobId,
          paymentId: payment.id,
          commission,
          workerPay,
          customerName: profile?.name || "Customer",
          phone: profile?.phone || "",
        },
      }),
    });

    const initData = await initRes.json();
    if (!initData?.status || !initData?.data?.authorization_url) {
      console.error("Paystack init failed:", initRes.status, JSON.stringify(initData));
      throw new Error(initData?.message || "Failed to initialize Paystack transaction");
    }

    return respond({
      ok: true,
      url: initData.data.authorization_url,
      reference: initData.data.reference,
      paymentId: payment.id,
    });
  } catch (err: any) {
    console.error("paystack-initiate-payment error:", err);
    return respond({ ok: false, error: err.message, diagnostics: { provider: "paystack" } });
  }
});
