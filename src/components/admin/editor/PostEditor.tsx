"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { savePost, trashPost, createCategory, listPostRevisions, restorePostRevision, namePostRevision } from "@/app/admin/actions";
import { RichTextField } from "@/components/admin/editor/RichTextField";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { CloudinaryNotice } from "@/components/admin/CloudinaryNotice";

export type PostData = {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  categoryId: string | null;
  tags: string[];
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  status: "draft" | "published" | "scheduled";
  publishAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  noindex: boolean;
  customSchema: string | null;
};

type CategoryOption = { id: string; name: string };

type SaveState = "saved" | "dirty" | "saving" | "error";

const STATUS_CHIP: Record<PostData["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "ad-chip-draft" },
  published: { label: "Published", className: "ad-chip-published" },
  scheduled: { label: "Scheduled", className: "ad-chip-scheduled" },
};

function SaveButton({
  status,
  saving,
  onSave,
  onSetStatus,
}: {
  status: PostData["status"];
  saving: boolean;
  onSave: () => void;
  onSetStatus: (status: PostData["status"]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex">
      <button className="ad-btn ad-btn-primary" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} onClick={onSave} disabled={saving}>
        Save
      </button>
      <button
        className="ad-btn ad-btn-primary"
        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: "0 0.5rem", marginLeft: 1 }}
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
      >
        ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg bg-white p-1 shadow-xl" style={{ border: "1px solid var(--ad-line)" }}>
            {status !== "published" ? (
              <button className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--ad-bg)]" onClick={() => { onSetStatus("published"); setOpen(false); }}>
                Publish now
              </button>
            ) : (
              <button className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--ad-bg)]" onClick={() => { onSetStatus("draft"); setOpen(false); }}>
                Unpublish (to draft)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PostEditor({ initial, categories: initialCategories }: { initial: PostData; categories: CategoryOption[] }) {
  const [post, setPost] = useState(initial);
  const [categories, setCategories] = useState(initialCategories);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);

  const postRef = useRef(post);
  // Keep the ref pointing at the latest post for the debounced save callback,
  // which reads it well after render.
  useEffect(() => {
    postRef.current = post;
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async (override?: Partial<PostData>) => {
    const current = { ...postRef.current, ...override };
    setSaveState("saving");
    try {
      const result = await savePost(current.id, {
        title: current.title,
        slug: current.slug,
        body: current.body,
        excerpt: current.excerpt,
        categoryId: current.categoryId,
        tags: current.tags,
        heroImageUrl: current.heroImageUrl,
        heroImageAlt: current.heroImageAlt,
        status: current.status,
        publishAt: current.publishAt,
        metaTitle: current.metaTitle,
        metaDescription: current.metaDescription,
        noindex: current.noindex,
        customSchema: current.customSchema,
      });
      if (result.slug !== postRef.current.slug) setPost((p) => ({ ...p, slug: result.slug }));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  const update = useCallback(
    (partial: Partial<PostData>) => {
      setPost((p) => ({ ...p, ...partial }));
      setSaveState("dirty");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doSave(), 800);
    },
    [doSave]
  );

  async function handleSaveClick() {
    if (timerRef.current) clearTimeout(timerRef.current);
    await doSave();
  }

  async function setStatus(status: PostData["status"]) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPost((p) => ({ ...p, status }));
    await doSave({ status });
  }

  const chip = STATUS_CHIP[post.status];

  const saveLabel =
    saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : saveState === "dirty" ? "Unsaved changes" : "Save failed - retrying on next change";

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--ad-bg)", color: "var(--ad-text)" }}>
      <header className="flex h-16 shrink-0 items-center gap-3 bg-white px-4">
        <Link href="/admin/posts" className="ad-btn ad-btn-soft" style={{ padding: "0.4rem 0.7rem" }}>
          ←
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2.5">
            <span className="min-w-0 truncate text-[17px] font-bold tracking-tight">{post.title || "Untitled post"}</span>
            <span className={`ad-chip ${chip.className}`}>{chip.label}</span>
          </div>
          <span className="text-xs" style={{ color: "var(--ad-muted)" }}>/blog/{post.slug}</span>
        </div>
        <span className="shrink-0 text-xs" style={{ color: saveState === "error" ? "var(--ad-danger)" : "var(--ad-muted)" }}>
          {saveLabel}
        </span>
        <a href={`/preview/post/${post.slug}`} target="_blank" className="ad-btn ad-btn-soft">
          Preview
        </a>
        <button className="ad-icon-btn" onClick={() => setSidebarOpen((v) => !v)} title="Toggle post settings">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" />
          </svg>
        </button>
        <SaveButton status={post.status} saving={saveState === "saving"} onSave={handleSaveClick} onSetStatus={setStatus} />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Article-first: title + body front and center */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-10">
            <textarea
              className="mb-6 w-full resize-none bg-transparent text-4xl font-bold leading-tight tracking-tight outline-none"
              rows={post.title.length > 40 ? 2 : 1}
              placeholder="Post title"
              value={post.title}
              onChange={(e) => update({ title: e.target.value.replace(/\n/g, "") })}
            />
            <RichTextField
              variant="post"
              value={post.body}
              onChange={(body) => update({ body })}
              placeholder="Start writing..."
            />
          </div>
        </div>

        {/* Metadata sidebar */}
        {sidebarOpen && (
          <aside className="w-80 shrink-0 overflow-y-auto bg-white p-4">
            <h2 className="mb-4 text-sm font-bold tracking-tight">Post settings</h2>

            <div className="ad-field">
              <label className="ad-label">Slug</label>
              <input className="ad-input" value={post.slug} onChange={(e) => update({ slug: e.target.value })} />
            </div>

            <div className="ad-field">
              <label className="ad-label">Status</label>
              <select className="ad-select" value={post.status} onChange={(e) => update({ status: e.target.value as PostData["status"] })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            {post.status === "scheduled" && (
              <div className="ad-field">
                <label className="ad-label">Go live at</label>
                <input
                  className="ad-input"
                  type="datetime-local"
                  value={post.publishAt ? post.publishAt.slice(0, 16) : ""}
                  onChange={(e) => update({ publishAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            )}

            <div className="ad-field">
              <label className="ad-label">Excerpt</label>
              <textarea className="ad-textarea" rows={3} value={post.excerpt ?? ""} onChange={(e) => update({ excerpt: e.target.value || null })} />
            </div>

            <div className="ad-field">
              <label className="ad-label">Category</label>
              <div className="max-h-44 overflow-y-auto rounded-lg p-1.5" style={{ background: "var(--ad-bg)" }}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-white">
                  <input type="radio" name="post-category" checked={!post.categoryId} onChange={() => update({ categoryId: null })} />
                  <span style={{ color: "var(--ad-muted)" }}>Uncategorized</span>
                </label>
                {categories.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-white">
                    <input type="radio" name="post-category" checked={post.categoryId === c.id} onChange={() => update({ categoryId: c.id })} />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
              {newCategoryOpen ? (
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    className="ad-input"
                    placeholder="New category name"
                    value={newCategoryName}
                    autoFocus
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && newCategoryName.trim()) {
                        e.preventDefault();
                        const cat = await createCategory(newCategoryName);
                        setCategories((prev) => (prev.some((c) => c.id === cat.id) ? prev : [...prev, cat].sort((a, b) => a.name.localeCompare(b.name))));
                        update({ categoryId: cat.id });
                        setNewCategoryName("");
                        setNewCategoryOpen(false);
                      }
                      if (e.key === "Escape") setNewCategoryOpen(false);
                    }}
                  />
                  <button
                    type="button"
                    className="ad-btn ad-btn-primary shrink-0"
                    style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
                    disabled={!newCategoryName.trim()}
                    onClick={async () => {
                      const cat = await createCategory(newCategoryName);
                      setCategories((prev) => (prev.some((c) => c.id === cat.id) ? prev : [...prev, cat].sort((a, b) => a.name.localeCompare(b.name))));
                      update({ categoryId: cat.id });
                      setNewCategoryName("");
                      setNewCategoryOpen(false);
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-1.5 text-xs font-semibold"
                  style={{ color: "var(--ad-accent)" }}
                  onClick={() => setNewCategoryOpen(true)}
                >
                  + Add new category
                </button>
              )}
            </div>

            <div className="ad-field">
              <label className="ad-label">Tags (comma separated)</label>
              <input
                className="ad-input"
                value={post.tags.join(", ")}
                onChange={(e) =>
                  update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })
                }
              />
            </div>

            <details className="mb-3 mt-2" open>
              <summary className="mb-2 cursor-pointer text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ad-muted)" }}>
                Hero image
              </summary>
              {post.heroImageUrl && (
                <div className="mb-1.5 overflow-hidden rounded-lg bg-[var(--ad-bg)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.heroImageUrl} alt="" className="max-h-32 w-full object-cover" />
                </div>
              )}
              <div className="mb-2 flex gap-1.5">
                <button type="button" className="ad-btn ad-btn-soft flex-1" onClick={() => setPickerOpen(true)}>
                  {post.heroImageUrl ? "Replace" : "Choose image"}
                </button>
                {post.heroImageUrl && (
                  <button type="button" className="ad-btn ad-btn-soft" onClick={() => update({ heroImageUrl: null })}>
                    Clear
                  </button>
                )}
              </div>
              <CloudinaryNotice className="mb-2" />
              <div className="ad-field">
                <label className="ad-label">Alt text</label>
                <input className="ad-input" value={post.heroImageAlt ?? ""} onChange={(e) => update({ heroImageAlt: e.target.value || null })} />
              </div>
            </details>

            <details className="mb-3">
              <summary className="mb-2 cursor-pointer text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ad-muted)" }}>
                SEO
              </summary>
              <div className="ad-field">
                <label className="ad-label">Meta title</label>
                <input className="ad-input" value={post.metaTitle ?? ""} onChange={(e) => update({ metaTitle: e.target.value || null })} />
              </div>
              <div className="ad-field">
                <label className="ad-label">Meta description</label>
                <textarea className="ad-textarea" rows={3} value={post.metaDescription ?? ""} onChange={(e) => update({ metaDescription: e.target.value || null })} />
              </div>
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={post.noindex} onChange={(e) => update({ noindex: e.target.checked })} />
                Hide from search engines (noindex)
              </label>
              <div className="ad-field">
                <label className="ad-label">Custom schema markup (JSON-LD)</label>
                <textarea className="ad-textarea" rows={6} value={post.customSchema ?? ""} onChange={(e) => update({ customSchema: e.target.value || null })} placeholder={'{\n  "@type": "Article",\n  "name": "..."\n}'} style={{ fontFamily: "monospace", fontSize: "13px" }} />
                <p style={{ fontSize: "12px", color: "var(--ad-muted)", marginTop: "0.4rem" }}>Generate your schema at <a href="https://technicalseo.com/tools/schema-markup-generator/" target="_blank" rel="noopener noreferrer">TechnicalSEO.com</a> and validate with <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer">Google Rich Results Test</a>.</p>
              </div>
            </details>

            <button className="ad-btn ad-btn-soft mb-2 w-full" onClick={() => setRevisionsOpen(true)}>
              Revision history
            </button>
            <button
              className="ad-btn ad-btn-danger w-full"
              title="Reversible - restore it from the Trash tab on the posts list"
              onClick={() => {
                if (timerRef.current) clearTimeout(timerRef.current);
                trashPost(post.id);
              }}
            >
              Move to trash
            </button>
          </aside>
        )}
      </div>

      {pickerOpen && <MediaPicker onSelect={(url) => update({ heroImageUrl: url })} onClose={() => setPickerOpen(false)} />}
      {revisionsOpen && (
        <PostRevisionsModal
          postId={post.id}
          onClose={() => setRevisionsOpen(false)}
          onRestored={(data) => {
            setPost((p) => ({ ...p, ...data }));
            setRevisionsOpen(false);
            setSaveState("saved");
          }}
        />
      )}
    </div>
  );
}

type PostRevision = { id: string; savedAt: string; title: string; versionName: string | null; savedByName: string | null };

function PostRevisionsModal({
  postId,
  onClose,
  onRestored,
}: {
  postId: string;
  onClose: () => void;
  onRestored: (data: { title: string; body: string; heroImageUrl: string | null; heroImageAlt: string | null }) => void;
}) {
  const [revisions, setRevisions] = useState<PostRevision[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPostRevisions(postId).then(setRevisions).catch(() => setRevisions([]));
  }, [postId]);

  function updateName(id: string, versionName: string) {
    setRevisions((prev) => prev?.map((r) => r.id === id ? { ...r, versionName: versionName || null } : r) ?? prev);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-6" onClick={onClose}>
      <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Revisions</h2>
          <button className="ad-btn ad-btn-soft" onClick={onClose}>Close</button>
        </div>
        {revisions === null ? (
          <p className="text-sm" style={{ color: "var(--ad-muted)" }}>Loading...</p>
        ) : revisions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ad-muted)" }}>
            No revisions yet. Snapshots are taken automatically as you edit.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {revisions.map((rev) => (
              <div key={rev.id} className="rounded-lg bg-[var(--ad-bg)] px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{new Date(rev.savedAt).toLocaleString()}</div>
                    <div className="text-xs" style={{ color: "var(--ad-muted)" }}>
                      {rev.title}{rev.savedByName ? ` · ${rev.savedByName}` : ""}
                    </div>
                  </div>
                  <button
                    className="ad-btn ad-btn-soft shrink-0"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const data = await restorePostRevision(postId, rev.id);
                        onRestored(data);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Restore
                  </button>
                </div>
                <input
                  className="w-full rounded-md px-2 py-1 text-xs outline-none"
                  style={{ background: "var(--ad-line)", color: "var(--ad-text)" }}
                  placeholder="Add a label for this version..."
                  defaultValue={rev.versionName ?? ""}
                  onBlur={(e) => {
                    const val = e.currentTarget.value;
                    if ((val || null) !== rev.versionName) {
                      updateName(rev.id, val);
                      namePostRevision(postId, rev.id, val);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
