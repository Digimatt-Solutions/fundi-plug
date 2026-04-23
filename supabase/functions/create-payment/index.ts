import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!user?.email) throw new Error("Not authenticated");

    const { jobId, amount, workerId } = await req.json();
    if (!jobId || !amount || !workerId) throw new Error("Missing jobId, amount, or workerId");

    // Get commission rate from platform_settings
    const { data: settings } = await supabaseClient.from("platform_settings").select("value").eq("key", "commission_rate").single();
    const commissionRate = settings ? parseFloat(settings.value) : 15;
    const commission = Math.round(amount * commissionRate) / 100;
    const workerPay = amount - commission;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    // Create a payment record first
    const { data: payment, error: payErr } = await supabaseClient.from("payments").insert({
      job_id: jobId,
      payer_id: user.id,
      payee_id: workerId,
      amount: workerPay,
      commission,
      status: "pending",
    }).select().single();

    if (payErr) throw new Error(payErr.message);

    const origin = req.headers.get("origin") || "https://id-preview--7ef41c6d-8355-45a2-b7bd-1ba2ac20201d.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `Service Payment - Job` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/dashboard/bookings?payment=success&payment_id=${payment.id}`,
      cancel_url: `${origin}/dashboard/bookings?payment=cancelled`,
      metadata: { payment_id: payment.id, job_id: jobId },
    });

    // Store stripe session id
    await supabaseClient.from("payments").update({ stripe_payment_id: session.id }).eq("id", payment.id);

    return new Response(JSON.stringify({ url: session.url, paymentId: payment.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
