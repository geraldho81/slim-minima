import type { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { getPostBySlug, getRedirect, getSettings } from "@/lib/queries";
import { isLive, formatDate, readingTime } from "@/lib/content";
import { auth } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { JsonLd, articleSchema, breadcrumbSchema, parseJsonLd } from "@/lib/jsonld";
import { sanitizeContentHtml } from "@/lib/sanitize";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

async function resolvePost(props: Props) {
  const { slug } = await props.params;
  const { preview } = await props.searchParams;
  const row = await getPostBySlug(slug);
  if (!row) return null;
  if (!isLive(row.post.status, row.post.publishAt)) {
    if (preview !== "1") return null;
    const session = await auth();
    if (!session?.user) return null;
  }
  return row;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const row = await resolvePost(props);
  if (!row) return {};
  const settings = await getSettings();
  const title = row.post.metaTitle || `${row.post.title} | ${settings.siteName}`;
  const description = row.post.metaDescription || row.post.excerpt || undefined;
  const ogImage = row.post.heroImageUrl || settings.defaultOgImage || undefined;
  const canonical = `${siteUrl()}/blog/${row.post.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    ...(row.post.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function PostPage(props: Props) {
  const row = await resolvePost(props);
  if (!row) {
    const { slug } = await props.params;
    const hit = await getRedirect(`/blog/${slug}`);
    if (hit) {
      if (hit.permanent) permanentRedirect(hit.toPath);
      redirect(hit.toPath);
    }
    notFound();
  }
  const { post, authorName, categoryName, categorySlug } = row;
  const settings = await getSettings();
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
      <div className="cms-prose cms-narrow" style={{ margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(post.body) }} />
      {post.tags.length > 0 && (
        <div className="cms-narrow" style={{ margin: "2rem auto 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
