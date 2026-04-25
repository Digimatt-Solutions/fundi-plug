// Translates technical / edge-function / supabase errors into simple
// plain-English messages a non-technical user can understand.

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  // Auth
  { test: /invalid login credentials/i, message: "Wrong email or password. Please try again." },
  { test: /email not confirmed/i, message: "Please verify your email before signing in." },
  { test: /user already registered|already exists/i, message: "An account with this email already exists." },
  { test: /password.*(short|weak|6)/i, message: "Password is too short. Use at least 6 characters." },
  { test: /rate limit|too many requests|429/i, message: "Too many attempts. Please wait a moment and try again." },
  { test: /jwt|token.*(expired|invalid)/i, message: "Your session expired. Please sign in again." },
  { test: /not authenticated|unauthorized|401/i, message: "Please sign in to continue." },
  { test: /forbidden|permission|not allowed|403/i, message: "You don't have permission to do that." },
  { test: /not found|404/i, message: "We couldn't find what you were looking for." },

  // OTP / Phone
  { test: /otp.*(invalid|incorrect|wrong)/i, message: "The code you entered is incorrect." },
  { test: /otp.*(expired)/i, message: "The code has expired. Please request a new one." },
  { test: /phone.*(invalid|format)/i, message: "Please enter a valid phone number." },

  // Network
  { test: /failed to fetch|network|networkerror|fetch.*failed/i, message: "Connection problem. Check your internet and try again." },
  { test: /timeout|timed out/i, message: "The request took too long. Please try again." },
  { test: /cors/i, message: "Connection problem. Please refresh the page." },

  // Storage / Upload
  { test: /file.*(too large|size)|payload too large|413/i, message: "That file is too large. Please choose a smaller one." },
  { test: /(mime|file type|invalid type)/i, message: "That file type isn't supported." },
  { test: /upload.*(failed|error)/i, message: "Upload failed. Please try again." },

  // DB
  { test: /duplicate key|unique constraint|already exists/i, message: "That entry already exists." },
  { test: /foreign key|violates.*constraint/i, message: "Something's missing. Please check your inputs and try again." },
  { test: /row.level security|rls/i, message: "You don't have permission to do that." },

  // Payments
  { test: /insufficient funds|declined/i, message: "Payment declined. Please try a different method." },
  { test: /stripe|paystack|mpesa/i, message: "Payment couldn't be processed. Please try again." },

  // Edge functions generic
  { test: /functioninvocationerror|edge function|non-2xx|status code 5\d\d|500|502|503/i,
    message: "Service is temporarily unavailable. Please try again in a moment." },
];

export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  const raw =
    typeof err === "string"
      ? err
      : (err as any)?.message || (err as any)?.error_description || (err as any)?.error || "";
  if (!raw) return fallback;

  for (const p of PATTERNS) {
    if (p.test.test(raw)) return p.message;
  }
  // Strip technical noise like "FunctionsHttpError:", JSON, stack hints
  const cleaned = String(raw)
    .replace(/^[A-Z][A-Za-z]*Error:\s*/, "")
    .replace(/\s*at\s+.*$/s, "")
    .trim();
  // If still looks technical (very long / has braces / has codes), fall back
  if (cleaned.length > 140 || /[{}<>]|\bcode\b|\bstack\b/i.test(cleaned)) return fallback;
  return cleaned || fallback;
}
