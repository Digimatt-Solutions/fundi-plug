// Centralized sound manager with localStorage toggle and Web Audio fallback.
// Works on desktop + mobile + PWA. Mobile requires a user interaction before
// audio can play, so we unlock the AudioContext on first touch/click.

const STORAGE_KEY = "app_sound_enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(STORAGE_KEY);
  // Default OFF - user must opt in via Settings → Preferences
  return v === null ? false : v === "true";
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("sound-toggle", { detail: enabled }));
}

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

function unlock() {
  if (unlocked) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  // Play a 1-sample silent buffer to unlock on iOS
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
  unlocked = true;
}

export function initSoundUnlock() {
  if (typeof window === "undefined") return;
  const handler = () => {
    unlock();
    window.removeEventListener("touchstart", handler);
    window.removeEventListener("click", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("touchstart", handler, { once: false });
  window.addEventListener("click", handler, { once: false });
  window.addEventListener("keydown", handler, { once: false });
}

// Synthesized tones using Web Audio (no asset, works everywhere).
type ToneStep = { freq: number; dur: number; type?: OscillatorType; gain?: number };

function playTones(steps: ToneStep[]) {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  let t = ctx.currentTime;
  for (const s of steps) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = s.type || "sine";
    osc.frequency.setValueAtTime(s.freq, t);
    const peak = s.gain ?? 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + s.dur + 0.02);
    t += s.dur;
  }
}

// Cool, distinct sounds for each event
export function playNotificationSound() {
  // Two-tone "ping"
  playTones([
    { freq: 880, dur: 0.12, type: "sine", gain: 0.22 },
    { freq: 1320, dur: 0.18, type: "sine", gain: 0.22 },
  ]);
}

export function playSubmitSound() {
  // Quick ascending chirp for successful submission
  playTones([
    { freq: 660, dur: 0.08, type: "triangle", gain: 0.2 },
    { freq: 990, dur: 0.14, type: "triangle", gain: 0.2 },
  ]);
}

export function playLaunchSound() {
  // Soft three-note welcome chord arpeggio
  playTones([
    { freq: 523.25, dur: 0.13, type: "sine", gain: 0.15 }, // C5
    { freq: 659.25, dur: 0.13, type: "sine", gain: 0.15 }, // E5
    { freq: 783.99, dur: 0.22, type: "sine", gain: 0.18 }, // G5
  ]);
}
