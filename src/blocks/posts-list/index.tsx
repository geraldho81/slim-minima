import { z } from "zod";
import { defineBlock } from "@/blocks/types";
import { formatDate } from "@/lib/content";

const schema = z.object({
  heading: z.string(),
  limit: z.number(),
  category: z.string(),
  showExcerpt: z.boolean(),
});

type Props = z.infer<typeof schema>;

type PostCard = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  publishedAt: Date | string | null;
};

export default defineBlock<Props>({
  type: "posts-list",
  label: "Blog posts",
  description: "Shows the latest published blog posts",
  icon: "✎",
  schema,
  defaults: { heading: "From the blog", limit: 3, category: "", showExcerpt: true },
  fields: [
    { kind: "text", name: "heading", label: "Heading" },
    { kind: "number", name: "limit", label: "How many posts", min: 1, max: 12 },
    { kind: "text", name: "category", label: "Filter by category (optional)" },
    { kind: "toggle", name: "showExcerpt", label: "Show excerpts" },
  ],
  // Resolved server-side only; the editor canvas uses Preview instead.
  getData: async (props) => {
    const { getLivePosts } = await import("@/lib/queries");
    const all = await getLivePosts();
    const wanted = props.category.toLowerCase();
    const filtered = props.category
      ? all.filter((p) => p.category?.toLowerCase() === wanted || p.categorySlug?.toLowerCase() === wanted)
      : all;
    return filtered.slice(0, props.limit) as PostCard[];
  },
  Render: (p) => {
    const items = (p.ctx?.data as PostCard[] | undefined) ?? [];
    return (
      <section className="cms-container cms-block" data-reveal>
        {p.heading && (
          <div className="cms-section-head">
            <h2>{p.heading}</h2>
          </div>
        )}
        {items.length === 0 ? (
          <p className="cms-muted">No published posts yet.</p>
        ) : (
          <div className="cms-grid" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)` }}>
            {items.map((post) => (
              <a className="cms-card cms-post-card" key={post.slug} href={`/blog/${post.slug}`}>
                {post.heroImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.heroImageUrl} alt={post.heroImageAlt ?? ""} />
                )}
                {post.category && <span className="cms-post-cat">{post.category}</span>}
                <h3>{post.title}</h3>
                {p.showExcerpt && post.excerpt && <p>{post.excerpt}</p>}
                <time>{formatDate(post.publishedAt)}</time>
              </a>
            ))}
          </div>
        )}
      </section>
    );
  },
  Preview: (p) => (
    <section className="cms-container cms-block">
      {p.heading && (
        <div className="cms-section-head">
          <h2>{p.heading}</h2>
        </div>
      )}
      <div className="cms-grid" style={{ gridTemplateColumns: `repeat(${Math.min(p.limit, 3)}, 1fr)` }}>
        {Array.from({ length: Math.min(p.limit, 3) }, (_, i) => (
          <div className="cms-card cms-post-card" key={i}>
            <div className="cms-post-thumb-placeholder" />
            <h3>Blog post title</h3>
            {p.showExcerpt && <p>The latest published posts appear here on the live site.</p>}
          </div>
        ))}
      </div>
    </section>
  ),
});
