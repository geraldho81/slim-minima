import type { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { BlogList } from "@/components/site/BlogList";
import { getPageBySlug, getRedirect, getSettings } from "@/lib/queries";
import { isLive } from "@/lib/content";
import { auth } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { JsonLd, websiteSchema, faqSchema, parseJsonLd } from "@/lib/jsonld";
import { collectFaqItems } from "@/lib/block-text";

type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ preview?: string; category?: string; tag?: string }>;
};

// The page slug that serves at "/", per the homePage setting. "blog" means the
// blog listing renders at root instead of a page.
async function homePageSlug(): Promise<string> {
  const settings = await getSettings();
  return settings.homePage || "home";
}

async function resolvePage(props: Props) {
  const { slug } = await props.params;
  const { preview } = await props.searchParams;
  const isRoot = !slug?.length;
  const effectiveSlug = isRoot ? await homePageSlug() : slug.join("/");
  const page = await getPageBySlug(effectiveSlug);
  if (!page) return null;
  if (!isLive(page.status, page.publishAt)) {
    // Drafts are visible only to signed-in editors with ?preview=1
    if (preview !== "1") return null;
    const session = await auth();
    if (!session?.user) return null;
  }
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

  const page = await resolvePage(props);
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
  const { category, tag } = await props.searchParams;
  const isRoot = !slug?.length;
  const settings = await getSettings();

  // Blog set as the home page: render the listing at root
  if (isRoot && settings.homePage === "blog") {
    return (
      <>
        <JsonLd data={websiteSchema(settings)} />
        <BlogList category={category} tag={tag} />
      </>
    );
  }

  // A page set as the home page is canonical at "/": redirect its own slug there
  if (!isRoot && settings.homePage !== "blog" && slug.join("/") === settings.homePage) {
    permanentRedirect("/");
  }

  const page = await resolvePage(props);
  if (!page) {
    // No page at this path - check the redirect table before 404ing
    const hit = await getRedirect(`/${slug?.length ? slug.join("/") : ""}`);
    if (hit) {
      if (hit.permanent) permanentRedirect(hit.toPath);
      redirect(hit.toPath);
    }
    notFound();
  }

  const faqItems = collectFaqItems(page.blocks);
  const customSchemaData = parseJsonLd(page.customSchema);

  return (
    <>
      {isRoot && <JsonLd data={websiteSchema(settings)} />}
      {faqItems.length > 0 && <JsonLd data={faqSchema(faqItems)} />}
      {customSchemaData && <JsonLd data={customSchemaData} />}
      <BlockRenderer blocks={page.blocks} />
    </>
  );
}
