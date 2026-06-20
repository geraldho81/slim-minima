import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug, getSettings } from "@/lib/queries";
import { auth } from "@/lib/auth";
import { PostView } from "@/components/site/PostView";
import { PreviewBanner } from "@/components/site/PreviewBanner";

// Always rendered fresh, only for signed-in editors, and never indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PostPreview(props: Props) {
  const session = await auth();
  if (!session?.user) notFound();

  const { slug } = await props.params;
  const row = await getPostBySlug(slug);
  if (!row) notFound();

  const settings = await getSettings();
  return (
    <>
      <PreviewBanner status={row.post.status} />
      <PostView row={row} settings={settings} />
    </>
  );
}
