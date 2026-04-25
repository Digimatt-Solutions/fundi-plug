// Lightweight WebAuthn helpers for fingerprint passkey on phones/laptops.
// Uses platform authenticator (Touch ID, Face ID, Android fingerprint, Windows Hello).

export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined"
    && !!window.PublicKeyCredential
    && typeof navigator.credentials?.create === "function";
}

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(len = 32): Uint8Array {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return a;
}

function strToBuf(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * Register a new fingerprint passkey on this device.
 * Returns { credentialId, publicKey } as base64url strings.
 */
export async function registerFingerprint(opts: {
  userId: string;
  email: string;
  displayName: string;
}): Promise<{ credentialId: string; publicKey: string; deviceLabel: string }> {
  if (!isWebAuthnSupported()) {
    throw new Error("Fingerprint not supported on this device or browser.");
  }

  const challenge = randomBytes(32);
  const userIdBuf = strToBuf(opts.userId);
  const rpName = "FundiPlug";
  const rpId = window.location.hostname;

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: rpName, id: rpId },
    user: { id: userIdBuf, name: opts.email, displayName: opts.displayName || opts.email },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },   // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform", // built-in fingerprint sensor
      userVerification: "required",
      residentKey: "preferred",
    },
  };

  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Fingerprint registration was cancelled.");

  const att = cred.response as AuthenticatorAttestationResponse;
  const credentialId = bufToB64url(cred.rawId);
  // We don't decode CBOR; we just store raw attestationObject base64 as a placeholder.
  const publicKeyB64 = bufToB64url(att.attestationObject);

  // Try to label the device
  const ua = navigator.userAgent;
  let deviceLabel = "This device";
  if (/iPhone|iPad/i.test(ua)) deviceLabel = "iPhone / iPad";
  else if (/Android/i.test(ua)) deviceLabel = "Android phone";
  else if (/Mac/i.test(ua)) deviceLabel = "Mac (Touch ID)";
  else if (/Windows/i.test(ua)) deviceLabel = "Windows Hello";

  return { credentialId, publicKey: publicKeyB64, deviceLabel };
}

/**
 * Verify a fingerprint locally (used to confirm "test" / "check-in").
 * Resolves with the credentialId presented by the user, or throws.
 */
export async function verifyFingerprint(allowCredentialIds?: string[]): Promise<string> {
  if (!isWebAuthnSupported()) {
    throw new Error("Fingerprint not supported on this device or browser.");
  }
  const challenge = randomBytes(32);
  const rpId = window.location.hostname;

  const allow = (allowCredentialIds || []).map((id) => {
    // base64url -> buffer
    const padded = id.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (id.length % 4)) % 4);
    const bin = atob(padded);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return { type: "public-key" as const, id: buf.buffer };
  });

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId,
    timeout: 60000,
    userVerification: "required",
    allowCredentials: allow.length ? allow : undefined,
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("Fingerprint verification was cancelled.");
  return bufToB64url(assertion.rawId);
}
