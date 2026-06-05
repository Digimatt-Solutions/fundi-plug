import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  isSpeechRecognitionSupported,
  listenOnce,
  speak,
  stopSpeaking,
} from "@/lib/voice";
import { friendlyError } from "@/lib/friendlyError";

type NavItem = { title: string; url: string; key: string; purpose: string };

const adminNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", key: "dashboard", purpose: "your control centre showing overall platform metrics, recent activity and quick links." },
  { title: "Verification", url: "/dashboard/verification", key: "verification", purpose: "where you review and approve fundi onboarding documents and identities." },
  { title: "Jobs", url: "/dashboard/jobs", key: "jobs", purpose: "the full list of jobs posted on the platform so you can monitor or moderate them." },
  { title: "Categories", url: "/dashboard/categories", key: "categories", purpose: "manage service categories and skills that fundis and clients select from." },
  { title: "Payments", url: "/dashboard/payments", key: "payments", purpose: "track every customer payment, commission and refund processed by the platform." },
  { title: "Disbursements", url: "/dashboard/disbursements", key: "disbursements", purpose: "approve fundi withdrawal requests and record the M-Pesa codes you send." },
  { title: "Community", url: "/dashboard/community", key: "community", purpose: "post announcements, blogs and moderate the social feed for all users." },
  { title: "Reports", url: "/dashboard/reports", key: "reports", purpose: "view and export analytics on jobs, revenue, fundis and disbursements." },
  { title: "Activity Logs", url: "/dashboard/activity", key: "activity", purpose: "the full audit trail of every action taken on the platform." },
  { title: "User Management", url: "/dashboard/user-management", key: "user-management", purpose: "create, suspend or delete clients, fundis, suppliers and other admins." },
  { title: "Profile", url: "/dashboard/account", key: "account", purpose: "update your own admin name, photo and contact information." },
  { title: "Settings", url: "/dashboard/settings", key: "settings", purpose: "configure platform-wide options such as commission, modules and integrations." },
];
const workerNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", key: "dashboard", purpose: "your home screen showing earnings, ratings and new job opportunities." },
  { title: "My Jobs", url: "/dashboard/my-jobs", key: "my-jobs", purpose: "browse the job board, filter by your categories and apply to clients." },
  { title: "Profile", url: "/dashboard/profile", key: "profile", purpose: "edit your skills, hourly rate, documents and verification details." },
  { title: "Earnings", url: "/dashboard/earnings", key: "earnings", purpose: "see your balance, completed jobs and request withdrawals to M-Pesa." },
  { title: "Reviews", url: "/dashboard/reviews", key: "reviews", purpose: "read what clients have said about your past work." },
  { title: "Payments", url: "/dashboard/payments", key: "payments", purpose: "track payments clients have made for jobs you completed." },
  { title: "Community", url: "/dashboard/community", key: "community", purpose: "join the social feed, share updates and learn from other fundis." },
  { title: "Settings", url: "/dashboard/settings", key: "settings", purpose: "manage notifications, language and account preferences." },
];
const customerNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", key: "dashboard", purpose: "your home screen with quick actions, nearby fundis and recent bookings." },
  { title: "Post a Job", url: "/dashboard/post-job", key: "post-job", purpose: "create a new job, add photos, set a budget and let fundis apply." },
  { title: "Find Fundis", url: "/dashboard/find-workers", key: "find-workers", purpose: "search verified fundis by skill or location and hire them directly." },
  { title: "My Bookings", url: "/dashboard/bookings", key: "bookings", purpose: "view, manage and complete the jobs you've already booked." },
  { title: "Payments", url: "/dashboard/payments", key: "payments", purpose: "see your payment history, receipts and pending charges." },
  { title: "Community", url: "/dashboard/community", key: "community", purpose: "follow updates, tips and discussions from fundis and other clients." },
  { title: "Profile", url: "/dashboard/account", key: "account", purpose: "update your personal details, photo and saved address." },
  { title: "Settings", url: "/dashboard/settings", key: "settings", purpose: "control notifications, language and account preferences." },
];

const roleIntro = (role: string) => {
  if (role === "admin") return "You are signed in as Administrator. Here are your modules, one by one.";
  if (role === "worker") return "You are signed in as a Fundi. Here are your modules, one by one.";
  return "You are signed in as a Client. Here are your modules, one by one.";
};

// Speak each module title and its purpose with a short pause between them.
// We chain SpeechSynthesis utterances so each module is read completely before
// the next one starts.
const speakModulesWithPurpose = (role: string, items: NavItem[]) => {
  const lines = [
    roleIntro(role),
    ...items.map((i, idx) => `Module ${idx + 1}: ${i.title}. ${i.purpose}`),
    `That's ${items.length} modules in total. Say "go to" followed by a module name to open it, or say "help" at any time.`,
  ];
  const playNext = (i: number) => {
    if (i >= lines.length) return;
    speak(lines[i], { onEnd: () => setTimeout(() => playNext(i + 1), 350) });
  };
  playNext(0);
};

const roleDescription = (role: string, items: NavItem[]) => {
  const names = items.map((i) => i.title).join(", ");
  if (role === "admin") return `You are signed in as Administrator. Available modules are: ${names}.`;
  if (role === "worker") return `You are signed in as a Fundi. Modules: ${names}.`;
  return `You are signed in as a Client. Modules: ${names}.`;
};

const findClickable = (label: string): HTMLElement | null => {
  const norm = label.toLowerCase().trim();
  if (!norm) return null;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, a, [role="button"], input[type="submit"], input[type="button"]'
    )
  );
  let el = candidates.find((c) => (c.getAttribute("aria-label") || "").toLowerCase().trim() === norm);
  if (el) return el;
  el = candidates.find((c) => (c.innerText || "").toLowerCase().trim() === norm);
  if (el) return el;
  el = candidates.find((c) => (c.innerText || "").toLowerCase().includes(norm));
  if (el) return el;
  el = candidates.find((c) => (c.getAttribute("aria-label") || "").toLowerCase().includes(norm));
  return el || null;
};

// Structured page reading: H1, then each H2/H3 with a short snippet.
const readPageStructured = () => {
  const main = (document.querySelector("main") || document.body) as HTMLElement;
  const h1 = main.querySelector("h1")?.innerText?.trim();
  const sections = Array.from(main.querySelectorAll<HTMLElement>("h2, h3"));
  const parts: string[] = [];
  if (h1) parts.push(`Page title: ${h1}.`);
  if (sections.length === 0) {
    const text = main.innerText.replace(/\s+/g, " ").slice(0, 500);
    parts.push(text);
  } else {
    parts.push(`There are ${sections.length} sections.`);
    sections.slice(0, 8).forEach((s, i) => {
      const title = s.innerText.trim();
      // Get the first paragraph or text node sibling
      let snippet = "";
      let next = s.nextElementSibling as HTMLElement | null;
      while (next && !/^H[1-6]$/.test(next.tagName) && snippet.length < 120) {
        const t = (next.innerText || "").replace(/\s+/g, " ").trim();
        if (t) snippet += (snippet ? " " : "") + t;
        next = next.nextElementSibling as HTMLElement | null;
      }
      parts.push(`Section ${i + 1}: ${title}.${snippet ? " " + snippet.slice(0, 120) : ""}`);
    });
  }
  // Buttons summary
  const buttons = Array.from(main.querySelectorAll<HTMLElement>("button, a"))
    .map((b) => b.innerText.trim()).filter((t) => t && t.length < 40);
  const unique = Array.from(new Set(buttons)).slice(0, 6);
  if (unique.length) parts.push(`Available actions include: ${unique.join(", ")}.`);
  speak(parts.join(" "));
};

// Voice-driven post a job (client). Walks through Title, Description, Budget then submits.
async function voicePostJob(userId: string, ask: (q: string) => Promise<string>) {
  speak("Let's post a job. What's the title?");
  const title = await ask("Title");
  if (!title) { speak("Cancelled."); return; }
  speak("Briefly describe the work.");
  const description = await ask("Description");
  speak("What is your budget in shillings? Say a number.");
  const budgetRaw = await ask("Budget");
  const budget = Number((budgetRaw || "").replace(/[^\d.]/g, ""));
  if (!budget) { speak("I couldn't get a valid budget. Job not created."); return; }

  const { data, error } = await supabase.from("jobs").insert({
    title, description: description || title, budget,
    customer_id: userId, status: "pending", is_instant: false,
  }).select().single();

  if (error) { speak(`Failed to create job: ${error.message}`); return; }
  speak(`Job posted successfully. Title: ${title}, budget ${budget} shillings. Fundis will be notified.`);
}

// Voice review of received applications (for clients) or sent applications (for workers)
async function voiceReviewApplications(userId: string, role: string) {
  if (role === "worker") {
    const { data: apps } = await supabase
      .from("job_applications")
      .select("id, status, proposed_rate, jobs(title)")
      .eq("worker_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!apps?.length) { speak("You have no applications yet."); return; }
    const summary = apps.map((a: any, i: number) =>
      `${i + 1}. ${a.jobs?.title || "Job"} — status ${a.status}${a.proposed_rate ? `, your rate ${a.proposed_rate} shillings` : ""}.`
    ).join(" ");
    speak(`Your last ${apps.length} applications: ${summary}`);
    return;
  }
  // Client: applications received on their jobs
  const { data: jobs } = await supabase.from("jobs").select("id, title").eq("customer_id", userId);
  const jobIds = (jobs || []).map((j: any) => j.id);
  if (!jobIds.length) { speak("You haven't posted any jobs yet."); return; }
  const { data: apps } = await supabase
    .from("job_applications")
    .select("id, status, proposed_rate, cover_note, worker_id, job_id, profiles:worker_id(name)")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false })
    .limit(8);
  if (!apps?.length) { speak("No applications received yet on your jobs."); return; }
  const titleMap = new Map((jobs || []).map((j: any) => [j.id, j.title]));
  const summary = apps.map((a: any, i: number) =>
    `${i + 1}. ${(a.profiles as any)?.name || "A fundi"} applied to ${titleMap.get(a.job_id) || "your job"}, status ${a.status}${a.proposed_rate ? `, proposed ${a.proposed_rate} shillings` : ""}.`
  ).join(" ");
  speak(`You have ${apps.length} application${apps.length === 1 ? "" : "s"}. ${summary} Say "go to my bookings" to manage them.`);
}

export const VoiceAssistant = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [enabled, setEnabled] = useState(true);
  const [minimized, setMinimized] = useState(true); // closed by default; user clicks icon to open
  const [listening, setListening] = useState(false);
  const greetedRef = useRef(false);

  const navItems: NavItem[] =
    user?.role === "admin" ? adminNav : user?.role === "worker" ? workerNav : customerNav;

  useEffect(() => {
    if (!user) return;
    const shouldGreet = sessionStorage.getItem("voice_assistant_greet") === "1";
    if (shouldGreet && !greetedRef.current) {
      greetedRef.current = true;
      sessionStorage.removeItem("voice_assistant_greet");
      const intro = `Welcome ${user.name || ""}. ${roleDescription(user.role, navItems)}`;
      setTimeout(() => speak(intro), 600);
    }
  }, [user, navItems]);

  const askOnce = async (_label: string): Promise<string> => {
    setListening(true);
    try {
      const text = await listenOnce({ timeoutMs: 10000 });
      return text;
    } catch {
      return "";
    } finally {
      setListening(false);
    }
  };

  const handleCommand = async (raw: string) => {
    const cmd = raw.toLowerCase().trim();
    if (!cmd) return;

    if (/^(stop|cancel|quiet|silence)/.test(cmd)) { stopSpeaking(); speak("Okay."); return; }
    if (/help|what can i (do|say)|options|menu/.test(cmd)) { speak(roleDescription(user?.role || "customer", navItems)); return; }
    if (/read (page|screen|this)|summari[sz]e/.test(cmd)) { readPageStructured(); return; }
    if (/log ?out|sign ?out/.test(cmd)) { speak("Signing you out."); await logout(); navigate("/auth", { replace: true }); return; }
    if (/where am i|current page/.test(cmd)) {
      const here = navItems.find((n) => n.url === location.pathname);
      speak(`You are on ${here?.title || "the dashboard"}.`); return;
    }

    // Post a job (client only)
    if (/(post|create|add|new) (a )?job/.test(cmd)) {
      if (user?.role !== "customer") { speak("Only clients can post jobs."); return; }
      await voicePostJob(user.id, askOnce);
      return;
    }
    // Review applications
    if (/(review|check|show) (my )?applications?/.test(cmd) || /applications?$/.test(cmd)) {
      if (!user) return;
      await voiceReviewApplications(user.id, user.role);
      return;
    }
    // Find fundis
    if (/find (a )?(fundi|worker|fundis|workers)/.test(cmd)) {
      navigate("/dashboard/find-workers"); speak("Opening Find Fundis."); return;
    }

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
      if (item) { navigate(item.url); speak(`Opening ${item.title}.`); return; }
      speak(`I couldn't find a module called ${target}. Say help to hear available modules.`); return;
    }

    const clickMatch = cmd.match(/(?:click|press|tap|select|choose)\s+(.+)/);
    if (clickMatch) {
      const label = clickMatch[1].replace(/[.?!]$/, "").trim();
      const el = findClickable(label);
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.click(); speak(`Clicked ${label}.`); return; }
      speak(`I couldn't find a button labelled ${label} on this page.`); return;
    }

    const typeMatch = cmd.match(/(?:type|enter|fill|write)\s+(.+)/);
    if (typeMatch) {
      const text = typeMatch[1];
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        speak("Typed."); return;
      }
      speak("Please tap a text field first, then say type followed by your text."); return;
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

  // Minimized: just a small floating mic icon, click to expand
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="icon"
          variant="default"
          onClick={() => setMinimized(false)}
          className="rounded-full h-10 w-10 shadow-lg"
          aria-label="Expand voice assistant"
        >
          <Mic className="w-4 h-4" />
        </Button>
      </div>
    );
  }

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
      <div className="relative">
        <Button
          size="sm"
          variant={enabled ? "default" : "outline"}
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            if (next) speak(roleDescription(user.role, navItems));
            else stopSpeaking();
          }}
          className="gap-2 rounded-full shadow pr-7"
          aria-label={enabled ? "Disable voice assistant" : "Enable voice assistant"}
        >
          {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="text-xs">{enabled ? "Voice on" : "Voice assistant"}</span>
        </Button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); stopSpeaking(); setMinimized(true); }}
          aria-label="Minimize voice assistant"
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center shadow"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default VoiceAssistant;
