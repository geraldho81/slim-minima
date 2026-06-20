import { unstable_cache } from "next/cache";
import { eq, desc, inArray, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pages, posts, menus, settings, users, categories, redirects } from "@/db/schema";
import type { ContactForm } from "@/db/schema";
import { isLive } from "@/lib/content";

export const CACHE_TAGS = {
  pages: "cms-pages",
  posts: "cms-posts",
  menus: "cms-menus",
  settings: "cms-settings",
  redirects: "cms-redirects",
  contactForms: "cms-contact-forms",
} as const;

// During a build with no database configured (the framework repo itself, which
// ships no .env.local), the public pages are still statically prerendered.
// Without a connection string there is nothing to read, so reads return safe
// empties instead of throwing. Deployed sites always set DATABASE_URL, so this
// guard never fires at runtime and real connection errors still surface.
const hasDb = () => !!process.env.DATABASE_URL;

export const getPageBySlug = (slug: string) =>
  unstable_cache(
    async () => {
      if (!hasDb()) return null;
      const rows = await db
        .select()
        .from(pages)
        .where(and(eq(pages.slug, slug), isNull(pages.deletedAt)))
        .limit(1);
      return rows[0] ?? null;
    },
    ["page", slug],
    // revalidate: 60 keeps the site fresh even when content changes outside
    // the app (CLI writes can't invalidate the Next cache directly)
    { tags: [CACHE_TAGS.pages], revalidate: 60 }
  )();

export const getLivePages = unstable_cache(
  async () => {
    if (!hasDb()) return [];
    const rows = await db
      .select()
      .from(pages)
      .where(and(inArray(pages.status, ["published", "scheduled"]), isNull(pages.deletedAt)))
      .orderBy(pages.slug);
    return rows.filter((p) => isLive(p.status, p.publishAt));
  },
  ["live-pages"],
  { tags: [CACHE_TAGS.pages], revalidate: 60 }
);

export const getLivePosts = unstable_cache(
  async () => {
    if (!hasDb()) return [];
    const rows = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        category: categories.name,
        categorySlug: categories.slug,
        tags: posts.tags,
        heroImageUrl: posts.heroImageUrl,
        heroImageAlt: posts.heroImageAlt,
        status: posts.status,
        publishAt: posts.publishAt,
        publishedAt: posts.publishedAt,
        updatedAt: posts.updatedAt,
        authorName: users.name,
        noindex: posts.noindex,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(and(inArray(posts.status, ["published", "scheduled"]), isNull(posts.deletedAt)))
      .orderBy(desc(posts.publishedAt));
    return rows
      .filter((p) => isLive(p.status, p.publishAt))
      .sort(
        (a, b) =>
          new Date(b.publishedAt ?? b.publishAt ?? 0).getTime() -
          new Date(a.publishedAt ?? a.publishAt ?? 0).getTime()
      );
  },
  ["live-posts"],
  { tags: [CACHE_TAGS.posts], revalidate: 60 }
);

export const getPostBySlug = (slug: string) =>
  unstable_cache(
    async () => {
      if (!hasDb()) return null;
      const rows = await db
        .select({
          post: posts,
          authorName: users.name,
          categoryName: categories.name,
          categorySlug: categories.slug,
        })
        .from(posts)
        .leftJoin(users, eq(posts.authorId, users.id))
        .leftJoin(categories, eq(posts.categoryId, categories.id))
        .where(and(eq(posts.slug, slug), isNull(posts.deletedAt)))
        .limit(1);
      return rows[0] ?? null;
    },
    ["post", slug],
    { tags: [CACHE_TAGS.posts], revalidate: 60 }
  )();

export const getCategories = unstable_cache(
  async () => (hasDb() ? db.select().from(categories).orderBy(categories.name) : []),
  ["categories"],
  { tags: [CACHE_TAGS.posts], revalidate: 60 }
);

export const getRedirect = (fromPath: string) =>
  unstable_cache(
    async () => {
      if (!hasDb()) return null;
      const rows = await db.select().from(redirects).where(eq(redirects.fromPath, fromPath)).limit(1);
      return rows[0] ?? null;
    },
    ["redirect", fromPath],
    { tags: [CACHE_TAGS.redirects], revalidate: 60 }
  )();

export const getMenu = (name: string) =>
  unstable_cache(
    async () => {
      if (!hasDb()) return [];
      const rows = await db.select().from(menus).where(eq(menus.name, name)).limit(1);
      return rows[0]?.items ?? [];
    },
    ["menu", name],
    { tags: [CACHE_TAGS.menus], revalidate: 60 }
  )();

// Reusable forms live as an array under the "contactForms" settings key - no
// dedicated table, so the feature drops into any install without a migration.
export const CONTACT_FORMS_KEY = "contactForms";

export const getContactForms = unstable_cache(
  async (): Promise<ContactForm[]> => {
    if (!hasDb()) return [];
    const rows = await db.select().from(settings).where(eq(settings.key, CONTACT_FORMS_KEY)).limit(1);
    return (rows[0]?.value as ContactForm[] | undefined) ?? [];
  },
  ["contact-forms"],
  { tags: [CACHE_TAGS.contactForms], revalidate: 60 }
);

export async function getContactFormById(id: string): Promise<ContactForm | null> {
  const all = await getContactForms();
  return all.find((f) => f.id === id) ?? null;
}

export type SiteSettings = {
  siteName: string;
  tagline: string;
  logoUrl: string;
  defaultOgImage: string;
  footerText: string;
  social: { label: string; href: string }[];
  gtmId: string;
  homePage: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Slim Minima",
  tagline: "",
  logoUrl: "",
  defaultOgImage: "",
  footerText: "",
  social: [],
  gtmId: "",
  homePage: "home",
};

export const getSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    if (!hasDb()) return DEFAULT_SETTINGS;
    const rows = await db.select().from(settings);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULT_SETTINGS, ...(map as Partial<SiteSettings>) };
  },
  ["site-settings"],
  { tags: [CACHE_TAGS.settings], revalidate: 60 }
);
