"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusChip } from "@/components/admin/StatusChip";
import {
  trashPages,
  restorePages,
  destroyPages,
  setPagesStatus,
  duplicatePage,
  trashPosts,
  restorePosts,
  destroyPosts,
  setPostsStatus,
  duplicatePost,
  savePost,
} from "@/app/admin/actions";

export type ListRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "scheduled";
  updated: string;
  categoryId?: string | null;
  categoryName?: string | null;
  authorName?: string | null;
  tags?: string[];
};

export type ListCounts = { all: number; published: number; draft: number; scheduled: number; trash: number };

export type ListView = "all" | "published" | "draft" | "scheduled" | "trash";

type CategoryOption = { id: string; name: string };

type Props = {
  kind: "pages" | "posts";
  rows: ListRow[];
  counts: ListCounts;
  view: ListView;
  q: string;
  page: number;
  totalPages: number;
  isAdmin: boolean;
  categories?: CategoryOption[];
  cat?: string;
};

const actionsByKind = {
  pages: { trash: trashPages, restore: restorePages, destroy: destroyPages, setStatus: setPagesStatus, duplicate: duplicatePage },
  posts: { trash: trashPosts, restore: restorePosts, destroy: destroyPosts, setStatus: setPostsStatus, duplicate: duplicatePost },
} as const;

export function ContentListTable({ kind, rows, counts, view, q, page, totalPages, isAdmin, categories = [], cat = "" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [armedDestroy, setArmedDestroy] = useState<string | null>(null); // row id or "bulk"
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const acts = actionsByKind[kind];

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function href(overrides: { view?: ListView; p?: number; cat?: string }) {
    const params = new URLSearchParams();
    const v = overrides.view ?? view;
    const c = overrides.cat ?? cat;
    if (v !== "all") params.set("view", v);
    if (q) params.set("q", q);
    if (c) params.set("cat", c);
    if (overrides.p && overrides.p > 1) params.set("p", String(overrides.p));
    const qs = params.toString();
    return `/admin/${kind}${qs ? `?${qs}` : ""}`;
  }

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      setSelected(new Set());
      setArmedDestroy(null);
      setQuickEditId(null);
      router.refresh();
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ids = [...selected];

  const tabs: { key: ListView; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "published", label: "Published", count: counts.published },
    { key: "draft", label: "Draft", count: counts.draft },
    { key: "scheduled", label: "Scheduled", count: counts.scheduled },
    { key: "trash", label: "Trash", count: counts.trash },
  ];

  function publicUrl(row: ListRow) {
    if (row.status === "published") {
      return kind === "pages" ? (row.slug === "home" ? "/" : `/${row.slug}`) : `/blog/${row.slug}`;
    }
    // Drafts are not public - point to the auth-gated preview route instead.
    return kind === "pages" ? `/preview/page/${row.slug}` : `/preview/post/${row.slug}`;
  }

  const emptyMessage =
    view === "trash"
      ? "Trash is empty."
      : q
        ? `No ${kind} match "${q}".`
        : view === "all"
          ? `No ${kind} yet.`
          : `No ${view} ${kind}.`;

  return (
    <div>
      {/* Status tabs + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-sm">
          {tabs
            .filter((t) => t.key === "all" || t.count > 0)
            .map((t) => (
              <Link
                key={t.key}
                href={href({ view: t.key, p: 1 })}
                className="rounded-lg px-2.5 py-1.5 font-medium"
                style={
                  view === t.key
                    ? { background: "var(--ad-text)", color: "white" }
                    : { color: t.key === "trash" ? "var(--ad-danger)" : "var(--ad-muted)" }
                }
              >
                {t.label} <span className="opacity-60">({t.count})</span>
              </Link>
            ))}
        </div>
        <form method="get" action={`/admin/${kind}`} className="flex items-center gap-2">
          {view !== "all" && <input type="hidden" name="view" value={view} />}
          {cat && <input type="hidden" name="cat" value={cat} />}
          <input className="ad-input" style={{ width: "14rem" }} type="search" name="q" placeholder={`Search ${kind}...`} defaultValue={q} />
          {kind === "posts" && categories.length > 0 && (
            <select
              className="ad-select"
              style={{ width: "auto" }}
              value={cat}
              onChange={(e) => router.push(href({ cat: e.target.value, p: 1 }))}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </form>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm">
          <span className="mr-1 font-semibold">{selected.size} selected</span>
          {view === "trash" ? (
            <>
              <button className="ad-btn ad-btn-soft" disabled={pending} onClick={() => run(() => acts.restore(ids))}>
                Restore
              </button>
              {isAdmin && (
                <button
                  className="ad-btn ad-btn-danger"
                  disabled={pending}
                  onClick={() => (armedDestroy === "bulk" ? run(() => acts.destroy(ids)) : setArmedDestroy("bulk"))}
                >
                  {armedDestroy === "bulk" ? "Confirm permanent delete" : "Delete permanently"}
                </button>
              )}
            </>
          ) : (
            <>
              <button className="ad-btn ad-btn-soft" disabled={pending} onClick={() => run(() => acts.setStatus(ids, "published"))}>
                Publish
              </button>
              <button className="ad-btn ad-btn-soft" disabled={pending} onClick={() => run(() => acts.setStatus(ids, "draft"))}>
                Switch to draft
              </button>
              <button className="ad-btn ad-btn-danger" disabled={pending} onClick={() => run(() => acts.trash(ids))}>
                Move to trash
              </button>
            </>
          )}
          <button className="ml-auto ad-btn ad-btn-soft" onClick={() => { setSelected(new Set()); setArmedDestroy(null); }}>
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm" style={{ color: "var(--ad-muted)" }}>
            {emptyMessage}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ color: "var(--ad-muted)" }}>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                  />
                </th>
                <th className="px-2 py-3 font-semibold">Title</th>
                {kind === "pages" && <th className="px-5 py-3 font-semibold">Slug</th>}
                {kind === "posts" && <th className="px-5 py-3 font-semibold">Category</th>}
                {kind === "posts" && <th className="px-5 py-3 font-semibold">Author</th>}
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                quickEditId === row.id ? (
                  <QuickEditRow
                    key={row.id}
                    row={row}
                    categories={categories}
                    colSpan={kind === "posts" ? 6 : 5}
                    pending={pending}
                    onCancel={() => setQuickEditId(null)}
                    onSave={(data) => run(() => savePost(row.id, data))}
                  />
                ) : (
                  <tr key={row.id} className="group align-top hover:bg-[var(--ad-bg)]">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                    </td>
                    <td className="px-2 py-3">
                      <Link href={`/admin/${kind}/${row.id}`} className="font-semibold hover:underline">
                        {row.title}
                      </Link>
                      <div className="mt-0.5 flex gap-2 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                        {view === "trash" ? (
                          <>
                            <button className="font-medium hover:underline" style={{ color: "var(--ad-accent)" }} disabled={pending} onClick={() => run(() => acts.restore([row.id]))}>
                              Restore
                            </button>
                            {isAdmin && (
                              <button
                                className="font-medium hover:underline"
                                style={{ color: "var(--ad-danger)" }}
                                disabled={pending}
                                onClick={() => (armedDestroy === row.id ? run(() => acts.destroy([row.id])) : setArmedDestroy(row.id))}
                              >
                                {armedDestroy === row.id ? "Confirm?" : "Delete permanently"}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <Link href={`/admin/${kind}/${row.id}`} className="font-medium hover:underline" style={{ color: "var(--ad-accent)" }}>
                              Edit
                            </Link>
                            {kind === "posts" && (
                              <button className="font-medium hover:underline" style={{ color: "var(--ad-accent)" }} onClick={() => { setQuickEditId(row.id); setSelected(new Set()); }}>
                                Quick edit
                              </button>
                            )}
                            <a href={publicUrl(row)} target="_blank" className="font-medium hover:underline" style={{ color: "var(--ad-accent)" }}>
                              {row.status === "published" ? "View" : "Preview"}
                            </a>
                            <button className="font-medium hover:underline" style={{ color: "var(--ad-accent)" }} disabled={pending} onClick={() => run(() => acts.duplicate(row.id))}>
                              Duplicate
                            </button>
                            <button className="font-medium hover:underline" style={{ color: "var(--ad-danger)" }} disabled={pending} onClick={() => run(() => acts.trash([row.id]))}>
                              Trash
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    {kind === "pages" && (
                      <td className="px-5 py-3" style={{ color: "var(--ad-muted)" }}>
                        /{row.slug === "home" ? "" : row.slug}
                      </td>
                    )}
                    {kind === "posts" && (
                      <td className="px-5 py-3" style={{ color: "var(--ad-muted)" }}>
                        {row.categoryName ?? "-"}
                      </td>
                    )}
                    {kind === "posts" && (
                      <td className="px-5 py-3" style={{ color: "var(--ad-muted)" }}>
                        {row.authorName ?? "-"}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--ad-muted)" }}>
                      {row.updated}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm" style={{ color: "var(--ad-muted)" }}>
          {page > 1 ? (
            <Link href={href({ p: page - 1 })} className="ad-btn ad-btn-soft">
              ← Previous
            </Link>
          ) : (
            <span className="ad-btn ad-btn-soft opacity-40">← Previous</span>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href({ p: page + 1 })} className="ad-btn ad-btn-soft">
              Next →
            </Link>
          ) : (
            <span className="ad-btn ad-btn-soft opacity-40">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}

function QuickEditRow({
  row,
  categories,
  colSpan,
  pending,
  onCancel,
  onSave,
}: {
  row: ListRow;
  categories: CategoryOption[];
  colSpan: number;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: { title: string; slug: string; status: ListRow["status"]; categoryId: string | null; tags: string[] }) => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [slug, setSlug] = useState(row.slug);
  const [status, setStatus] = useState(row.status);
  const [categoryId, setCategoryId] = useState(row.categoryId ?? "");
  const [tags, setTags] = useState((row.tags ?? []).join(", "));

  return (
    <tr style={{ background: "var(--ad-bg)" }}>
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ad-muted)" }}>
          Quick edit
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="ad-field" style={{ marginBottom: 0 }}>
            <label className="ad-label">Title</label>
            <input className="ad-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="ad-field" style={{ marginBottom: 0 }}>
            <label className="ad-label">Slug</label>
            <input className="ad-input" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div className="ad-field" style={{ marginBottom: 0 }}>
            <label className="ad-label">Status</label>
            <select className="ad-select" value={status} onChange={(e) => setStatus(e.target.value as ListRow["status"])}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <div className="ad-field" style={{ marginBottom: 0 }}>
            <label className="ad-label">Category</label>
            <select className="ad-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ad-field col-span-2" style={{ marginBottom: 0 }}>
            <label className="ad-label">Tags (comma separated)</label>
            <input className="ad-input" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="ad-btn ad-btn-primary"
            disabled={pending || !title.trim()}
            onClick={() =>
              onSave({
                title: title.trim(),
                slug,
                status,
                categoryId: categoryId || null,
                tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
              })
            }
          >
            {pending ? "Saving..." : "Save"}
          </button>
          <button className="ad-btn ad-btn-soft" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
