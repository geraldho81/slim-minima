import { createHmac, timingSafeEqual } from "crypto";

/**
 * Server-only by use (called from the contact-form block's getData and the
 * /api/contact route). We avoid the `server-only` import guard because this
 * module is reached through the block registry, which is also traced into the
 * editor's client bundle; the guard would break that build.
 *
 * The contact-form receiver email is configured by the site owner in the
 * editor, but the value travels to the browser and back, so we must never
 * trust a receiver sent from the client (that would be an open email relay).
 *
 * Instead the block signs the receiver server-side with AUTH_SECRET and ships
 * an opaque token. The browser posts the token back; /api/contact verifies it
 * and recovers the address. An attacker cannot forge a token for an arbitrary
 * recipient, so the form can only ever email the address the owner set.
 */
function key(): string {
  const secret = process.env.AUTH_SECRET;
  // Fail closed: signing with an empty/weak key would let anyone forge a
  // receiver token and turn the contact form into an open email relay.
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set (at least 16 characters) to sign contact-form tokens.");
  }
  return secret;
}

export function signReceiver(email: string): string {
  const e = email.trim();
  if (!e) return "";
  const payload = Buffer.from(e).toString("base64url");
  const sig = createHmac("sha256", key()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyReceiver(token: string): string | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", key()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
