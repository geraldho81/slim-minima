import type { Metadata } from "next";
import { getSettings } from "@/lib/queries";
import { siteUrl } from "@/lib/site-url";
import { BlogList } from "@/components/site/BlogList";

// Edge-cached (ISR). Category/tag filtering happens on the client, so the
// listing stays static and every post card ships in the server HTML.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: `Blog | ${settings.siteName}`,
    description: `Articles and guides from ${settings.siteName}`,
    alternates: { canonical: `${siteUrl()}/blog` },
  };
}

export default function BlogIndex() {
  return <BlogList />;
}
