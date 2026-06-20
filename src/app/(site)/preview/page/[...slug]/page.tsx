import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageBySlug, getSettings } from "@/lib/queries";
import { auth } from "@/lib/auth";
import { PageView } from "@/components/site/PageView";
import { PreviewBanner } from "@/components/site/PreviewBanner";

// Always rendered fresh, only for signed-in editors, and never indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ slug: string[] }>;
};

export default async function PagePreview(props: Props) {
  const session = await auth();
  if (!session?.user) notFound();

  const { slug } = await props.params;
  const page = await getPageBySlug(slug.join("/"));
  if (!page) notFound();

  const settings = await getSettings();
  return (
    <>
      <PreviewBanner status={page.status} />
      <PageView page={page} settings={settings} isHome={false} />
    </>
  );
}
