import { NextResponse } from "next/server";
import { db } from "@/db";
import { contactSubmissions } from "@/db/schema";
import { verifyReceiver } from "@/lib/contact-token";
import { getResendConfig } from "@/lib/integration-config";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELDS = 40;
const MAX_LEN = 5000;

export async function POST(req: Request) {
  // Throttle per IP to stop submission floods / email-cost abuse.
  const limit = rateLimit(`contact:${clientIp(req.headers)}`, 8, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot - bots fill it, humans never see it. Pretend success.
  if (typeof body.website === "string" && body.website) {
    return NextResponse.json({ ok: true });
  }

  const formName = typeof body._form === "string" ? body._form.slice(0, 200) : null;
  // Recover the receiver from the signed token only; never trust a raw address.
  const receiver = typeof body._rt === "string" ? verifyReceiver(body._rt) ?? "" : "";

  // Everything except control keys and the honeypot becomes the submission data.
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "website" || key.startsWith("_")) continue;
    if (Object.keys(data).length >= MAX_FIELDS) break;
    data[key.slice(0, 100)] = String(value ?? "").slice(0, MAX_LEN);
  }

  const email = typeof data.email === "string" ? data.email : null;
  const name = typeof data.name === "string" ? data.name : null;
  const message = typeof data.message === "string" ? data.message : null;

  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "The form was empty." }, { status: 400 });
  }

  await db.insert(contactSubmissions).values({ formName, name, email, message, data });

  await sendNotification({ formName, data, receiver }).catch((err) => {
    // The submission is already stored - never fail the request over email.
    console.error("[contact] Resend notification failed", err);
  });

  return NextResponse.json({ ok: true });
}

async function sendNotification(s: { formName: string | null; data: Record<string, string>; receiver: string }) {
  // Resend config comes from env vars or the CMS settings (env wins).
  const resend = await getResendConfig();
  const apiKey = resend.apiKey;
  if (!apiKey) return; // Resend is optional - submissions are always stored in the DB.

  const from = resend.from || "Slim Minima <onboarding@resend.dev>";
  // Per-form receiver (set in the block) takes priority, then the configured EMAIL_TO.
  const to = (s.receiver && EMAIL_RE.test(s.receiver) ? s.receiver : resend.to) || "";
  if (!to) return;

  const lines = Object.entries(s.data).map(([k, v]) => `${k}: ${v || "-"}`);
  const replyTo = s.data.email && EMAIL_RE.test(s.data.email) ? s.data.email : undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `New ${s.formName || "contact"} submission`,
      text: lines.join("\n"),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
