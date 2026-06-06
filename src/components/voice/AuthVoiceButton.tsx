import { useEffect, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  isSpeechRecognitionSupported,
  listenOnce,
  speak,
  stopSpeaking,
  parseSpokenEmail,
} from "@/lib/voice";

/**
 * Voice login button for visually-impaired users.
 * Compact mode: icon-only button (matches fingerprint button styling).
 * Full mode: full-width button with label.
 * Flow: tap → asks for email → asks for password → confirms → logs in.
 */
export const AuthVoiceButton = ({ compact = false, autoStart = false, onCompactClick }: { compact?: boolean; autoStart?: boolean; onCompactClick?: () => void }) => {
  const { login } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [popup, setPopup] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(null), 6000);
    return () => clearTimeout(t);
  }, [popup]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoStart) { run(); } }, [autoStart]);

  const run = async () => {
    if (!isSpeechRecognitionSupported()) {
      const msg = "Voice not supported. Try Chrome or Edge.";
      setPopup({ kind: "err", text: msg });
      toast({ title: "Voice not supported", description: msg, variant: "destructive" });
      return;
    }
    setBusy(true);
    setPopup({ kind: "warn", text: "Listening for your email..." });
    try {
      // Email
      await new Promise<void>((r) =>
        speak("Please say your email address. For example, john at gmail dot com.", { onEnd: () => r() })
      );
      setStatus("Listening for email...");
      const emailRaw = await listenOnce({ timeoutMs: 12000 });
      const email = parseSpokenEmail(emailRaw);
      setPopup({ kind: "warn", text: `Heard: ${email}. Now say password.` });
      await new Promise<void>((r) => speak(`I heard ${email}. Now say your password.`, { onEnd: () => r() }));

      // Password — instruct user to spell it out character by character.
      setStatus("Listening for password...");
      await new Promise<void>((r) =>
        speak(
          "Now spell your password one character at a time. " +
          "Say capital before a letter for uppercase, say alpha bravo charlie for letters, " +
          "say the digits as one, two, three, and say at, hash, dollar, dash, underscore, " +
          "exclamation, dot, or star for special characters.",
          { onEnd: () => r() }
        )
      );
      const passRaw = await listenOnce({ timeoutMs: 20000 });
      const password = parseSpokenPassword(passRaw);

      setStatus("Signing you in...");
      setPopup({ kind: "warn", text: "Signing you in..." });
      speak("Signing you in.");
      await login(email, password);
      sessionStorage.setItem("voice_assistant_greet", "1");
      setPopup({ kind: "ok", text: "Signed in." });
      toast({ title: "Signed in", description: "Welcome back." });
    } catch (e: any) {
      const msg = e?.message || "Voice sign in failed.";
      speak(`Sorry, ${msg}. Please try again or sign in manually.`);
      setPopup({ kind: "err", text: msg });
      toast({ title: "Voice sign in failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const handleClick = busy ? () => { stopSpeaking(); setBusy(false); setStatus(""); } : run;

  if (compact) {
    return (
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onCompactClick ?? handleClick}
          aria-label="Sign in with voice"
          title="Sign in with voice"
          className="h-12 w-12 shrink-0 border-2 border-primary/60 hover:bg-primary hover:border-primary group"
        >
          {busy ? (
            <MicOff className="w-5 h-5 text-primary animate-pulse group-hover:text-white" />
          ) : (
            <Mic className="w-5 h-5 text-primary group-hover:text-white" />
          )}
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

  return (
    <div className="flex flex-col items-center gap-2 mb-4">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        className="w-full h-12 gap-2"
        aria-label="Sign in with voice"
      >
        {busy ? <MicOff className="w-4 h-4 text-primary animate-pulse" /> : <Mic className="w-4 h-4" />}
        <span>{busy ? (status || "Listening...") : "Sign in with voice"}</span>
        <Volume2 className="w-4 h-4 ml-auto text-muted-foreground" />
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Accessibility: voice assistant for visually impaired users.
      </p>
    </div>
  );
};

export default AuthVoiceButton;
