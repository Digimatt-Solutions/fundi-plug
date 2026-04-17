import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSoundUnlock, playLaunchSound, isSoundEnabled } from "@/lib/sound";

initSoundUnlock();

// Play a launch chime once per page load (after first user gesture).
// We attempt immediately; if the AudioContext is suspended, the unlock
// listener will activate it on first interaction and the chime fires then.
const tryLaunch = () => {
  if (isSoundEnabled()) playLaunchSound();
};
window.addEventListener("click", tryLaunch, { once: true });
window.addEventListener("touchstart", tryLaunch, { once: true });
window.addEventListener("keydown", tryLaunch, { once: true });
// Also try immediately (works on desktop where audio is permitted)
setTimeout(tryLaunch, 400);

createRoot(document.getElementById("root")!).render(<App />);
