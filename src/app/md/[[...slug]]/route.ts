import { getLivePages, getLivePosts, getPageBySlug, getPostBySlug, getSettings } from "@/lib/queries";
import { isLive } from "@/lib/content";
import { blocksToMarkdown, htmlToMarkdown } from "@/lib/block-text";
import { siteUrl } from "@/lib/site-url";
import type { Block } from "@/blocks/types";

// Edge-cached (ISR), like the HTML pages. These markdown mirrors are what AI
// agents fetch, so they should be just as fast and just as cacheable. Listing
// the live slugs opts the handler into the Full Route Cache; unlisted paths
// render on demand, then cache.
export const dynamic = "force-static";
export const revalidate = 60;

export async function generateStaticParams() {
  const [pages, posts] = await Promise.all([getLivePages(), getLivePosts()]);
  return [
    { slug: [] as string[] },
    ...pages.map((p) => ({ slug: p.slug.split("/") })),
    ...posts.map((p) => ({ slug: ["blog", p.slug] })),
  ];
}

function markdownResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // Markdown mirrors exist for LLMs; keep them out of search indexes
      "X-Robots-Tag": "noindex",
    },
  });
}

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_req: Request, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await ctx.params;
  const parts = slug ?? [];
  const settings = await getSettings();

  if (parts[0] === "blog" && parts[1]) {
    const row = await getPostBySlug(parts.slice(1).join("/"));
    if (!row || !isLive(row.post.status, row.post.publishAt)) return notFound();
    const { post, authorName, categoryName } = row;
    const meta = [
      post.publishedAt && `Published: ${new Date(post.publishedAt).toISOString().slice(0, 10)}`,
      authorName && `Author: ${authorName}`,
      categoryName && `Category: ${categoryName}`,
      post.tags.length && `Tags: ${post.tags.join(", ")}`,
    ]
      .filter(Boolean)
      .join("  \n");
    const body = [
      `# ${post.title}`,
      post.excerpt,
      meta,
      htmlToMarkdown(post.body),
      `---\n${settings.siteName} - ${siteUrl()}/blog/${post.slug}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    return markdownResponse(body);
  }

  const pageSlug = parts.length ? parts.join("/") : "home";
  const page = await getPageBySlug(pageSlug);
  if (!page || !isLive(page.status, page.publishAt)) return notFound();

  const url = page.slug === "home" ? siteUrl() : `${siteUrl()}/${page.slug}`;
  const body = [
    `# ${page.metaTitle || page.title}`,
    page.metaDescription,
    blocksToMarkdown(page.blocks as Block[]),
    `---\n${settings.siteName} - ${url}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return markdownResponse(body);
}
