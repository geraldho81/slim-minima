import { and, count, desc, eq, ilike, isNotNull, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { formatDate } from "@/lib/content";
import { requireUser } from "@/lib/auth";
import { purgeExpiredTrash } from "@/lib/trash";
import { NewPageButton } from "@/components/admin/NewContentButtons";
import { ContentListTable, type ListCounts, type ListView } from "@/components/admin/ContentListTable";

const PER_PAGE = 20;

type Search = Promise<{ view?: string; q?: string; p?: string }>;

export default async function PagesList({ searchParams }: { searchParams: Search }) {
  const user = await requireUser();
  const params = await searchParams;
  const view = (["all", "published", "draft", "scheduled", "trash"].includes(params.view ?? "") ? params.view : "all") as ListView;
  const q = (params.q ?? "").trim();
  const pageNum = Math.max(1, parseInt(params.p ?? "1", 10) || 1);

  await purgeExpiredTrash("pages");

  const conds: SQL[] = [];
  if (view === "trash") conds.push(isNotNull(pages.deletedAt));
  else {
    conds.push(isNull(pages.deletedAt));
    if (view !== "all") conds.push(eq(pages.status, view));
  }
  if (q) conds.push(or(ilike(pages.title, `%${q}%`), ilike(pages.slug, `%${q}%`))!);
  const where = and(...conds);

  const [rows, [total], statusCounts, [trashCount]] = await Promise.all([
    db.select().from(pages).where(where).orderBy(desc(pages.updatedAt)).limit(PER_PAGE).offset((pageNum - 1) * PER_PAGE),
    db.select({ n: count() }).from(pages).where(where),
    db.select({ status: pages.status, n: count() }).from(pages).where(isNull(pages.deletedAt)).groupBy(pages.status),
    db.select({ n: count() }).from(pages).where(isNotNull(pages.deletedAt)),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s.n]));
  const counts: ListCounts = {
    all: statusCounts.reduce((sum, s) => sum + s.n, 0),
    published: byStatus.published ?? 0,
    draft: byStatus.draft ?? 0,
    scheduled: byStatus.scheduled ?? 0,
    trash: trashCount.n,
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
        <NewPageButton />
      </div>
      <ContentListTable
        kind="pages"
        rows={rows.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          updated: formatDate(p.updatedAt),
        }))}
        counts={counts}
        view={view}
        q={q}
        page={pageNum}
        totalPages={Math.max(1, Math.ceil(total.n / PER_PAGE))}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
