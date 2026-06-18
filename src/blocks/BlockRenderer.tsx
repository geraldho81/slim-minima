import type { ReactNode } from "react";
import type { Block } from "@/blocks/types";
import { registry } from "@/blocks/registry";
import { sanitizeContentHtml } from "@/lib/sanitize";

/**
 * Public-site block renderer (server component). Resolves each block's
 * server data via getData, renders child zones recursively, and skips
 * unknown block types with a console warning.
 */
export async function BlockRenderer({ blocks }: { blocks: Block[] }) {
  const rendered = await Promise.all(blocks.map((block) => renderBlock(block)));
  return <>{rendered}</>;
}

async function renderBlock(block: Block): Promise<ReactNode> {
  const def = registry[block.type];
  if (!def) {
    console.warn(`[cms] Skipping unknown block type "${block.type}"`);
    return null;
  }
  const parsed = def.schema.safeParse({ ...def.defaults, ...block.props });
  if (!parsed.success) {
    console.warn(`[cms] Skipping block "${block.type}" with invalid props`, parsed.error.issues);
    return null;
  }
  const props = parsed.data;

  // Sanitize any raw author HTML before it reaches dangerouslySetInnerHTML.
  if (def.rawHtmlFields) {
    for (const field of def.rawHtmlFields) {
      const value = (props as Record<string, unknown>)[field as string];
      if (typeof value === "string") {
        (props as Record<string, unknown>)[field as string] = sanitizeContentHtml(value);
      }
    }
  }

  const data = def.getData ? await def.getData(props) : undefined;

  let zones: ReactNode[] | undefined;
  const zoneCount = def.zoneCount?.(props) ?? 0;
  if (zoneCount > 0) {
    zones = await Promise.all(
      Array.from({ length: zoneCount }, async (_, i) => {
        const zoneBlocks = block.zones?.[i] ?? [];
        const children = await Promise.all(zoneBlocks.map((b) => renderBlock(b)));
        return <>{children}</>;
      })
    );
  }

  const Render = def.Render;
  return <Render key={block.id} {...props} ctx={{ data, zones }} />;
}
