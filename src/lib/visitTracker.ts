// Lightweight client-side visit tracker. Records one visit per session per path.
import { supabase } from "@/integrations/supabase/client";

function detectDevice(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
  return "Desktop";
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/MSIE|Trident/i.test(ua)) return "Internet Explorer";
  return "Other";
}

function detectOS(ua: string): string {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iOS/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

let geoCache: { country?: string; city?: string } | null = null;

async function getGeo(): Promise<{ country?: string; city?: string }> {
  if (geoCache) return geoCache;
  try {
    const cached = sessionStorage.getItem("visit_geo");
    if (cached) { geoCache = JSON.parse(cached); return geoCache!; }
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) return {};
    const j = await res.json();
    geoCache = { country: j.country_name || j.country, city: j.city };
    sessionStorage.setItem("visit_geo", JSON.stringify(geoCache));
    return geoCache;
  } catch {
    return {};
  }
}

export async function trackVisit(path: string) {
  try {
    // De-dupe per session per path
    const sessionKey = `visit_${path}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    const ua = navigator.userAgent;
    const geo = await getGeo();
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("site_visits").insert({
      user_id: auth?.user?.id || null,
      path,
      device: detectDevice(ua),
      browser: detectBrowser(ua),
      os: detectOS(ua),
      country: geo.country || null,
      city: geo.city || null,
      referrer: document.referrer || null,
      user_agent: ua,
    });
  } catch {
    // silent
  }
}
