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
    if (!userData.user) throw new Error("Unauthorized");

    const { reference, paymentId } = await req.json();
    if (!reference && !paymentId) throw new Error("Missing reference or paymentId");

    let ref = reference;
    if (!ref && paymentId) {
      const { data: pmt } = await supabase
        .from("payments")
        .select("stripe_payment_id")
        .eq("id", paymentId)
        .single();
      ref = pmt?.stripe_payment_id;
    }
    if (!ref) throw new Error("Reference not found");

    const verifyRes = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData?.status) {
      throw new Error(verifyData?.message || "Verification failed");
    }

    const txStatus = verifyData?.data?.status; // 'success' | 'failed' | 'abandoned'
    const newStatus = txStatus === "success" ? "completed" : txStatus === "failed" ? "failed" : "pending";

    await supabase
      .from("payments")
      .update({ status: newStatus })
      .eq("stripe_payment_id", ref);

    return respond({ ok: true, status: newStatus, paystackStatus: txStatus });
  } catch (err: any) {
    console.error("paystack-verify-payment error:", err);
    return respond({ ok: false, error: err.message });
  }
});
