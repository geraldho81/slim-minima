import type { MetadataRoute } from "next";
import { getLivePages, getLivePosts, getSettings } from "@/lib/queries";
import { siteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  try {
    const [pages, posts, settings] = await Promise.all([getLivePages(), getLivePosts(), getSettings()]);
    const homePage = settings.homePage || "home";
    const indexablePages = pages.filter((p) => !p.noindex);
    const indexablePosts = posts.filter((p) => !p.noindex);
    const blogModified = indexablePosts.reduce<Date | undefined>(
      (latest, p) => (p.updatedAt && (!latest || p.updatedAt > latest) ? p.updatedAt : latest),
      undefined
    );
    const blogIsHome = homePage === "blog";

    return [
      // When the blog is the home page, "/" is the canonical home.
      ...(blogIsHome
        ? [
            {
              url: base,
              lastModified: blogModified ?? new Date(),
              changeFrequency: "weekly" as const,
              priority: 1,
            },
          ]
        : []),
      ...indexablePages.map((p) => ({
        // The home page lives at "/"; its own slug redirects there, so list it once.
        url: p.slug === homePage ? base : `${base}/${p.slug}`,
        lastModified: p.updatedAt ?? undefined,
        changeFrequency: "weekly" as const,
        priority: p.slug === homePage ? 1 : 0.8,
      })),
      {
        url: `${base}/blog`,
        lastModified: blogModified ?? new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.9,
      },
      ...indexablePosts.map((p) => ({
        url: `${base}/blog/${p.slug}`,
        lastModified: p.updatedAt ?? undefined,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return [{ url: base, lastModified: new Date() }];
  }
}
