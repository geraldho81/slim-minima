import type { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { BlogList } from "@/components/site/BlogList";
import { getLivePages, getPageBySlug, getRedirect, getSettings } from "@/lib/queries";
import { isLive } from "@/lib/content";
import { siteUrl } from "@/lib/site-url";
import { JsonLd, websiteSchema } from "@/lib/jsonld";
import { PageView } from "@/components/site/PageView";

// Edge-cached (ISR): the public page renders published content only, with no
// per-request reads (no searchParams, no auth), so Vercel serves it from cache.
// Admin edits invalidate it instantly via revalidateTag/revalidatePath; this is
// the periodic safety net. Draft preview lives at /preview, not here.
export const revalidate = 60;

// Opt the route into the Full Route Cache. The empty slug is the home page;
// every live page slug is listed so the edge can serve it. Unlisted paths
// render on demand, then cache.
export async function generateStaticParams() {
  const pages = await getLivePages();
  return [{ slug: [] as string[] }, ...pages.map((p) => ({ slug: p.slug.split("/") }))];
}

type Props = {
  params: Promise<{ slug?: string[] }>;
};

// The page slug that serves at "/", per the homePage setting. "blog" means the
// blog listing renders at root instead of a page.
async function homePageSlug(): Promise<string> {
  const settings = await getSettings();
  return settings.homePage || "home";
}

async function resolvePage(slugParts: string[] | undefined) {
  const isRoot = !slugParts?.length;
  const effectiveSlug = isRoot ? await homePageSlug() : slugParts.join("/");
  const page = await getPageBySlug(effectiveSlug);
  if (!page) return null;
  // Drafts are never served on the public route - they live at /preview.
  if (!isLive(page.status, page.publishAt)) return null;
  return page;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const isRoot = !slug?.length;
  const settings = await getSettings();

  if (isRoot && settings.homePage === "blog") {
    return {
      title: `${settings.siteName}`,
      description: settings.tagline || `Articles and guides from ${settings.siteName}`,
      alternates: { canonical: siteUrl() },
    };
  }

  const page = await resolvePage(slug);
  if (!page) return {};
  const title = page.metaTitle || `${page.title} | ${settings.siteName}`;
  const description = page.metaDescription || settings.tagline || undefined;
  const ogImage = page.ogImage || settings.defaultOgImage || undefined;
  const canonical = isRoot ? siteUrl() : `${siteUrl()}/${page.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    ...(page.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url: canonical,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function CmsPage(props: Props) {
  const { slug } = await props.params;
  const isRoot = !slug?.length;
  const settings = await getSettings();

  // Blog set as the home page: render the listing at root
  if (isRoot && settings.homePage === "blog") {
    return (
      <>
        <JsonLd data={websiteSchema(settings)} />
        <BlogList />
      </>
    );
  }

  // A page set as the home page is canonical at "/": redirect its own slug there
  if (!isRoot && settings.homePage !== "blog" && slug.join("/") === settings.homePage) {
    permanentRedirect("/");
  }

  const page = await resolvePage(slug);
  if (!page) {
    // No page at this path - check the redirect table before 404ing
    const hit = await getRedirect(`/${slug?.length ? slug.join("/") : ""}`);
    if (hit) {
      if (hit.permanent) permanentRedirect(hit.toPath);
      redirect(hit.toPath);
    }
    notFound();
  }

  return <PageView page={page} settings={settings} isHome={isRoot} />;
}
