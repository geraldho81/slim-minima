import { z } from "zod";
import { db } from "@/db";
import { settings, menus } from "@/db/schema";
import { requireApiKey, jsonError } from "@/lib/api-auth";
import { bumpSettingsCache } from "@/lib/api-revalidate";
import type { MenuItem } from "@/db/schema";

// Secrets are stored in the same settings table (cloudinaryApiSecret,
// resendApiKey, githubUpdateToken, mcpToken, ...). They are write-only by
// design and must never be returned to an API consumer.
const SECRET_KEY_RE = /secret|token|password|apikey/i;

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const [settingRows, menuRows] = await Promise.all([db.select().from(settings), db.select().from(menus)]);
  return Response.json({
    settings: Object.fromEntries(settingRows.filter((r) => !SECRET_KEY_RE.test(r.key)).map((r) => [r.key, r.value])),
    menus: Object.fromEntries(menuRows.map((m) => [m.name, m.items])),
  });
}

const bodySchema = z.object({
  settings: z.record(z.string(), z.unknown()).optional(),
  menus: z
    .record(
      z.string(),
      z.array(z.object({ label: z.string(), href: z.string() }))
    )
    .optional(),
});

export async function PUT(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(`Invalid body: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);

  if (parsed.data.settings) {
    for (const [key, value] of Object.entries(parsed.data.settings)) {
      // Never let an API consumer read or write integration secrets.
      if (SECRET_KEY_RE.test(key)) continue;
      await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
    }
  }
  if (parsed.data.menus) {
    for (const [name, items] of Object.entries(parsed.data.menus)) {
      await db
        .insert(menus)
        .values({ name, items: items as MenuItem[] })
        .onConflictDoUpdate({ target: menus.name, set: { items: items as MenuItem[] } });
    }
  }

  bumpSettingsCache();
  return Response.json({ ok: true });
}
