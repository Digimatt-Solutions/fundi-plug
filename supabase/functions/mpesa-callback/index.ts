import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (req) => {
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

    const checkoutRequestId = String(callback.CheckoutRequestID || "");
    const resultCode = Number(callback.ResultCode);
    if (!checkoutRequestId) {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
    }

    const { data: payment } = await supabaseClient
      .from("payments")
      .select("id, job_id, amount, status")
      .eq("stripe_payment_id", `mpesa_${checkoutRequestId}`)
      .single();

    if (!payment) {
      console.error("Payment not found for checkout:", checkoutRequestId);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
    }

    if (resultCode === 0) {
      let receiptNumber = "";
      const items = callback.CallbackMetadata?.Item || [];
      for (const item of items) {
        if (item.Name === "MpesaReceiptNumber") receiptNumber = String(item.Value);
      }

      await supabaseClient.from("payments").update({
        status: "completed",
        stripe_payment_id: `mpesa_${receiptNumber || checkoutRequestId}`,
      }).eq("id", payment.id);

      await supabaseClient.from("jobs").update({ status: "completed" }).eq("id", payment.job_id);
    } else {
      await supabaseClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
  }
});
