// Lightweight wrappers around the browser Web Speech API.
// Provides text-to-speech (speak) and speech-to-text (listenOnce).

type SR = any;

export const isSpeechRecognitionSupported = () =>
  typeof window !== "undefined" &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export const isSpeechSynthesisSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

// Pick the best available voice, preferring African English (en-ZA, en-NG, en-KE),
// then other English locales. Cached after first lookup.
let _selectedVoice: SpeechSynthesisVoice | null = null;
let _voicesLoaded = false;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const prefer = ["en-ZA", "en-NG", "en-KE", "en-GH", "en-ZW"];
  for (const lang of prefer) {
    const v = voices.find((x) => x.lang?.toLowerCase() === lang.toLowerCase());
    if (v) return v;
  }
  // Try "African" in name
  const named = voices.find((v) => /africa|south\s*african|nigeri|kenya|ghan/i.test(v.name));
  if (named) return named;
  // Fall back to en-GB then en-US then any English
  return (
    voices.find((v) => v.lang === "en-GB") ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang?.startsWith("en")) ||
    voices[0] ||
    null
  );
}

function ensureVoice(): SpeechSynthesisVoice | null {
  if (_selectedVoice) return _selectedVoice;
  _selectedVoice = pickVoice();
  if (!_voicesLoaded && isSpeechSynthesisSupported()) {
    _voicesLoaded = true;
    window.speechSynthesis.onvoiceschanged = () => { _selectedVoice = pickVoice(); };
  }
  return _selectedVoice;
}

export function speak(text: string, opts?: { rate?: number; pitch?: number; onEnd?: () => void }) {
  if (!isSpeechSynthesisSupported()) {
    opts?.onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = ensureVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = opts?.rate ?? 1;
    u.pitch = opts?.pitch ?? 1;
    u.onend = () => opts?.onEnd?.();
    u.onerror = () => opts?.onEnd?.();
    window.speechSynthesis.speak(u);
  } catch {
    opts?.onEnd?.();
  }
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
}

export function listenOnce(opts?: { lang?: string; timeoutMs?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return reject(new Error("Speech recognition not supported in this browser. Use Chrome or Edge."));
    const rec: SR = new SR();
    rec.lang = opts?.lang || "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; try { rec.stop(); } catch {} reject(new Error("Listening timed out")); }
    }, opts?.timeoutMs || 8000);
    rec.onresult = (e: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      resolve(transcript.trim());
    };
    rec.onerror = (e: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(e.error || "Recognition error"));
    };
    rec.onend = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error("No speech detected"));
    };
    try { rec.start(); } catch (err: any) { reject(err); }
  });
}

// Parse spoken email: handles "john at gmail dot com", "j o h n at ..."
export function parseSpokenEmail(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/\s+at\s+/g, "@");
  s = s.replace(/\s+dot\s+/g, ".");
  s = s.replace(/\s+underscore\s+/g, "_");
  s = s.replace(/\s+dash\s+/g, "-");
  s = s.replace(/\s+hyphen\s+/g, "-");
  s = s.replace(/\s+/g, "");
  return s;
}

// Parse spoken password: remove spaces, allow "number 5" -> "5"
export function parseSpokenPassword(raw: string): string {
  const words: Record<string, string> = {
    zero: "0", one: "1", two: "2", three: "3", four: "4",
    five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  };
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => words[w] ?? w)
    .join("")
    .trim();
}
