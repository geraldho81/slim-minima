import { getLivePosts, getCategories } from "@/lib/queries";
import { formatDate } from "@/lib/content";
import { BlogListClient, type PostCard, type FilterCategory } from "./BlogListClient";

export async function BlogList() {
  const [all, allCategories] = await Promise.all([getLivePosts(), getCategories()]);

  // Only offer categories that actually have live posts
  const usedSlugs = new Set(all.map((p) => p.categorySlug).filter(Boolean));
  const categories: FilterCategory[] = allCategories
    .filter((c) => usedSlugs.has(c.slug))
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name }));

  // Pre-format dates server-side so the client component takes plain strings.
  const posts: PostCard[] = all.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    categorySlug: p.categorySlug,
    tags: p.tags,
    heroImageUrl: p.heroImageUrl,
    heroImageAlt: p.heroImageAlt,
    date: formatDate(p.publishedAt ?? p.publishAt),
  }));

  return <BlogListClient posts={posts} categories={categories} />;
}
