import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// M-Pesa callback receiver.
// Daraja does not sign callbacks, so we authenticate via a shared secret in
// the URL path. Configure your Daraja callback URL as:
//   https://<project>.functions.supabase.co/mpesa-callback?token=<MPESA_CALLBACK_SECRET>
// and set the MPESA_CALLBACK_SECRET environment variable on this function.
serve(async (req) => {
  const expected = Deno.env.get("MPESA_CALLBACK_SECRET");
  const url = new URL(req.url);
  const provided = url.searchParams.get("token") || req.headers.get("x-callback-token") || "";

  if (!expected || provided !== expected) {
    // Always 200 to avoid leaking validity to scanners, but don't process.
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
  }

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

    // Idempotency: don't reprocess completed payments.
    if (payment.status === "completed") {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
    }

    if (resultCode === 0) {
      // Validate the callback amount matches the original request.
      let receiptNumber = "";
      let callbackAmount: number | null = null;
      const items = callback.CallbackMetadata?.Item || [];
      for (const item of items) {
        if (item.Name === "MpesaReceiptNumber") receiptNumber = String(item.Value);
        else if (item.Name === "Amount") callbackAmount = Number(item.Value);
      }

      if (callbackAmount !== null && Math.abs(callbackAmount - Number(payment.amount)) > 0.01) {
        console.warn("M-Pesa callback amount mismatch", { expected: payment.amount, got: callbackAmount });
        await supabaseClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200 });
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
