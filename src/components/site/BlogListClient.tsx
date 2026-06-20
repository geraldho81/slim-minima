"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export type PostCard = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  categorySlug: string | null;
  tags: string[];
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  date: string;
};

export type FilterCategory = { id: string; slug: string; name: string };

/**
 * Renders the full post list as static HTML (every card is server-rendered, so
 * crawlers see them all) and filters by category/tag on the client. Reading the
 * filter from the URL in an effect - rather than from searchParams during
 * render - keeps this page statically cacheable at the edge.
 */
export function BlogListClient({ posts, categories }: { posts: PostCard[]; categories: FilterCategory[] }) {
  // Start unfiltered so the server render (and the static HTML crawlers see)
  // lists every post. The active filter is read from the URL after mount.
  const [{ category, tag }, setFilter] = useState({ category: "", tag: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Reading the URL is only possible on the client, so this sync has to happen
    // in an effect. Keeping it here is what lets the page stay static.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilter({ category: params.get("category") ?? "", tag: params.get("tag") ?? "" });
  }, []);

  function selectCategory(slug: string) {
    setFilter({ category: slug, tag: "" });
    const qs = slug ? `?category=${encodeURIComponent(slug)}` : "";
    window.history.replaceState(null, "", `/blog${qs}`);
  }

  function clearTag() {
    setFilter({ category: "", tag: "" });
    window.history.replaceState(null, "", "/blog");
  }

  let shown = posts;
  if (category) shown = shown.filter((p) => p.categorySlug === category);
  if (tag) shown = shown.filter((p) => p.tags.includes(tag));

  return (
    <div className="cms-container">
      <div className="blog-hero">
        <h1>Blog</h1>
        <p>Guides, comparisons, and practical notes on using CLI agents.</p>
        {categories.length > 0 && (
          <nav className="cms-hero-actions" style={{ justifyContent: "flex-start", marginTop: "1.25rem" }}>
            <Link
              className={`cms-btn ${!category ? "cms-btn-primary" : "cms-btn-ghost"}`}
              href="/blog"
              onClick={(e) => { e.preventDefault(); selectCategory(""); }}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                className={`cms-btn ${category === c.slug ? "cms-btn-primary" : "cms-btn-ghost"}`}
                href={`/blog?category=${encodeURIComponent(c.slug)}`}
                onClick={(e) => { e.preventDefault(); selectCategory(c.slug); }}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}
        {tag && (
          <p style={{ marginTop: "1rem" }}>
            Showing posts tagged <strong>#{tag}</strong> ·{" "}
            <Link href="/blog" onClick={(e) => { e.preventDefault(); clearTag(); }}>clear</Link>
          </p>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="cms-muted" style={{ paddingBottom: "4rem" }}>
          No posts yet.
        </p>
      ) : (
        <div className="cms-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", paddingBottom: "4rem" }}>
          {shown.map((post) => (
            <Link className="cms-card cms-post-card" key={post.slug} href={`/blog/${post.slug}`}>
              {post.heroImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.heroImageUrl} alt={post.heroImageAlt ?? ""} />
              )}
              {post.category && <span className="cms-post-cat">{post.category}</span>}
              <h3>{post.title}</h3>
              {post.excerpt && <p>{post.excerpt}</p>}
              <time>{post.date}</time>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
