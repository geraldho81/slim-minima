import { and, count, desc, eq, ilike, isNotNull, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts, users, categories } from "@/db/schema";
import { formatDate } from "@/lib/content";
import { requireUser } from "@/lib/auth";
import { purgeExpiredTrash } from "@/lib/trash";
import { NewPostButton } from "@/components/admin/NewContentButtons";
import { ContentListTable, type ListCounts, type ListView } from "@/components/admin/ContentListTable";

const PER_PAGE = 20;

type Search = Promise<{ view?: string; q?: string; p?: string; cat?: string }>;

export default async function PostsList({ searchParams }: { searchParams: Search }) {
  const user = await requireUser();
  const params = await searchParams;
  const view = (["all", "published", "draft", "scheduled", "trash"].includes(params.view ?? "") ? params.view : "all") as ListView;
  const q = (params.q ?? "").trim();
  const rawCat = (params.cat ?? "").trim();
  const cat = /^[0-9a-f-]{36}$/i.test(rawCat) ? rawCat : "";
  const pageNum = Math.max(1, parseInt(params.p ?? "1", 10) || 1);

  await purgeExpiredTrash("posts");

  const conds: SQL[] = [];
  if (view === "trash") conds.push(isNotNull(posts.deletedAt));
  else {
    conds.push(isNull(posts.deletedAt));
    if (view !== "all") conds.push(eq(posts.status, view));
  }
  if (q) conds.push(or(ilike(posts.title, `%${q}%`), ilike(posts.slug, `%${q}%`))!);
  if (cat) conds.push(eq(posts.categoryId, cat));
  const where = and(...conds);

  const [rows, [total], statusCounts, [trashCount], allCategories] = await Promise.all([
    db
      .select({ post: posts, authorName: users.name, categoryName: categories.name })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(where)
      .orderBy(desc(posts.updatedAt))
      .limit(PER_PAGE)
      .offset((pageNum - 1) * PER_PAGE),
    db.select({ n: count() }).from(posts).where(where),
    db.select({ status: posts.status, n: count() }).from(posts).where(isNull(posts.deletedAt)).groupBy(posts.status),
    db.select({ n: count() }).from(posts).where(isNotNull(posts.deletedAt)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.name),
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
        <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
        <NewPostButton />
      </div>
      <ContentListTable
        kind="posts"
        rows={rows.map(({ post, authorName, categoryName }) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          status: post.status,
          updated: formatDate(post.updatedAt),
          categoryId: post.categoryId,
          categoryName,
          authorName,
          tags: post.tags,
        }))}
        counts={counts}
        view={view}
        q={q}
        page={pageNum}
        totalPages={Math.max(1, Math.ceil(total.n / PER_PAGE))}
        isAdmin={user.role === "admin"}
        categories={allCategories}
        cat={cat}
      />
    </div>
  );
}
