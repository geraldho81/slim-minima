import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { PageEditor } from "@/components/admin/editor/PageEditor";

export default async function PageEditorRoute(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!page) notFound();

  return (
    <PageEditor
      initial={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        blocks: page.blocks,
        status: page.status,
        publishAt: page.publishAt?.toISOString() ?? null,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        ogImage: page.ogImage,
        noindex: page.noindex,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
      }}
    />
  );
}
