/**
 * Lightweight in-process rate limiter (fixed window) for abuse-prone endpoints
 * like login and the public contact form. No external store, so limits are
 * per-instance; Vercel's Fluid Compute reuses instances, which makes this
 * effective in practice. For hardened, distributed limiting at scale, put
 * Vercel Firewall / BotID in front of these routes.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded.
  if (windows.size > 5000) {
    for (const [k, w] of windows) if (now > w.resetAt) windows.delete(k);
  }

  const w = windows.get(key);
  if (!w || now > w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (w.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
  }
  w.count++;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers. Falls back to a shared bucket. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
