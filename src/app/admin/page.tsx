import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pages, posts, media, contactSubmissions } from "@/db/schema";
import { formatDate } from "@/lib/content";
import { NewPageButton, NewPostButton } from "@/components/admin/NewContentButtons";
import { isCloudinaryConfigured } from "@/lib/cloudinary-config";
import { getResendConfig } from "@/lib/integration-config";

export default async function Dashboard() {
  const [
    [pageCount],
    [postCount],
    [mediaCount],
    [draftCount],
    [scheduledCount],
    recentDrafts,
    recentSubmissions,
    cloudinaryConnected,
    resendConfig,
  ] = await Promise.all([
    db.select({ n: count() }).from(pages).where(isNull(pages.deletedAt)),
    db.select({ n: count() }).from(posts).where(isNull(posts.deletedAt)),
    db.select({ n: count() }).from(media),
    db.select({ n: count() }).from(posts).where(and(isNull(posts.deletedAt), eq(posts.status, "draft"))),
    db.select({ n: count() }).from(posts).where(and(isNull(posts.deletedAt), eq(posts.status, "scheduled"))),
    db
      .select({ id: posts.id, title: posts.title, updatedAt: posts.updatedAt })
      .from(posts)
      .where(and(isNull(posts.deletedAt), eq(posts.status, "draft")))
      .orderBy(desc(posts.updatedAt))
      .limit(5),
    db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt)).limit(5),
    isCloudinaryConfigured(),
    getResendConfig(),
  ]);

  const stats = [
    { label: "Pages", value: pageCount.n, href: "/admin/pages" },
    { label: "Posts", value: postCount.n, href: "/admin/posts" },
    { label: "Drafts", value: draftCount.n, href: "/admin/posts?view=draft" },
    { label: "Scheduled", value: scheduledCount.n, href: "/admin/posts?view=scheduled" },
    { label: "Media", value: mediaCount.n, href: "/admin/media" },
  ];

  const connections = [
    { label: "Cloudinary", ok: cloudinaryConnected },
    { label: "Resend", ok: !!resendConfig.apiKey },
  ];

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="mb-10 flex items-end justify-between">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex gap-2">
          <NewPageButton />
          <NewPostButton />
        </div>
      </div>

      {/* Stats - a quiet inline strip, no boxes */}
      <div className="mb-9 flex flex-wrap gap-x-10 gap-y-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <div className="text-2xl font-bold tracking-tight">{s.value}</div>
            <div className="text-xs group-hover:underline" style={{ color: "var(--ad-muted)" }}>{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Connection indicators */}
      <Link href="/admin/settings" className="mb-12 flex flex-wrap items-center gap-x-6 gap-y-2">
        {connections.map((c) => (
          <span key={c.label} className="flex items-center gap-2 text-xs">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.ok ? "#16a34a" : "var(--ad-muted)" }} />
            <span className="font-semibold">{c.label}</span>
            <span style={{ color: "var(--ad-muted)" }}>{c.ok ? "Connected" : "Not connected"}</span>
          </span>
        ))}
      </Link>

      <div className="grid grid-cols-2 gap-10">
        <section>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ad-muted)" }}>
            Drafts in progress
          </h2>
          {recentDrafts.length === 0 && <p className="text-sm" style={{ color: "var(--ad-muted)" }}>No drafts. You are all caught up.</p>}
          {recentDrafts.map((p) => (
            <Link key={p.id} href={`/admin/posts/${p.id}`} className="flex items-center justify-between py-1.5 text-sm hover:text-[var(--ad-accent)]">
              <span className="truncate font-medium">{p.title}</span>
              <span className="ml-3 shrink-0 text-xs" style={{ color: "var(--ad-muted)" }}>{formatDate(p.updatedAt)}</span>
            </Link>
          ))}
        </section>
        <section>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ad-muted)" }}>
            Recent contact submissions
          </h2>
          {recentSubmissions.length === 0 && <p className="text-sm" style={{ color: "var(--ad-muted)" }}>No submissions yet.</p>}
          {recentSubmissions.map((s) => (
            <div key={s.id} className="py-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{s.name}</span>
                <span className="ml-3 shrink-0 text-xs" style={{ color: "var(--ad-muted)" }}>{formatDate(s.createdAt)}</span>
              </div>
              <a href={`mailto:${s.email}`} className="text-xs hover:underline" style={{ color: "var(--ad-accent)" }}>
                {s.email}
              </a>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
