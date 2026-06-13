import { randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

/**
 * The MCP connector token. It is auto-provisioned (during seed and on first
 * Settings view) so the connector is ready with zero clicks, and it lives in
 * the settings table alongside the other connected-service secrets. A marketer
 * just copies the URL and token into their AI client.
 *
 * Revoking deletes the token AND sets a "disabled" flag so it is not silently
 * re-created on the next Settings view; the connector stays off until enabled.
 */

export const MCP_TOKEN_KEY = "mcpToken";
const MCP_DISABLED_KEY = "mcpDisabled";

function newToken(): string {
  return `mcp_${randomBytes(24).toString("hex")}`;
}

export async function getMcpToken(): Promise<string | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, MCP_TOKEN_KEY)).limit(1);
  return typeof row?.value === "string" ? row.value : null;
}

export async function isMcpDisabled(): Promise<boolean> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, MCP_DISABLED_KEY)).limit(1);
  return row?.value === true;
}

/**
 * Return the active token, creating one if none exists yet. Returns null when
 * the connector has been revoked (disabled). The insert is idempotent
 * (ON CONFLICT DO NOTHING), so concurrent callers settle on a single token.
 */
export async function getOrCreateMcpToken(): Promise<string | null> {
  if (await isMcpDisabled()) return null;
  const existing = await getMcpToken();
  if (existing) return existing;
  await db
    .insert(settings)
    .values({ key: MCP_TOKEN_KEY, value: newToken() })
    .onConflictDoNothing({ target: settings.key });
  return await getMcpToken();
}

/** Rotate the token (and clear the disabled flag, so it doubles as "enable"). */
export async function regenerateMcpToken(): Promise<string> {
  const value = newToken();
  await db.delete(settings).where(eq(settings.key, MCP_DISABLED_KEY));
  await db
    .insert(settings)
    .values({ key: MCP_TOKEN_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
  return value;
}

/** Turn the connector off: delete the token and mark it disabled. */
export async function revokeMcpToken(): Promise<void> {
  await db.delete(settings).where(eq(settings.key, MCP_TOKEN_KEY));
  await db
    .insert(settings)
    .values({ key: MCP_DISABLED_KEY, value: true })
    .onConflictDoUpdate({ target: settings.key, set: { value: true } });
}

export async function verifyMcpToken(token: string): Promise<boolean> {
  if (!token) return false;
  const stored = await getMcpToken();
  if (!stored) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
