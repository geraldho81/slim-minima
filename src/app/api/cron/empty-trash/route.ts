import { NextResponse } from "next/server";
import { lt, isNotNull, and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaTrash, pages, posts } from "@/db/schema";
import { deleteCloudinaryMedia } from "@/lib/cloudinary";
import { getMediaTrashTtlDays } from "@/lib/integration-config";

// Runs daily (see crons in vercel.json). Permanently removes anything that has sat
// in the trash longer than MEDIA_TRASH_TTL_DAYS: media is deleted from
// Cloudinary, trashed pages/posts are removed from the database.
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed in production; allow only in local dev where no secret is set.
    return process.env.NODE_ENV !== "production";
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ttlDays = await getMediaTrashTtlDays();
  const cutoff = new Date(Date.now() - ttlDays * 86400000);

  // --- Media: delete the Cloudinary asset, then drop the row ---
  const expiredMedia = await db.select().from(mediaTrash).where(lt(mediaTrash.trashedAt, cutoff));
  let mediaDeleted = 0;
  for (const row of expiredMedia) {
    try {
      await deleteCloudinaryMedia(row.publicId, row.resourceType);
      await db.delete(mediaTrash).where(eq(mediaTrash.publicId, row.publicId));
      mediaDeleted++;
    } catch (err) {
      console.error(`[cron] failed to purge media ${row.publicId}`, err);
    }
  }

  // --- Pages and posts: hard-delete soft-trashed rows past the cutoff ---
  const purgedPages = await db
    .delete(pages)
    .where(and(isNotNull(pages.deletedAt), lt(pages.deletedAt, cutoff)))
    .returning({ id: pages.id });
  const purgedPosts = await db
    .delete(posts)
    .where(and(isNotNull(posts.deletedAt), lt(posts.deletedAt, cutoff)))
    .returning({ id: posts.id });

  return NextResponse.json({
    ok: true,
    ttlDays,
    mediaDeleted,
    pagesPurged: purgedPages.length,
    postsPurged: purgedPosts.length,
  });
}
