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

  // Prefer the clearest, most audible neural/premium English voices.
  const preferredNames = [
    /Google US English/i,
    /Google UK English Female/i,
    /Google UK English Male/i,
    /Microsoft Aria/i,
    /Microsoft Jenny/i,
    /Microsoft Guy/i,
    /Microsoft Davis/i,
    /Samantha/i, // Apple - very clear
    /Daniel/i,   // Apple en-GB
  ];
  for (const re of preferredNames) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  // Fall back to en-US / en-GB then any English
  return (
    voices.find((v) => v.lang === "en-US" && /female|google|microsoft/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang === "en-GB") ||
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

// Parse a spoken password where the user spells out each character: letters
// (e.g. "capital a", "alpha", "bravo"), digits ("one", "five"), and special
// characters ("at", "hash", "dollar", "exclamation", "underscore", etc.).
// Each spoken token becomes exactly one character of the password.
export function parseSpokenPassword(raw: string): string {
  const numberWords: Record<string, string> = {
    zero: "0", oh: "0", o: "0",
    one: "1", two: "2", to: "2", too: "2", three: "3", four: "4", for: "4",
    five: "5", six: "6", seven: "7", eight: "8", ate: "8", nine: "9",
  };
  // NATO phonetic + common alternates -> letter
  const phonetic: Record<string, string> = {
    alpha: "a", apple: "a",
    bravo: "b", boy: "b",
    charlie: "c", cat: "c",
    delta: "d", dog: "d",
    echo: "e", easy: "e",
    foxtrot: "f", fox: "f", frank: "f",
    golf: "g", george: "g",
    hotel: "h", henry: "h",
    india: "i", igloo: "i",
    juliet: "j", juliette: "j", john: "j",
    kilo: "k", king: "k",
    lima: "l", love: "l",
    mike: "m", mary: "m",
    november: "n", nancy: "n",
    oscar: "o",
    papa: "p", peter: "p",
    quebec: "q", queen: "q",
    romeo: "r", robert: "r",
    sierra: "s", sam: "s",
    tango: "t", tom: "t",
    uniform: "u", uncle: "u",
    victor: "v",
    whiskey: "w", william: "w",
    xray: "x", "x-ray": "x",
    yankee: "y", yellow: "y",
    zulu: "z", zebra: "z",
  };
  // Special characters - words -> symbol
  const specials: Record<string, string> = {
    space: " ",
    dot: ".", point: ".", period: ".", "full-stop": ".", fullstop: ".",
    comma: ",",
    at: "@", "at-sign": "@",
    hash: "#", hashtag: "#", pound: "#",
    dollar: "$", "dollar-sign": "$",
    percent: "%",
    ampersand: "&", and: "&",
    asterisk: "*", star: "*",
    dash: "-", hyphen: "-", minus: "-",
    underscore: "_", "under-score": "_",
    plus: "+",
    equal: "=", equals: "=",
    slash: "/", "forward-slash": "/",
    backslash: "\\",
    colon: ":",
    semicolon: ";",
    exclamation: "!", bang: "!", "exclamation-mark": "!",
    question: "?", "question-mark": "?",
    quote: "\"", quotes: "\"", doublequote: "\"",
    apostrophe: "'", singlequote: "'",
    tilde: "~",
    caret: "^", hat: "^",
    pipe: "|", bar: "|",
    "open-bracket": "(", openparen: "(", "open-paren": "(",
    "close-bracket": ")", closeparen: ")", "close-paren": ")",
    "open-square": "[", "close-square": "]",
    "open-curly": "{", "close-curly": "}",
    "less-than": "<", "greater-than": ">",
  };

  // Tokenise: split on whitespace; also split runs of digits into individual
  // characters ("123" -> ["1","2","3"]). Keep hyphenated words ("x-ray") intact.
  const tokens: string[] = raw
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .flatMap((w) => (/^\d+$/.test(w) ? w.split("") : [w]));

  const out: string[] = [];
  let capitalNext = false;

  for (let raw of tokens) {
    if (!raw) continue;
    // Strip trailing punctuation the recogniser sometimes adds.
    const tok = raw.replace(/[.,!?]+$/g, "");
    if (!tok) continue;

    if (tok === "capital" || tok === "uppercase" || tok === "caps") { capitalNext = true; continue; }
    if (tok === "lowercase" || tok === "small") { capitalNext = false; continue; }

    let ch: string | null = null;
    if (numberWords[tok] !== undefined) ch = numberWords[tok];
    else if (phonetic[tok] !== undefined) ch = phonetic[tok];
    else if (specials[tok] !== undefined) ch = specials[tok];
    else if (/^[a-z]$/.test(tok)) ch = tok;
    else if (/^[0-9]$/.test(tok)) ch = tok;
    else if (/^[!-/:-@\[-`{-~]$/.test(tok)) ch = tok; // already a symbol
    else {
      // Fallback: treat as literal characters (no spaces).
      ch = tok;
    }

    if (ch && capitalNext && /^[a-z]$/.test(ch)) { ch = ch.toUpperCase(); capitalNext = false; }
    out.push(ch);
  }
  return out.join("");
}
