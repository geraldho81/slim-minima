"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { savePost, trashPost, createCategory } from "@/app/admin/actions";
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
};

type CategoryOption = { id: string; name: string };

type SaveState = "saved" | "dirty" | "saving" | "error";

export function PostEditor({ initial, categories: initialCategories }: { initial: PostData; categories: CategoryOption[] }) {
  const [post, setPost] = useState(initial);
  const [categories, setCategories] = useState(initialCategories);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const postRef = useRef(post);
  postRef.current = post;
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

  async function handlePublishClick() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (post.status === "published") {
      await doSave();
    } else {
      setPost((p) => ({ ...p, status: "published" }));
      await doSave({ status: "published" });
    }
  }

  const saveLabel =
    saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : saveState === "dirty" ? "Unsaved changes" : "Save failed - retrying on next change";

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--ad-bg)", color: "var(--ad-text)" }}>
      <header className="flex h-14 shrink-0 items-center gap-3 bg-white px-4">
        <Link href="/admin/posts" className="ad-btn ad-btn-soft" style={{ padding: "0.4rem 0.7rem" }}>
          ←
        </Link>
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight">{post.title || "Untitled post"}</span>
        <span className="shrink-0 text-xs" style={{ color: saveState === "error" ? "var(--ad-danger)" : "var(--ad-muted)" }}>
          {saveLabel}
        </span>
        <a href={`/blog/${post.slug}?preview=1`} target="_blank" className="ad-btn ad-btn-soft">
          Preview
        </a>
        <button className="ad-btn ad-btn-soft" onClick={() => setSidebarOpen((v) => !v)} title="Toggle post settings">
          {sidebarOpen ? "Hide settings" : "Settings"}
        </button>
        <button className="ad-btn ad-btn-primary" onClick={handlePublishClick} disabled={saveState === "saving"}>
          {post.status === "published" ? "Update" : "Publish"}
        </button>
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
            </details>

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
    </div>
  );
}
