import type { Metadata } from "next";
import { getSettings } from "@/lib/queries";
import { siteUrl } from "@/lib/site-url";
import { BlogList } from "@/components/site/BlogList";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: `Blog | ${settings.siteName}`,
    description: `Articles and guides from ${settings.siteName}`,
    alternates: { canonical: `${siteUrl()}/blog` },
  };
}

export default async function BlogIndex(props: { searchParams: Promise<{ category?: string; tag?: string }> }) {
  const { category, tag } = await props.searchParams;
  return <BlogList category={category} tag={tag} />;
}
