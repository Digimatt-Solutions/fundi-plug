import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  isSpeechRecognitionSupported,
  listenOnce,
  speak,
  stopSpeaking,
} from "@/lib/voice";

type NavItem = { title: string; url: string; key: string };

const adminNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", key: "dashboard" },
  { title: "Verification", url: "/dashboard/verification", key: "verification" },
  { title: "Jobs", url: "/dashboard/jobs", key: "jobs" },
  { title: "Categories", url: "/dashboard/categories", key: "categories" },
  { title: "Payments", url: "/dashboard/payments", key: "payments" },
  { title: "Disbursements", url: "/dashboard/disbursements", key: "disbursements" },
  { title: "Community", url: "/dashboard/community", key: "community" },
  { title: "Reports", url: "/dashboard/reports", key: "reports" },
  { title: "Activity Logs", url: "/dashboard/activity", key: "activity" },
  { title: "User Management", url: "/dashboard/user-management", key: "user-management" },
  { title: "Profile", url: "/dashboard/account", key: "account" },
  { title: "Settings", url: "/dashboard/settings", key: "settings" },
];
const workerNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", key: "dashboard" },
  { title: "My Jobs", url: "/dashboard/my-jobs", key: "my-jobs" },
  { title: "Profile", url: "/dashboard/profile", key: "profile" },
  { title: "Earnings", url: "/dashboard/earnings", key: "earnings" },
  { title: "Reviews", url: "/dashboard/reviews", key: "reviews" },
  { title: "Payments", url: "/dashboard/payments", key: "payments" },
  { title: "Community", url: "/dashboard/community", key: "community" },
  { title: "Settings", url: "/dashboard/settings", key: "settings" },
];
const customerNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", key: "dashboard" },
  { title: "Post a Job", url: "/dashboard/post-job", key: "post-job" },
  { title: "Find Fundis", url: "/dashboard/find-workers", key: "find-workers" },
  { title: "My Bookings", url: "/dashboard/bookings", key: "bookings" },
  { title: "Payments", url: "/dashboard/payments", key: "payments" },
  { title: "Community", url: "/dashboard/community", key: "community" },
  { title: "Profile", url: "/dashboard/account", key: "account" },
  { title: "Settings", url: "/dashboard/settings", key: "settings" },
];

const roleDescription = (role: string, items: NavItem[]) => {
  const names = items.map((i) => i.title).join(", ");
  if (role === "admin") {
    return `You are signed in as Administrator. You have full control of the platform. Available modules are: ${names}. Say go to, followed by a module name to navigate. You can also say click followed by a button label, or say help.`;
  }
  if (role === "worker") {
    return `You are signed in as a Fundi, that is a service provider. You can manage your jobs, earnings, reviews and profile. Available modules are: ${names}. Say go to, followed by a module name. You can also say click followed by a button label.`;
  }
  return `You are signed in as a Client. You can post a job, find Fundis, manage your bookings and payments. Available modules are: ${names}. Say go to, followed by a module name. You can also say click followed by a button label, or say read page to hear what's on screen.`;
};

const findClickable = (label: string): HTMLElement | null => {
  const norm = label.toLowerCase().trim();
  if (!norm) return null;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, a, [role="button"], input[type="submit"], input[type="button"]'
    )
  );
  // exact aria-label or text match first
  let el = candidates.find((c) => (c.getAttribute("aria-label") || "").toLowerCase().trim() === norm);
  if (el) return el;
  el = candidates.find((c) => (c.innerText || "").toLowerCase().trim() === norm);
  if (el) return el;
  // contains
  el = candidates.find((c) => (c.innerText || "").toLowerCase().includes(norm));
  if (el) return el;
  el = candidates.find((c) => (c.getAttribute("aria-label") || "").toLowerCase().includes(norm));
  return el || null;
};

const readPage = () => {
  const main = document.querySelector("main") || document.body;
  const text = (main as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 800);
  speak(`Page content: ${text}`);
};

export const VoiceAssistant = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const greetedRef = useRef(false);

  const navItems: NavItem[] =
    user?.role === "admin" ? adminNav : user?.role === "worker" ? workerNav : customerNav;

  // Auto-greet after voice login redirected here
  useEffect(() => {
    if (!user) return;
    const shouldGreet = sessionStorage.getItem("voice_assistant_greet") === "1";
    if (shouldGreet && !greetedRef.current) {
      greetedRef.current = true;
      sessionStorage.removeItem("voice_assistant_greet");
      setEnabled(true);
      const intro = `Welcome ${user.name || ""}. ${roleDescription(user.role, navItems)} Tap the microphone or say a command when you're ready.`;
      // small delay so the dashboard mounts first
      setTimeout(() => speak(intro), 600);
    }
  }, [user, navItems]);

  const handleCommand = async (raw: string) => {
    const cmd = raw.toLowerCase().trim();
    if (!cmd) return;

    // Stop / cancel
    if (/^(stop|cancel|quiet|silence)/.test(cmd)) {
      stopSpeaking();
      speak("Okay.");
      return;
    }
    // Help / what can I do
    if (/help|what can i (do|say)|options|menu/.test(cmd)) {
      speak(roleDescription(user?.role || "customer", navItems));
      return;
    }
    // Read current page
    if (/read (page|screen|this)/.test(cmd)) {
      readPage();
      return;
    }
    // Logout
    if (/log ?out|sign ?out/.test(cmd)) {
      speak("Signing you out.");
      await logout();
      navigate("/auth", { replace: true });
      return;
    }
    // Where am I
    if (/where am i|current page/.test(cmd)) {
      const here = navItems.find((n) => n.url === location.pathname);
      speak(`You are on ${here?.title || "the dashboard"}.`);
      return;
    }
    // Navigation: "go to X" / "open X" / "navigate to X"
    const navMatch = cmd.match(/(?:go to|open|navigate to|show me|take me to)\s+(.+)/);
    if (navMatch) {
      const target = navMatch[1].replace(/[.?!]$/, "").trim();
      const item = navItems.find(
        (n) =>
          n.title.toLowerCase() === target ||
          n.title.toLowerCase().includes(target) ||
          target.includes(n.title.toLowerCase()) ||
          n.key.replace(/-/g, " ") === target
      );
      if (item) {
        navigate(item.url);
        speak(`Opening ${item.title}.`);
        return;
      }
      speak(`I couldn't find a module called ${target}. Say help to hear available modules.`);
      return;
    }
    // Click: "click X" / "press X" / "tap X" / "select X"
    const clickMatch = cmd.match(/(?:click|press|tap|select|choose)\s+(.+)/);
    if (clickMatch) {
      const label = clickMatch[1].replace(/[.?!]$/, "").trim();
      const el = findClickable(label);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.click();
        speak(`Clicked ${label}.`);
        return;
      }
      speak(`I couldn't find a button labelled ${label} on this page.`);
      return;
    }
    // Type into focused input: "type X" / "enter X"
    const typeMatch = cmd.match(/(?:type|enter|fill|write)\s+(.+)/);
    if (typeMatch) {
      const text = typeMatch[1];
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        speak("Typed.");
        return;
      }
      speak("Please tap a text field first, then say type followed by your text.");
      return;
    }

    speak(`I didn't understand: ${raw}. Say help to hear what I can do.`);
  };

  const startListening = async () => {
    if (!isSpeechRecognitionSupported()) {
      speak("Voice recognition is not supported in this browser. Use Chrome or Edge.");
      return;
    }
    setListening(true);
    try {
      const text = await listenOnce({ timeoutMs: 8000 });
      await handleCommand(text);
    } catch (e: any) {
      speak(e?.message || "I didn't catch that.");
    } finally {
      setListening(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {enabled && (
        <Button
          size="lg"
          onClick={listening ? () => { stopSpeaking(); setListening(false); } : startListening}
          className={`rounded-full h-14 w-14 p-0 shadow-lg ${listening ? "animate-pulse" : ""}`}
          aria-label={listening ? "Stop listening" : "Voice command"}
        >
          {listening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>
      )}
      <Button
        size="sm"
        variant={enabled ? "default" : "outline"}
        onClick={() => {
          const next = !enabled;
          setEnabled(next);
          if (next) {
            speak(roleDescription(user.role, navItems));
          } else {
            stopSpeaking();
          }
        }}
        className="gap-2 rounded-full shadow"
        aria-label={enabled ? "Disable voice assistant" : "Enable voice assistant"}
      >
        {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        <span className="text-xs">{enabled ? "Voice on" : "Voice assistant"}</span>
      </Button>
    </div>
  );
};

export default VoiceAssistant;
