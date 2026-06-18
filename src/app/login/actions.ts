"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function loginAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const ip = clientIp(await headers());
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  // Throttle by IP and by targeted account to blunt brute-force / credential stuffing.
  const byIp = rateLimit(`login:ip:${ip}`, 10, 10 * 60 * 1000);
  const byEmail = rateLimit(`login:email:${email}`, 5, 10 * 60 * 1000);
  if (!byIp.ok || !byEmail.ok) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) return "Invalid email or password.";
    throw error;
  }
}
