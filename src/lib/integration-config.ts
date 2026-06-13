import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

/**
 * Optional integrations resolve their config from environment variables first,
 * then from values saved in the CMS settings. This lets a site be deployed
 * with only DATABASE_URL + AUTH_SECRET and have everything else (email,
 * media options, ...) filled in later from inside the admin.
 */

export const RESEND_KEYS = { apiKey: "resendApiKey", from: "emailFrom", to: "emailTo" } as const;
export const MEDIA_KEYS = { folder: "cloudinaryFolder", trashTtl: "mediaTrashTtlDays" } as const;

async function readSettings(keys: readonly string[]): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(settings).where(inArray(settings.key, [...keys]));
    return Object.fromEntries(rows.map((r) => [r.key, typeof r.value === "string" ? r.value.trim() : ""]));
  } catch {
    return {};
  }
}

export async function getResendConfig(): Promise<{ apiKey: string; from: string; to: string }> {
  const s = await readSettings(Object.values(RESEND_KEYS));
  return {
    apiKey: process.env.RESEND_API_KEY || s[RESEND_KEYS.apiKey] || "",
    from: process.env.EMAIL_FROM || s[RESEND_KEYS.from] || "",
    to: process.env.EMAIL_TO || s[RESEND_KEYS.to] || "",
  };
}

export async function getCloudinaryFolder(): Promise<string> {
  if (process.env.CLOUDINARY_FOLDER) return process.env.CLOUDINARY_FOLDER;
  const s = await readSettings([MEDIA_KEYS.folder]);
  return s[MEDIA_KEYS.folder] || "slim-minima";
}

export async function getMediaTrashTtlDays(): Promise<number> {
  if (process.env.MEDIA_TRASH_TTL_DAYS) return Number(process.env.MEDIA_TRASH_TTL_DAYS) || 30;
  const s = await readSettings([MEDIA_KEYS.trashTtl]);
  return Number(s[MEDIA_KEYS.trashTtl]) || 30;
}
