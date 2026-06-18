"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, desc, and, ne, sql, inArray, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";
import { db } from "@/db";
import { pages, pageRevisions, posts, postRevisions, menus, settings, users, apiKeys, categories, redirects, mediaTrash, contactSubmissions } from "@/db/schema";
import type { Block } from "@/blocks/types";
import type { MenuItem, ContactField, ContactForm } from "@/db/schema";
import { CONTACT_FORMS_KEY } from "@/lib/queries";
import { validateBlocks } from "@/blocks/registry";
import { requireUser, requireAdmin } from "@/lib/auth";
import { listCloudinaryMedia, deleteCloudinaryMedia, setCloudinaryAlt } from "@/lib/cloudinary";
import { CACHE_TAGS } from "@/lib/queries";
import { slugify } from "@/lib/content";
import { pingPagesIndexNow, pingPostsIndexNow } from "@/lib/indexnow";
import { regenerateMcpToken, revokeMcpToken } from "@/lib/mcp/token";
import { dispatchSecurityUpdate, UPDATE_KEYS } from "@/lib/updates";

/* ============================== Security updates ============================== */

export async function startSecurityUpdate(version: string) {
  await requireAdmin();
  return dispatchSecurityUpdate(version);
}

/** Store the one-time GitHub connection (repo + token) in the site's own DB so
 *  the Update button can apply security fixes on its own. The token only needs
 *  the "Actions" permission. Admin only. */
export async function connectGithubUpdates(input: { repo: string; token: string }) {
  await requireAdmin();
  const repo = input.repo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");
  const token = input.token.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false as const, error: "Enter the repository as owner/name." };
  if (!token) return { ok: false as const, error: "Paste a GitHub token." };

  // Light check that the token actually reaches this repo, for a clear error.
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (res.status === 401 || res.status === 403) return { ok: false as const, error: "GitHub rejected that token. Check it has access to this repo." };
    if (res.status === 404) return { ok: false as const, error: "Could not find that repo with this token. Check owner/name and the token's repository access." };
  } catch {
    // Network hiccup - save anyway rather than block the user.
  }

  for (const [key, value] of Object.entries({ [UPDATE_KEYS.repo]: repo, [UPDATE_KEYS.token]: token })) {
    await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  revalidatePath("/admin/settings");
  return { ok: true as const };
}

export async function disconnectGithubUpdates() {
  await requireAdmin();
  await db.delete(settings).where(inArray(settings.key, [UPDATE_KEYS.repo, UPDATE_KEYS.token]));
  revalidatePath("/admin/settings");
  return { ok: true as const };
}

function bumpPages() {
  revalidateTag(CACHE_TAGS.pages, "max");
  revalidatePath("/", "layout");
}
function bumpPosts() {
  revalidateTag(CACHE_TAGS.posts, "max");
  revalidatePath("/blog", "layout");
}
// Forms are referenced from arbitrary cached pages, so a form edit must also
// refresh those pages (they pull the form server-side via getData).
function bumpContactForms() {
  revalidateTag(CACHE_TAGS.contactForms, "max");
  revalidatePath("/admin/contacts");
  bumpPages();
}

/* ============================== Pages ============================== */

export async function createPage(title: string) {
  await requireUser();
  const base = slugify(title) || "untitled";
  let slug = base;
  for (let i = 2; ; i++) {
    const exists = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
    if (!exists.length) break;
    slug = `${base}-${i}`;
  }
  const [page] = await db.insert(pages).values({ title, slug, blocks: [] }).returning();
  redirect(`/admin/pages/${page.id}`);
}

export type PageSave = {
  title?: string;
  slug?: string;
  blocks?: Block[];
  status?: "draft" | "published" | "scheduled";
  publishAt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  noindex?: boolean;
  customSchema?: string | null;
};

export async function savePage(id: string, data: PageSave) {
  const user = await requireUser();
  if (data.blocks) validateBlocks(data.blocks);

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) update.title = data.title;
  if (data.slug !== undefined) update.slug = slugify(data.slug) || "untitled";
  if (data.blocks !== undefined) update.blocks = data.blocks;
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === "published") update.publishedAt = new Date();
  }
  if (data.publishAt !== undefined) update.publishAt = data.publishAt ? new Date(data.publishAt) : null;
  if (data.metaTitle !== undefined) update.metaTitle = data.metaTitle;
  if (data.metaDescription !== undefined) update.metaDescription = data.metaDescription;
  if (data.ogImage !== undefined) update.ogImage = data.ogImage;
  if (data.noindex !== undefined) update.noindex = data.noindex;
  if (data.customSchema !== undefined) update.customSchema = data.customSchema;

  const [page] = await db.update(pages).set(update).where(eq(pages.id, id)).returning();
  if (!page) throw new Error("Page not found");

  // Snapshot a revision at most every 5 minutes, keep the last 20.
  if (data.blocks !== undefined) {
    const [latest] = await db
      .select({ savedAt: pageRevisions.savedAt })
      .from(pageRevisions)
      .where(eq(pageRevisions.pageId, id))
      .orderBy(desc(pageRevisions.savedAt))
      .limit(1);
    if (!latest || Date.now() - new Date(latest.savedAt).getTime() > 5 * 60 * 1000) {
      await db.insert(pageRevisions).values({ pageId: id, title: page.title, blocks: page.blocks, savedBy: user.id });
      await db.execute(sql`
        DELETE FROM page_revisions WHERE page_id = ${id} AND id NOT IN (
          SELECT id FROM page_revisions WHERE page_id = ${id} ORDER BY saved_at DESC LIMIT 20
        )`);
    }
  }

  bumpPages();
  if (page.status === "published") pingPagesIndexNow([page.slug]);
  return { slug: page.slug, updatedAt: page.updatedAt.toISOString() };
}

function pingPublishedPages(rows: { slug: string; status: string }[]) {
  pingPagesIndexNow(rows.filter((r) => r.status === "published").map((r) => r.slug));
}

export async function trashPage(id: string) {
  await requireUser();
  const rows = await db.update(pages).set({ deletedAt: new Date() }).where(eq(pages.id, id)).returning({ slug: pages.slug, status: pages.status });
  bumpPages();
  pingPublishedPages(rows);
  redirect("/admin/pages");
}

export async function trashPages(ids: string[]) {
  await requireUser();
  if (!ids.length) return;
  const rows = await db.update(pages).set({ deletedAt: new Date() }).where(inArray(pages.id, ids)).returning({ slug: pages.slug, status: pages.status });
  bumpPages();
  pingPublishedPages(rows);
}

export async function restorePages(ids: string[]) {
  await requireUser();
  if (!ids.length) return;
  const rows = await db.update(pages).set({ deletedAt: null }).where(inArray(pages.id, ids)).returning({ slug: pages.slug, status: pages.status });
  bumpPages();
  pingPublishedPages(rows);
}

export async function destroyPages(ids: string[]) {
  await requireAdmin();
  if (!ids.length) return;
  await db.delete(pages).where(inArray(pages.id, ids));
  bumpPages();
}

export async function setPagesStatus(ids: string[], status: "published" | "draft") {
  await requireUser();
  if (!ids.length) return;
  const update: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "published") update.publishedAt = new Date();
  const rows = await db.update(pages).set(update).where(inArray(pages.id, ids)).returning({ slug: pages.slug });
  bumpPages();
  pingPagesIndexNow(rows.map((r) => r.slug));
}

export async function duplicatePage(id: string) {
  await requireUser();
  const [src] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!src) throw new Error("Page not found");
  const base = `${src.slug}-copy`;
  let slug = base;
  for (let i = 2; ; i++) {
    const exists = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
    if (!exists.length) break;
    slug = `${base}-${i}`;
  }
  await db.insert(pages).values({
    title: `${src.title} (copy)`,
    slug,
    blocks: src.blocks,
    status: "draft",
    metaTitle: src.metaTitle,
    metaDescription: src.metaDescription,
    ogImage: src.ogImage,
    noindex: src.noindex,
  });
  bumpPages();
}

export async function listRevisions(pageId: string) {
  await requireUser();
  const rows = await db
    .select({
      id: pageRevisions.id,
      savedAt: pageRevisions.savedAt,
      title: pageRevisions.title,
      versionName: pageRevisions.versionName,
      savedByName: users.name,
    })
    .from(pageRevisions)
    .leftJoin(users, eq(pageRevisions.savedBy, users.id))
    .where(eq(pageRevisions.pageId, pageId))
    .orderBy(desc(pageRevisions.savedAt));
  return rows.map((r) => ({ ...r, savedAt: r.savedAt.toISOString() }));
}

export async function namePageRevision(pageId: string, revisionId: string, versionName: string) {
  await requireUser();
  const trimmed = versionName.trim();
  await db
    .update(pageRevisions)
    .set({ versionName: trimmed || null })
    .where(and(eq(pageRevisions.id, revisionId), eq(pageRevisions.pageId, pageId)));
}

export async function restoreRevision(pageId: string, revisionId: string) {
  await requireUser();
  const [rev] = await db.select().from(pageRevisions).where(eq(pageRevisions.id, revisionId)).limit(1);
  if (!rev || rev.pageId !== pageId) throw new Error("Revision not found");
  const rows = await db.update(pages).set({ blocks: rev.blocks, updatedAt: new Date() }).where(eq(pages.id, pageId)).returning({ slug: pages.slug, status: pages.status });
  bumpPages();
  pingPublishedPages(rows);
  return rev.blocks;
}

export async function listPostRevisions(postId: string) {
  await requireUser();
  const rows = await db
    .select({
      id: postRevisions.id,
      savedAt: postRevisions.savedAt,
      title: postRevisions.title,
      versionName: postRevisions.versionName,
      savedByName: users.name,
    })
    .from(postRevisions)
    .leftJoin(users, eq(postRevisions.savedBy, users.id))
    .where(eq(postRevisions.postId, postId))
    .orderBy(desc(postRevisions.savedAt));
  return rows.map((r) => ({ ...r, savedAt: r.savedAt.toISOString() }));
}

export async function namePostRevision(postId: string, revisionId: string, versionName: string) {
  await requireUser();
  const trimmed = versionName.trim();
  await db
    .update(postRevisions)
    .set({ versionName: trimmed || null })
    .where(and(eq(postRevisions.id, revisionId), eq(postRevisions.postId, postId)));
}

export async function restorePostRevision(postId: string, revisionId: string) {
  await requireUser();
  const [rev] = await db.select().from(postRevisions).where(eq(postRevisions.id, revisionId)).limit(1);
  if (!rev || rev.postId !== postId) throw new Error("Revision not found");
  const rows = await db
    .update(posts)
    .set({ title: rev.title, body: rev.body, heroImageUrl: rev.heroImageUrl, heroImageAlt: rev.heroImageAlt, updatedAt: new Date() })
    .where(eq(posts.id, postId))
    .returning({ slug: posts.slug, status: posts.status });
  bumpPosts();
  pingPublishedPosts(rows);
  return { title: rev.title, body: rev.body, heroImageUrl: rev.heroImageUrl, heroImageAlt: rev.heroImageAlt };
}

/* ============================== Posts ============================== */

export async function createPost(title: string) {
  const user = await requireUser();
  const base = slugify(title) || "untitled";
  let slug = base;
  for (let i = 2; ; i++) {
    const exists = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
    if (!exists.length) break;
    slug = `${base}-${i}`;
  }
  const [post] = await db.insert(posts).values({ title, slug, authorId: user.id }).returning();
  redirect(`/admin/posts/${post.id}`);
}

export type PostSave = {
  title?: string;
  slug?: string;
  body?: string;
  excerpt?: string | null;
  categoryId?: string | null;
  tags?: string[];
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  status?: "draft" | "published" | "scheduled";
  publishAt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  noindex?: boolean;
  customSchema?: string | null;
};

export async function savePost(id: string, data: PostSave) {
  const user = await requireUser();
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) update.title = data.title;
  if (data.slug !== undefined) update.slug = slugify(data.slug) || "untitled";
  if (data.body !== undefined) update.body = data.body;
  if (data.excerpt !== undefined) update.excerpt = data.excerpt;
  if (data.categoryId !== undefined) update.categoryId = data.categoryId;
  if (data.tags !== undefined) update.tags = data.tags;
  if (data.heroImageUrl !== undefined) update.heroImageUrl = data.heroImageUrl;
  if (data.heroImageAlt !== undefined) update.heroImageAlt = data.heroImageAlt;
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === "published") update.publishedAt = new Date();
  }
  if (data.publishAt !== undefined) update.publishAt = data.publishAt ? new Date(data.publishAt) : null;
  if (data.metaTitle !== undefined) update.metaTitle = data.metaTitle;
  if (data.metaDescription !== undefined) update.metaDescription = data.metaDescription;
  if (data.noindex !== undefined) update.noindex = data.noindex;
  if (data.customSchema !== undefined) update.customSchema = data.customSchema;

  const [post] = await db.update(posts).set(update).where(eq(posts.id, id)).returning();
  if (!post) throw new Error("Post not found");

  // Snapshot a revision at most every 5 minutes when body content changes, keep the last 20.
  if (data.body !== undefined) {
    const [latest] = await db
      .select({ savedAt: postRevisions.savedAt })
      .from(postRevisions)
      .where(eq(postRevisions.postId, id))
      .orderBy(desc(postRevisions.savedAt))
      .limit(1);
    if (!latest || Date.now() - new Date(latest.savedAt).getTime() > 5 * 60 * 1000) {
      await db.insert(postRevisions).values({
        postId: id,
        title: post.title,
        body: post.body,
        heroImageUrl: post.heroImageUrl,
        heroImageAlt: post.heroImageAlt,
        savedBy: user.id,
      });
      await db.execute(sql`
        DELETE FROM post_revisions WHERE post_id = ${id} AND id NOT IN (
          SELECT id FROM post_revisions WHERE post_id = ${id} ORDER BY saved_at DESC LIMIT 20
        )`);
    }
  }

  bumpPosts();
  if (post.status === "published") pingPostsIndexNow([post.slug]);
  return { slug: post.slug, updatedAt: post.updatedAt.toISOString() };
}

function pingPublishedPosts(rows: { slug: string; status: string }[]) {
  pingPostsIndexNow(rows.filter((r) => r.status === "published").map((r) => r.slug));
}

export async function trashPost(id: string) {
  await requireUser();
  const rows = await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id)).returning({ slug: posts.slug, status: posts.status });
  bumpPosts();
  pingPublishedPosts(rows);
  redirect("/admin/posts");
}

export async function trashPosts(ids: string[]) {
  await requireUser();
  if (!ids.length) return;
  const rows = await db.update(posts).set({ deletedAt: new Date() }).where(inArray(posts.id, ids)).returning({ slug: posts.slug, status: posts.status });
  bumpPosts();
  pingPublishedPosts(rows);
}

export async function restorePosts(ids: string[]) {
  await requireUser();
  if (!ids.length) return;
  const rows = await db.update(posts).set({ deletedAt: null }).where(inArray(posts.id, ids)).returning({ slug: posts.slug, status: posts.status });
  bumpPosts();
  pingPublishedPosts(rows);
}

export async function destroyPosts(ids: string[]) {
  await requireAdmin();
  if (!ids.length) return;
  await db.delete(posts).where(inArray(posts.id, ids));
  bumpPosts();
}

export async function setPostsStatus(ids: string[], status: "published" | "draft") {
  await requireUser();
  if (!ids.length) return;
  const update: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "published") update.publishedAt = new Date();
  const rows = await db.update(posts).set(update).where(inArray(posts.id, ids)).returning({ slug: posts.slug });
  bumpPosts();
  pingPostsIndexNow(rows.map((r) => r.slug));
}

export async function duplicatePost(id: string) {
  const user = await requireUser();
  const [src] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!src) throw new Error("Post not found");
  const base = `${src.slug}-copy`;
  let slug = base;
  for (let i = 2; ; i++) {
    const exists = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
    if (!exists.length) break;
    slug = `${base}-${i}`;
  }
  await db.insert(posts).values({
    title: `${src.title} (copy)`,
    slug,
    body: src.body,
    excerpt: src.excerpt,
    categoryId: src.categoryId,
    tags: src.tags,
    heroImageUrl: src.heroImageUrl,
    heroImageAlt: src.heroImageAlt,
    authorId: user.id,
    status: "draft",
    metaTitle: src.metaTitle,
    metaDescription: src.metaDescription,
    noindex: src.noindex,
  });
  bumpPosts();
}

/* ============================== Categories ============================== */

export async function createCategory(name: string): Promise<{ id: string; name: string; slug: string }> {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");
  const slug = slugify(trimmed);
  const [existing] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  if (existing) return existing;
  const [row] = await db.insert(categories).values({ name: trimmed, slug }).returning();
  bumpPosts();
  revalidatePath("/admin/categories");
  return row;
}

export async function renameCategory(id: string, name: string) {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");
  await db.update(categories).set({ name: trimmed, slug: slugify(trimmed) }).where(eq(categories.id, id));
  bumpPosts();
  revalidatePath("/admin/categories");
}

export async function deleteCategory(id: string) {
  await requireUser();
  // posts.categoryId has onDelete: set null - posts keep existing, just uncategorized
  await db.delete(categories).where(eq(categories.id, id));
  bumpPosts();
  revalidatePath("/admin/categories");
}

export async function listCategories() {
  await requireUser();
  return db.select().from(categories).orderBy(categories.name);
}

// Pages available to pick as a destination (e.g. a thank-you page). Returns the
// public path and title for each live page, so marketers select instead of typing.
export async function listPagesForPicker() {
  await requireUser();
  const rows = await db
    .select({ slug: pages.slug, title: pages.title, status: pages.status })
    .from(pages)
    .where(isNull(pages.deletedAt))
    .orderBy(pages.title);
  return rows.map((p) => ({
    path: p.slug === "home" ? "/" : `/${p.slug}`,
    title: p.title,
    status: p.status,
  }));
}

/* ============================== Tags ============================== */

export async function renameTag(from: string, to: string) {
  await requireUser();
  const target = to.trim();
  if (!target) throw new Error("Tag name is required");
  const rows = await db.select({ id: posts.id, tags: posts.tags }).from(posts);
  for (const row of rows) {
    if (!row.tags.includes(from)) continue;
    const next = [...new Set(row.tags.map((t) => (t === from ? target : t)))];
    await db.update(posts).set({ tags: next }).where(eq(posts.id, row.id));
  }
  bumpPosts();
  revalidatePath("/admin/tags");
}

export async function deleteTag(tag: string) {
  await requireUser();
  const rows = await db.select({ id: posts.id, tags: posts.tags }).from(posts);
  for (const row of rows) {
    if (!row.tags.includes(tag)) continue;
    await db.update(posts).set({ tags: row.tags.filter((t) => t !== tag) }).where(eq(posts.id, row.id));
  }
  bumpPosts();
  revalidatePath("/admin/tags");
}

/* ============================== Redirects ============================== */

function normalizePath(path: string): string {
  let p = path.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

export async function createRedirect(data: { fromPath: string; toPath: string; permanent: boolean }) {
  const user = await requireUser();
  const fromPath = normalizePath(data.fromPath);
  // External (or protocol-relative) targets can be used for phishing under the
  // site's trusted domain, so only admins may create off-site redirects.
  const raw = data.toPath.trim();
  const isExternal = /^https?:\/\//i.test(raw) || raw.startsWith("//");
  if (isExternal && user.role !== "admin") {
    throw new Error("Only admins can create redirects to an external URL.");
  }
  const toPath = isExternal ? raw : normalizePath(data.toPath);
  if (fromPath === toPath) throw new Error("A redirect cannot point to itself.");
  await db
    .insert(redirects)
    .values({ fromPath, toPath, permanent: data.permanent })
    .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath, permanent: data.permanent } });
  revalidateTag(CACHE_TAGS.redirects, "max");
  revalidatePath("/admin/redirects");
}

export async function deleteRedirect(id: string) {
  await requireUser();
  await db.delete(redirects).where(eq(redirects.id, id));
  revalidateTag(CACHE_TAGS.redirects, "max");
  revalidatePath("/admin/redirects");
}

/* ========================== Contact forms ========================== */
/* Reusable forms built under /admin/contacts and dropped onto pages via the
   contact-form block's form picker. */

export type ContactFormInput = {
  name: string;
  fields: ContactField[];
  submitLabel: string;
  receiverEmail: string;
  formName: string;
  successMode: "inline" | "redirect";
  successMessage: string;
  successPath: string;
};

// Trim and sanitise the builder payload. Field keys are forced to a safe slug
// (lowercase, no spaces) so they map cleanly onto submission data.
function cleanContactForm(input: ContactFormInput): ContactFormInput {
  const name = input.name.trim();
  if (!name) throw new Error("Give the form a name.");
  const fields = (input.fields ?? [])
    .map((f) => ({
      label: f.label.trim(),
      name: (f.name || f.label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      type: f.type,
      required: !!f.required,
      options: f.options ?? "",
      fullWidth: !!f.fullWidth,
    }))
    .filter((f) => f.label && f.name);
  if (fields.length === 0) throw new Error("Add at least one field.");
  const seen = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.name)) throw new Error(`Two fields share the key "${f.name}". Field keys must be unique.`);
    seen.add(f.name);
  }
  return {
    name,
    fields,
    submitLabel: input.submitLabel.trim() || "Send message",
    receiverEmail: input.receiverEmail.trim(),
    formName: input.formName.trim() || name,
    successMode: input.successMode === "redirect" ? "redirect" : "inline",
    successMessage: input.successMessage.trim() || "Thanks. We'll be in touch shortly.",
    successPath: input.successPath.trim() || "/thank-you",
  };
}

// Forms are an array under the "contactForms" settings key. Read/write the
// whole array (read fresh, not via the cached query, so concurrent edits aren't
// clobbered by stale cache).
async function readContactForms(): Promise<ContactForm[]> {
  const rows = await db.select().from(settings).where(eq(settings.key, CONTACT_FORMS_KEY)).limit(1);
  return (rows[0]?.value as ContactForm[] | undefined) ?? [];
}
async function writeContactForms(forms: ContactForm[]) {
  await db
    .insert(settings)
    .values({ key: CONTACT_FORMS_KEY, value: forms })
    .onConflictDoUpdate({ target: settings.key, set: { value: forms } });
}

export async function createContactForm(input: ContactFormInput) {
  await requireUser();
  const form: ContactForm = { id: randomUUID(), ...cleanContactForm(input) };
  await writeContactForms([...(await readContactForms()), form]);
  bumpContactForms();
  return form;
}

export async function updateContactForm(id: string, input: ContactFormInput) {
  await requireUser();
  const data = cleanContactForm(input);
  const forms = await readContactForms();
  await writeContactForms(forms.map((f) => (f.id === id ? { id, ...data } : f)));
  bumpContactForms();
}

export async function deleteContactForm(id: string) {
  await requireUser();
  const forms = await readContactForms();
  await writeContactForms(forms.filter((f) => f.id !== id));
  bumpContactForms();
}

// Lightweight list for the block's form picker dropdown.
export async function listContactFormsForPicker() {
  await requireUser();
  return (await readContactForms())
    .map((f) => ({ id: f.id, name: f.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Full form for the editor-canvas preview (the canvas can't run getData).
export async function getContactFormForPreview(id: string) {
  await requireUser();
  return (await readContactForms()).find((f) => f.id === id) ?? null;
}

export async function deleteContactSubmission(id: string) {
  await requireUser();
  await db.delete(contactSubmissions).where(eq(contactSubmissions.id, id));
  revalidatePath("/admin/contacts/submissions");
}

/* ============================== Media ============================== */
/* The library reads straight from Cloudinary, so anything on the instance
   (CMS upload or CLI agent) appears. Deleting moves the item to a soft
   trash (media_trash); the Cloudinary asset stays put until the daily cron
   purges rows older than MEDIA_TRASH_TTL_DAYS, then deletes it for good. */

type TrashInput = {
  publicId: string;
  resourceType?: string;
  url: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
};

export async function updateMediaAlt(publicId: string, alt: string, resourceType = "image") {
  await requireUser();
  await setCloudinaryAlt(publicId, alt, resourceType);
}

/** Move one item to the media trash. */
export async function trashMedia(item: TrashInput) {
  await requireUser();
  await db
    .insert(mediaTrash)
    .values({
      publicId: item.publicId,
      resourceType: item.resourceType ?? "image",
      url: item.url,
      name: item.name,
      mimeType: item.mimeType ?? null,
      size: item.size ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      alt: item.alt ?? null,
      trashedAt: new Date(),
    })
    .onConflictDoUpdate({ target: mediaTrash.publicId, set: { trashedAt: new Date() } });
  revalidatePath("/admin/media");
  revalidatePath("/admin/media/trash");
}

/** Move several items to the media trash. */
export async function trashMediaItems(items: TrashInput[]) {
  await requireUser();
  if (!items.length) return;
  for (const it of items) await trashMedia(it);
}

/** Restore a trashed item (just forget it was trashed; the asset never moved). */
export async function restoreMedia(publicId: string) {
  await requireUser();
  await db.delete(mediaTrash).where(eq(mediaTrash.publicId, publicId));
  revalidatePath("/admin/media");
  revalidatePath("/admin/media/trash");
}

/** Permanently delete now: remove from Cloudinary and drop the trash row. */
export async function purgeMedia(publicId: string, resourceType = "image") {
  await requireUser();
  await deleteCloudinaryMedia(publicId, resourceType);
  await db.delete(mediaTrash).where(eq(mediaTrash.publicId, publicId));
  revalidatePath("/admin/media/trash");
}

/** Empty the whole media trash now (admin only). */
export async function emptyMediaTrash() {
  await requireAdmin();
  const rows = await db.select().from(mediaTrash);
  for (const row of rows) {
    await deleteCloudinaryMedia(row.publicId, row.resourceType).catch(() => {});
  }
  await db.delete(mediaTrash);
  revalidatePath("/admin/media/trash");
}

export async function listMedia() {
  await requireUser();
  return listCloudinaryMedia();
}

/* ============================== Menus ============================== */

export async function saveMenu(name: string, items: MenuItem[]) {
  await requireUser();
  await db
    .insert(menus)
    .values({ name, items })
    .onConflictDoUpdate({ target: menus.name, set: { items } });
  revalidateTag(CACHE_TAGS.menus, "max");
  revalidatePath("/", "layout");
}

/* ============================== Settings ============================== */

export async function saveSettings(values: Record<string, unknown>) {
  await requireAdmin();
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  revalidateTag(CACHE_TAGS.settings, "max");
  revalidatePath("/", "layout");
}

/** Save Cloudinary credentials into settings. The API secret is write-only:
 *  an empty value leaves the stored secret untouched (so it never round-trips
 *  to the browser). Admin only. */
export async function saveCloudinaryConfig(values: { cloudName: string; apiKey: string; apiSecret: string }) {
  await requireAdmin();
  const { CLOUDINARY_KEYS } = await import("@/lib/cloudinary-config");
  const writes: Record<string, string> = {
    [CLOUDINARY_KEYS.cloudName]: values.cloudName.trim(),
    [CLOUDINARY_KEYS.apiKey]: values.apiKey.trim(),
  };
  if (values.apiSecret.trim()) writes[CLOUDINARY_KEYS.apiSecret] = values.apiSecret.trim();
  for (const [key, value] of Object.entries(writes)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  revalidatePath("/admin/media");
  revalidatePath("/admin/settings");
  return { ok: true as const };
}

/** Save optional integration config (Resend email + media options) into
 *  settings. The Resend API key is write-only: empty leaves it untouched.
 *  Admin only. Env vars still take precedence at runtime. */
export async function saveIntegrations(values: {
  emailFrom: string;
  emailTo: string;
  resendApiKey: string;
  cloudinaryFolder: string;
  mediaTrashTtlDays: string;
}) {
  await requireAdmin();
  const { RESEND_KEYS, MEDIA_KEYS } = await import("@/lib/integration-config");
  const writes: Record<string, string> = {
    [RESEND_KEYS.from]: values.emailFrom.trim(),
    [RESEND_KEYS.to]: values.emailTo.trim(),
    [MEDIA_KEYS.folder]: values.cloudinaryFolder.trim(),
    [MEDIA_KEYS.trashTtl]: values.mediaTrashTtlDays.trim(),
  };
  if (values.resendApiKey.trim()) writes[RESEND_KEYS.apiKey] = values.resendApiKey.trim();
  for (const [key, value] of Object.entries(writes)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  revalidatePath("/admin/settings");
  return { ok: true as const };
}

/* ============================== Users ============================== */

export async function createUser(data: { email: string; name: string; password: string; role: "admin" | "editor" }) {
  await requireAdmin();
  if (data.password.length < 8) throw new Error("Password must be at least 8 characters.");
  const email = data.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(data.password, 10);
  await db.insert(users).values({ email, name: data.name, passwordHash, role: data.role });
  revalidatePath("/admin/users");
}

export async function updateUserRole(id: string, role: "admin" | "editor") {
  const me = await requireAdmin();
  if (id === me.id) throw new Error("You cannot change your own role.");
  if (role === "editor") {
    const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), ne(users.id, id)));
    if (admins.length === 0) throw new Error("Cannot demote the last admin.");
  }
  await db.update(users).set({ role }).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  const me = await requireAdmin();
  if (id === me.id) throw new Error("You cannot delete yourself.");
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return;
  if (target.role === "admin") {
    const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), ne(users.id, id)));
    if (admins.length === 0) throw new Error("Cannot delete the last admin.");
  }
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function resetUserPassword(id: string, password: string) {
  await requireAdmin();
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// Any signed-in user (admin or editor) can change their own password.
export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const me = await requireUser();
  if (newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
  const [user] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  if (!user) throw new Error("Account not found.");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error("Current password is incorrect.");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, me.id));
  return { ok: true as const };
}

// Any signed-in user can set or clear their own profile image.
export async function updateOwnProfileImage(image: string | null) {
  const me = await requireUser();
  const value = image && image.trim() ? image.trim() : null;
  await db.update(users).set({ image: value }).where(eq(users.id, me.id));
  revalidatePath("/admin", "layout");
  return { ok: true as const, image: value };
}

/* ============================== API keys ============================== */

export async function createApiKey(name: string) {
  await requireAdmin();
  const raw = `cms_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(raw).digest("hex");
  await db.insert(apiKeys).values({ name, keyHash });
  revalidatePath("/admin/settings");
  // Returned once - shown to the user a single time, only the hash is stored.
  return raw;
}

export async function deleteApiKey(id: string) {
  await requireAdmin();
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  revalidatePath("/admin/settings");
}

/* ============================== MCP connector ============================== */

// The connector token is auto-provisioned (see src/lib/mcp/token.ts). These
// actions rotate it, turn it off, or turn it back on. rotate doubles as
// "enable" since it clears the disabled flag.
export async function rotateMcpToken() {
  await requireAdmin();
  const token = await regenerateMcpToken();
  revalidatePath("/admin/settings");
  return token;
}

export async function revokeMcpTokenAction() {
  await requireAdmin();
  await revokeMcpToken();
  revalidatePath("/admin/settings");
}
