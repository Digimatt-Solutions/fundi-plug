import { useState } from "react";
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
  parseSpokenPassword,
} from "@/lib/voice";

/**
 * Voice login button for visually-impaired users.
 * Flow: tap → asks for email → asks for password → confirms → logs in.
 * After successful login, the global VoiceAssistant takes over on the dashboard.
 */
export const AuthVoiceButton = () => {
  const { login } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const run = async () => {
    if (!isSpeechRecognitionSupported()) {
      toast({
        title: "Voice not supported",
        description: "Your browser doesn't support voice input. Try Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      // Email
      await new Promise<void>((r) =>
        speak("Please say your email address. For example, john at gmail dot com.", { onEnd: () => r() })
      );
      setStatus("Listening for email...");
      const emailRaw = await listenOnce({ timeoutMs: 12000 });
      const email = parseSpokenEmail(emailRaw);
      await new Promise<void>((r) => speak(`I heard ${email}. Now say your password.`, { onEnd: () => r() }));

      // Password
      setStatus("Listening for password...");
      const passRaw = await listenOnce({ timeoutMs: 12000 });
      const password = parseSpokenPassword(passRaw);

      setStatus("Signing you in...");
      speak("Signing you in.");
      await login(email, password);
      // Mark that the assistant should greet+narrate after redirect
      sessionStorage.setItem("voice_assistant_greet", "1");
      toast({ title: "Signed in", description: "Welcome back." });
    } catch (e: any) {
      const msg = e?.message || "Voice sign in failed.";
      speak(`Sorry, ${msg}. Please try again or sign in manually.`);
      toast({ title: "Voice sign in failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 mb-4">
      <Button
        type="button"
        variant="outline"
        onClick={busy ? () => { stopSpeaking(); setBusy(false); setStatus(""); } : run}
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
