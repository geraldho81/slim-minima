import { lt } from "drizzle-orm";
import { db } from "@/db";
import { pages, posts } from "@/db/schema";

const TRASH_RETENTION_DAYS = 30;

/**
 * Lazy purge: permanently delete anything that has sat in the trash longer than
 * the retention window. Called when an admin list loads, so old soft-deletes
 * clear themselves without a cron.
 */
export async function purgeExpiredTrash(kind: "pages" | "posts") {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const table = kind === "pages" ? pages : posts;
  await db.delete(table).where(lt(table.deletedAt, cutoff));
}
