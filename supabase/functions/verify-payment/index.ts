import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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
    if (!user) throw new Error("Not authenticated");

    const { paymentId } = await req.json();
    if (!paymentId) throw new Error("Missing paymentId");

    const { data: payment } = await supabaseClient.from("payments").select("*").eq("id", paymentId).single();
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "completed") {
      return new Response(JSON.stringify({ status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Paystack payments are verified by calling Paystack's verify endpoint
    if (payment.stripe_payment_id?.startsWith("paystack_")) {
      const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (paystackKey) {
        const verifyRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(payment.stripe_payment_id)}`,
          { headers: { Authorization: `Bearer ${paystackKey}` } }
        );
        const verifyData = await verifyRes.json();
        const txStatus = verifyData?.data?.status;
        const newStatus = txStatus === "success" ? "completed" : txStatus === "failed" ? "failed" : "pending";
        if (newStatus !== payment.status) {
          await supabaseClient.from("payments").update({ status: newStatus }).eq("id", paymentId);
          if (newStatus === "completed") {
            await supabaseClient.from("activity_logs").insert({
              user_id: payment.payer_id,
              action: "Payment Completed",
              detail: `Paystack payment of KSH ${Number(payment.amount) + Number(payment.commission || 0)} completed`,
              entity_type: "payment",
              entity_id: paymentId,
            });
          }
        }
        return new Response(JSON.stringify({ status: newStatus }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ status: payment.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.stripe_payment_id) {
      const session = await stripe.checkout.sessions.retrieve(payment.stripe_payment_id);
      if (session.payment_status === "paid") {
        await supabaseClient.from("payments").update({ status: "completed" }).eq("id", paymentId);
        // Log activity
        await supabaseClient.from("activity_logs").insert({
          user_id: payment.payer_id,
          action: "Payment Completed",
          detail: `Payment of $${Number(payment.amount) + Number(payment.commission)} completed`,
          entity_type: "payment",
          entity_id: paymentId,
        });
        return new Response(JSON.stringify({ status: "completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ status: payment.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
