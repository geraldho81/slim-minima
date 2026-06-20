import { BlockRenderer } from "@/blocks/BlockRenderer";
import { JsonLd, websiteSchema, faqSchema, parseJsonLd } from "@/lib/jsonld";
import { collectFaqItems } from "@/lib/block-text";
import type { Page } from "@/db/schema";
import type { SiteSettings } from "@/lib/queries";

/**
 * Renders a page's blocks plus its structured data. Shared by the public
 * (cached) route and the preview route so both produce identical markup.
 */
export function PageView({ page, settings, isHome }: { page: Page; settings: SiteSettings; isHome: boolean }) {
  const faqItems = collectFaqItems(page.blocks);
  const customSchemaData = parseJsonLd(page.customSchema);

  return (
    <>
      {isHome && <JsonLd data={websiteSchema(settings)} />}
      {faqItems.length > 0 && <JsonLd data={faqSchema(faqItems)} />}
      {customSchemaData && <JsonLd data={customSchemaData} />}
      <BlockRenderer blocks={page.blocks} />
    </>
  );
}
