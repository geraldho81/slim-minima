import type { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { getLivePosts, getPostBySlug, getRedirect, getSettings } from "@/lib/queries";
import { isLive } from "@/lib/content";
import { siteUrl } from "@/lib/site-url";
import { PostView } from "@/components/site/PostView";

// Edge-cached (ISR), same as pages. Drafts are served at /preview, not here.
export const revalidate = 60;

// Opt the route into the Full Route Cache. Listing the live slugs lets Vercel
// serve them from the edge; new or unlisted posts render on demand, then cache.
export async function generateStaticParams() {
  const posts = await getLivePosts();
  return posts.map((p) => ({ slug: p.slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

async function resolvePost(slug: string) {
  const row = await getPostBySlug(slug);
  if (!row) return null;
  // Drafts are never served on the public route - they live at /preview.
  if (!isLive(row.post.status, row.post.publishAt)) return null;
  return row;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const row = await resolvePost(slug);
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
  const { slug } = await props.params;
  const row = await resolvePost(slug);
  if (!row) {
    const hit = await getRedirect(`/blog/${slug}`);
    if (hit) {
      if (hit.permanent) permanentRedirect(hit.toPath);
      redirect(hit.toPath);
    }
    notFound();
  }
  const settings = await getSettings();
  return <PostView row={row} settings={settings} />;
}
