import Link from "next/link";
import { formatDate, readingTime } from "@/lib/content";
import { siteUrl } from "@/lib/site-url";
import { JsonLd, articleSchema, breadcrumbSchema, parseJsonLd } from "@/lib/jsonld";
import { sanitizeContentHtml } from "@/lib/sanitize";
import type { Post } from "@/db/schema";
import type { SiteSettings } from "@/lib/queries";

export type PostRow = {
  post: Post;
  authorName: string | null;
  categoryName: string | null;
  categorySlug: string | null;
};

/**
 * Renders a blog post's article body plus its structured data. Shared by the
 * public (cached) route and the preview route.
 */
export function PostView({ row, settings }: { row: PostRow; settings: SiteSettings }) {
  const { post, authorName, categoryName, categorySlug } = row;
  const plain = post.body.replace(/<[^>]+>/g, " ");
  const base = siteUrl();
  const customSchemaData = parseJsonLd(post.customSchema);

  return (
    <article className="cms-container" style={{ paddingBottom: "3rem" }}>
      {customSchemaData && <JsonLd data={customSchemaData} />}
      <JsonLd
        data={articleSchema({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          heroImageUrl: post.heroImageUrl,
          publishedAt: post.publishedAt ?? post.publishAt,
          updatedAt: post.updatedAt,
          authorName,
          categoryName,
          tags: post.tags,
          siteName: settings.siteName,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: settings.siteName, url: base },
          { name: "Blog", url: `${base}/blog` },
          { name: post.title, url: `${base}/blog/${post.slug}` },
        ])}
      />
      <header className="post-header">
        {categoryName && (
          <Link className="cms-post-cat" href={`/blog?category=${encodeURIComponent(categorySlug ?? "")}`} style={{ textDecoration: "none" }}>
            {categoryName}
          </Link>
        )}
        <h1>{post.title}</h1>
        {post.excerpt && <p className="cms-muted" style={{ fontSize: "1.15rem" }}>{post.excerpt}</p>}
        <div className="post-meta">
          {authorName && <span>{authorName}</span>}
          {authorName && <span>·</span>}
          <time>{formatDate(post.publishedAt ?? post.publishAt)}</time>
          <span>·</span>
          <span>{readingTime(plain)}</span>
        </div>
      </header>
      {post.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="post-hero-img" src={post.heroImageUrl} alt={post.heroImageAlt ?? ""} />
      )}
      <div className="cms-prose post-body" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(post.body) }} />
      {post.tags.length > 0 && (
        <div className="post-body" style={{ margin: "2rem 0 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {post.tags.map((tag) => (
            <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="cms-btn cms-btn-ghost" style={{ padding: "0.3rem 0.9rem", fontSize: "0.8rem" }}>
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
