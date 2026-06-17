import Link from "next/link";
import { getLivePosts, getCategories } from "@/lib/queries";
import { formatDate } from "@/lib/content";

export async function BlogList({ category, tag }: { category?: string; tag?: string }) {
  const [all, allCategories] = await Promise.all([getLivePosts(), getCategories()]);

  // Only offer categories that actually have live posts
  const usedSlugs = new Set(all.map((p) => p.categorySlug).filter(Boolean));
  const filterCategories = allCategories.filter((c) => usedSlugs.has(c.slug));

  let posts = all;
  if (category) posts = posts.filter((p) => p.categorySlug === category);
  if (tag) posts = posts.filter((p) => p.tags.includes(tag));

  return (
    <div className="cms-container">
      <div className="blog-hero">
        <h1>Blog</h1>
        <p>Guides, comparisons, and practical notes on using CLI agents.</p>
        {filterCategories.length > 0 && (
          <nav className="cms-hero-actions" style={{ justifyContent: "flex-start", marginTop: "1.25rem" }}>
            <Link className={`cms-btn ${!category ? "cms-btn-primary" : "cms-btn-ghost"}`} href="/blog">
              All
            </Link>
            {filterCategories.map((c) => (
              <Link
                key={c.id}
                className={`cms-btn ${category === c.slug ? "cms-btn-primary" : "cms-btn-ghost"}`}
                href={`/blog?category=${encodeURIComponent(c.slug)}`}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}
        {tag && (
          <p style={{ marginTop: "1rem" }}>
            Showing posts tagged <strong>#{tag}</strong> · <Link href="/blog">clear</Link>
          </p>
        )}
      </div>
      {posts.length === 0 ? (
        <p className="cms-muted" style={{ paddingBottom: "4rem" }}>
          No posts yet.
        </p>
      ) : (
        <div className="cms-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", paddingBottom: "4rem" }}>
          {posts.map((post) => (
            <Link className="cms-card cms-post-card" key={post.slug} href={`/blog/${post.slug}`}>
              {post.heroImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.heroImageUrl} alt={post.heroImageAlt ?? ""} />
              )}
              {post.category && <span className="cms-post-cat">{post.category}</span>}
              <h3>{post.title}</h3>
              {post.excerpt && <p>{post.excerpt}</p>}
              <time>{formatDate(post.publishedAt ?? post.publishAt)}</time>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
