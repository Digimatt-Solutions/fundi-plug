import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isWebAuthnSupported, verifyFingerprint } from "@/lib/webauthn";
import { speak } from "@/lib/voice";

/**
 * Compact fingerprint button used on the auth form (next to voice button).
 * Flow:
 *  - On click, request the platform authenticator (fingerprint).
 *  - Look up the credential in webauthn_credentials.
 *  - If found and email/password is stored on the profile, sign-in via OTP magic-link
 *    is not used here; instead we ask the user to type their password ONCE so we can
 *    sign in. After that, only fingerprint is needed.
 *
 * For pure passwordless login we'd need a backend session - so we keep it simple:
 * fingerprint identifies the account and we use the cached credentials in localStorage
 * (set on a previous successful login while fingerprint was already enrolled).
 */
export default function AuthFingerprintButton({ compact = true }: { compact?: boolean }) {
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  useEffect(() => { setSupported(isWebAuthnSupported()); }, []);

  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(null), 6000);
    return () => clearTimeout(t);
  }, [popup]);

  const handle = async () => {
    if (!supported) {
      const msg = "Fingerprint sign-in is not supported on this device.";
      speak(msg);
      setPopup({ kind: "err", text: msg });
      return;
    }
    setBusy(true);
    try {
      const credId = await verifyFingerprint();
      // Look up the credential -> email
      const { data: cred } = await supabase
        .from("webauthn_credentials")
        .select("email, user_id")
        .eq("credential_id", credId)
        .maybeSingle();

      if (!cred) {
        const msg = "Fingerprint not registered. Please sign in once with email and password to register.";
        speak("Fingerprint not registered.");
        setPopup({ kind: "warn", text: msg });
        return;
      }

      // Look up cached session credentials on this device
      const cached = localStorage.getItem(`fp_secret_${credId}`);
      if (!cached) {
        const msg = `We recognized you (${cred.email}). Please type your password once on this device to enable fingerprint sign-in here.`;
        speak("Please sign in once with your password to enable fingerprint sign-in on this device.");
        setPopup({ kind: "warn", text: msg });
        return;
      }
      const { email, password } = JSON.parse(cached);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        localStorage.removeItem(`fp_secret_${credId}`);
        throw error;
      }
      await supabase.from("webauthn_credentials")
        .update({ last_used_at: new Date().toISOString() })
        .eq("credential_id", credId);
      speak(`Welcome back ${email.split("@")[0]}.`);
      setPopup({ kind: "ok", text: "Signed in with fingerprint." });
    } catch (e: any) {
      const msg = e?.message || "Fingerprint sign-in failed.";
      speak("Fingerprint sign-in failed.");
      setPopup({ kind: "err", text: msg });
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "default"}
        onClick={handle}
        disabled={busy}
        aria-label="Sign in with fingerprint"
        title="Sign in with fingerprint"
        className={compact ? "h-12 w-12 shrink-0" : "h-12 gap-2"}
      >
        <Fingerprint className={`w-5 h-5 ${busy ? "text-primary animate-pulse" : "text-primary"}`} />
        {!compact && <span>Fingerprint</span>}
      </Button>
      {popup && (
        <div
          role="status"
          className={`absolute z-50 right-0 mt-2 w-72 rounded-lg border p-3 text-xs shadow-lg animate-fade-in ${
            popup.kind === "ok"
              ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300"
              : popup.kind === "warn"
              ? "bg-chart-4/10 border-chart-4/30 text-foreground"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {popup.text}
        </div>
      )}
    </div>
  );
}
