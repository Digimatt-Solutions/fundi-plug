/**
 * Storage URL helpers — every Lovable Cloud bucket is private and requires
 * a signed URL for reads. This module turns either a raw storage path
 * (e.g. "userId/file.jpg") or a legacy public URL into a fresh signed URL.
 *
 * Stored values in the database may now be one of:
 *   - bare path:           "abc/123.jpg"                              (preferred for new uploads)
 *   - signed URL:          ".../object/sign/<bucket>/<path>?token=…"  (long-TTL uploads)
 *   - legacy public URL:   ".../object/public/<bucket>/<path>"        (pre-private rows)
 *
 * resolveAssetUrl/useSignedUrl normalize all three.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Cached = { url: string; exp: number };
const cache = new Map<string, Cached>();

const RECOGNISED_BUCKETS = new Set([
  "avatars",
  "category-images",
  "job-images",
  "community-images",
  "portfolio",
  "chat-attachments",
  "business-assets",
  "product-images",
  "certifications",
  "verification-docs",
]);

export function parseStorageUrl(input: string): { bucket: string; path: string } | null {
  const m = input.match(/\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/**
 * Get a fresh signed URL for an asset. Accepts a stored path OR a stored URL.
 * If a bucket is required (raw path), supply it via `fallbackBucket`.
 */
export async function resolveAssetUrl(
  input: string | null | undefined,
  fallbackBucket?: string,
  ttl = 3600
): Promise<string | null> {
  if (!input) return null;
  // External URLs (https but not our storage) → return as-is.
  if (/^https?:\/\//i.test(input)) {
    const parsed = parseStorageUrl(input);
    if (!parsed) return input;
    return signAndCache(parsed.bucket, parsed.path, ttl, input);
  }
  // Looks like a raw path
  if (!fallbackBucket) return input;
  return signAndCache(fallbackBucket, input, ttl, input);
}

async function signAndCache(bucket: string, path: string, ttl: number, original: string): Promise<string> {
  if (!RECOGNISED_BUCKETS.has(bucket)) return original;
  const key = `${bucket}/${path}`;
  const now = Date.now() / 1000;
  const hit = cache.get(key);
  if (hit && hit.exp - now > 60) return hit.url;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (!data?.signedUrl) return original;
  cache.set(key, { url: data.signedUrl, exp: now + ttl });
  return data.signedUrl;
}

/** React hook — re-signs on input change. Returns null while resolving the first time. */
export function useSignedUrl(input: string | null | undefined, fallbackBucket?: string, ttl = 3600): string | null {
  const [url, setUrl] = useState<string | null>(() => (input && /^https?:\/\//i.test(input) ? input : null));
  useEffect(() => {
    let active = true;
    if (!input) { setUrl(null); return; }
    resolveAssetUrl(input, fallbackBucket, ttl).then((r) => { if (active) setUrl(r); });
    return () => { active = false; };
  }, [input, fallbackBucket, ttl]);
  return url;
}

/** Resolve an array of stored values to signed URLs (preserves order, falsy entries become null). */
export function useSignedUrls(inputs: (string | null | undefined)[], fallbackBucket?: string, ttl = 3600): (string | null)[] {
  const key = inputs.join("|");
  const [urls, setUrls] = useState<(string | null)[]>(() => inputs.map(() => null));
  useEffect(() => {
    let active = true;
    Promise.all(inputs.map((i) => resolveAssetUrl(i, fallbackBucket, ttl))).then((res) => {
      if (active) setUrls(res);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallbackBucket, ttl]);
  return urls;
}

/**
 * Upload a file and return a stored value that the rest of the app can render
 * via useSignedUrl / AssetImage. We store a long-TTL signed URL so legacy
 * `<img src>` paths keep working even before a component is migrated.
 */
export async function uploadAndGetStoredValue(
  bucket: string,
  path: string,
  file: File | Blob,
  options: { upsert?: boolean; contentType?: string } = {}
): Promise<{ stored: string; path: string } | { error: string }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: options.upsert ?? false,
    contentType: options.contentType ?? (file as any).type,
  });
  if (error) return { error: error.message };
  // 1 year signed URL — re-signs at render via the helper anyway.
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return { stored: data?.signedUrl || path, path };
}
