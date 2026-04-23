import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (req) => {
  // M-Pesa callback - no CORS needed, this is server-to-server
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    const callback = body?.Body?.stkCallback;
    if (!callback) {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;

    // Find payment by checkout request ID
    const { data: payment } = await supabaseClient
      .from("payments")
      .select("id, job_id")
      .eq("stripe_payment_id", `mpesa_${checkoutRequestId}`)
      .single();

    if (!payment) {
      console.error("Payment not found for checkout:", checkoutRequestId);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
    }

    if (resultCode === 0) {
      // Payment successful
      // Extract M-Pesa receipt number from callback metadata
      let receiptNumber = "";
      const items = callback.CallbackMetadata?.Item || [];
      for (const item of items) {
        if (item.Name === "MpesaReceiptNumber") {
          receiptNumber = item.Value;
          break;
        }
      }

      await supabaseClient.from("payments").update({
        status: "completed",
        stripe_payment_id: `mpesa_${receiptNumber || checkoutRequestId}`,
      }).eq("id", payment.id);

      // Update job status
      await supabaseClient.from("jobs").update({ status: "completed" }).eq("id", payment.job_id);
    } else {
      // Payment failed or cancelled
      await supabaseClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
  }
});
