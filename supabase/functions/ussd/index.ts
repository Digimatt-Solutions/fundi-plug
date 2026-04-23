// USSD Gateway endpoint for Africa's Talking
// Receives application/x-www-form-urlencoded body with: sessionId, serviceCode, phoneNumber, text
// Returns plain text starting with "CON " (continue) or "END " (terminate)
//
// IMPORTANT: This function deploys with verify_jwt = false so Africa's Talking can reach it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const txt = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/plain" },
  });

// Normalize phone (+254..., 254..., 07..., 01...) to "254XXXXXXXXX"
function normalizePhone(p: string): string {
  let phone = (p || "").replace(/\D/g, "");
  if (phone.startsWith("254")) return phone;
  if (phone.startsWith("0")) return "254" + phone.slice(1);
  if (phone.startsWith("7") || phone.startsWith("1")) return "254" + phone;
  return phone;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return txt("FundiPlug USSD Gateway is live. POST from Africa's Talking only.");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Africa's Talking sends application/x-www-form-urlencoded
    const ct = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};
    if (ct.includes("application/json")) {
      params = await req.json();
    } else {
      const form = await req.formData();
      form.forEach((v, k) => (params[k] = String(v)));
    }

    const sessionId = params.sessionId || "";
    const phoneNumber = normalizePhone(params.phoneNumber || "");
    const text = (params.text || "").trim();

    console.log("USSD request:", { sessionId, phoneNumber, text });

    // Split user input by * - each entry is one menu choice
    const inputs = text === "" ? [] : text.split("*");
    const level = inputs.length;
    const last = inputs[inputs.length - 1] || "";

    // Look up the user by phone in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("phone", phoneNumber)
      .maybeSingle();

    const greetName = profile?.name?.split(" ")[0] || "Guest";

    // ===== ROOT MENU =====
    if (level === 0) {
      if (!profile) {
        return txt(
          `END Welcome to FundiPlug.\nNo account found for ${phoneNumber}.\nPlease sign up at fundiplug.app first, then dial again.`
        );
      }
      return txt(
        `CON Hi ${greetName}, welcome to FundiPlug.\n` +
          `1. My Jobs / Bookings\n` +
          `2. Request a Service\n` +
          `3. My Earnings (Fundis)\n` +
          `4. My Account\n` +
          `0. Exit`
      );
    }

    if (!profile) return txt("END Account not found. Please register first.");

    // ===== LEVEL 1 =====
    if (level === 1) {
      switch (last) {
        case "1": {
          // My Jobs - Customer sees bookings, Worker sees assigned jobs
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .maybeSingle();
          const role = roleData?.role || "customer";

          const query =
            role === "worker"
              ? supabase
                  .from("jobs")
                  .select("title, status, budget")
                  .eq("worker_id", profile.id)
                  .order("created_at", { ascending: false })
                  .limit(5)
              : supabase
                  .from("jobs")
                  .select("title, status, budget")
                  .eq("customer_id", profile.id)
                  .order("created_at", { ascending: false })
                  .limit(5);

          const { data: jobs } = await query;
          if (!jobs || jobs.length === 0) {
            return txt("END You have no jobs yet.");
          }
          const list = jobs
            .map(
              (j: any, i: number) =>
                `${i + 1}. ${j.title.slice(0, 24)} (${j.status})`
            )
            .join("\n");
          return txt(`END Your recent jobs:\n${list}`);
        }
        case "2":
          return txt(
            `CON Choose service category:\n` +
              `1. Plumbing\n` +
              `2. Electrical\n` +
              `3. Cleaning\n` +
              `4. Carpentry\n` +
              `5. Painting\n` +
              `6. Other`
          );
        case "3": {
          // Earnings - workers only
          const { data: payments } = await supabase
            .from("payments")
            .select("amount, status")
            .eq("payee_id", profile.id);
          if (!payments || payments.length === 0) {
            return txt("END No earnings recorded yet.");
          }
          const completed = payments
            .filter((p: any) => p.status === "completed")
            .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          const pending = payments
            .filter((p: any) => p.status === "pending")
            .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          return txt(
            `END Your earnings:\nAvailable: KSH ${completed.toLocaleString()}\nPending: KSH ${pending.toLocaleString()}`
          );
        }
        case "4":
          return txt(
            `END Account:\nName: ${profile.name}\nEmail: ${profile.email}\nPhone: ${phoneNumber}`
          );
        case "0":
          return txt("END Goodbye. Thank you for using FundiPlug.");
        default:
          return txt("END Invalid option. Dial again.");
      }
    }

    // ===== LEVEL 2: service category chosen =====
    if (level === 2 && inputs[0] === "2") {
      const categories: Record<string, string> = {
        "1": "Plumbing",
        "2": "Electrical",
        "3": "Cleaning",
        "4": "Carpentry",
        "5": "Painting",
        "6": "Other",
      };
      const cat = categories[last];
      if (!cat) return txt("END Invalid category.");
      return txt(`CON Describe the job briefly (e.g. fix leaking tap):`);
    }

    // ===== LEVEL 3: description entered, create job =====
    if (level === 3 && inputs[0] === "2") {
      const categories: Record<string, string> = {
        "1": "Plumbing",
        "2": "Electrical",
        "3": "Cleaning",
        "4": "Carpentry",
        "5": "Painting",
        "6": "Other",
      };
      const catName = categories[inputs[1]];
      const description = last;

      // Try to match an existing service category by name
      const { data: cat } = await supabase
        .from("service_categories")
        .select("id")
        .ilike("name", `%${catName}%`)
        .maybeSingle();

      const { error: jobErr } = await supabase.from("jobs").insert({
        customer_id: profile.id,
        title: `USSD ${catName} request`,
        description,
        category_id: cat?.id || null,
        status: "pending",
        is_instant: true,
      });

      if (jobErr) {
        console.error("USSD job create error:", jobErr);
        return txt("END Could not create your request. Please try again later.");
      }

      return txt(
        `END Request received! A nearby ${catName} fundi will be notified. Open the FundiPlug app to track progress.`
      );
    }

    return txt("END Invalid input. Please dial again.");
  } catch (err) {
    console.error("USSD error:", err);
    return txt("END Service temporarily unavailable. Try again shortly.");
  }
});
