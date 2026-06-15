import type { Block } from "@/blocks/types";
import { newBlockId } from "@/blocks/types";
import { registry } from "@/blocks/registry";

/** Immutable helpers for the nested block tree (top-level array + zones). */

export function createBlock(type: string): Block {
  const def = registry[type];
  const block: Block = {
    id: newBlockId(),
    type,
    props: structuredClone(def.defaults) as Record<string, unknown>,
  };
  const zones = def.zoneCount?.(block.props) ?? 0;
  if (zones > 0) block.zones = Array.from({ length: zones }, () => []);
  return block;
}

export function findBlock(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    for (const zone of b.zones ?? []) {
      const hit = findBlock(zone, id);
      if (hit) return hit;
    }
  }
  return null;
}

function mapTree(blocks: Block[], fn: (list: Block[]) => Block[]): Block[] {
  return fn(blocks).map((b) =>
    b.zones ? { ...b, zones: b.zones.map((zone) => mapTree(zone, fn)) } : b
  );
}

export function updateBlockProps(blocks: Block[], id: string, partial: Record<string, unknown>): Block[] {
  return mapTree(blocks, (list) =>
    list.map((b) => {
      if (b.id !== id) return b;
      const next: Block = { ...b, props: { ...b.props, ...partial } };
      // Container blocks may change their zone count (e.g. 2 -> 3 columns)
      const def = registry[b.type];
      const zones = def?.zoneCount?.(next.props) ?? 0;
      if (zones > 0) {
        const existing = next.zones ?? [];
        next.zones = Array.from({ length: zones }, (_, i) => existing[i] ?? []);
      }
      return next;
    })
  );
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  return mapTree(blocks, (list) => list.filter((b) => b.id !== id));
}

function cloneWithNewIds(block: Block): Block {
  return {
    ...block,
    id: newBlockId(),
    props: structuredClone(block.props),
    zones: block.zones?.map((zone) => zone.map(cloneWithNewIds)),
  };
}

export function duplicateBlock(blocks: Block[], id: string): Block[] {
  return mapTree(blocks, (list) => {
    const i = list.findIndex((b) => b.id === id);
    if (i === -1) return list;
    const copy = cloneWithNewIds(list[i]);
    return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
  });
}

export function moveBlock(blocks: Block[], id: string, dir: -1 | 1): Block[] {
  return mapTree(blocks, (list) => {
    const i = list.findIndex((b) => b.id === id);
    if (i === -1) return list;
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}

/** Insert into the top level (after a sibling, or at the end). */
export function insertTopLevel(blocks: Block[], block: Block, afterId?: string | null): Block[] {
  if (afterId) {
    const i = blocks.findIndex((b) => b.id === afterId);
    if (i !== -1) return [...blocks.slice(0, i + 1), block, ...blocks.slice(i + 1)];
  }
  return [...blocks, block];
}

/** Insert into the top level (before a sibling, or at the end). */
export function insertTopLevelBefore(blocks: Block[], block: Block, beforeId?: string | null): Block[] {
  if (beforeId) {
    const i = blocks.findIndex((b) => b.id === beforeId);
    if (i !== -1) return [...blocks.slice(0, i), block, ...blocks.slice(i)];
  }
  return [...blocks, block];
}

/** Insert into a container block's zone. */
export function insertIntoZone(blocks: Block[], containerId: string, zoneIndex: number, block: Block): Block[] {
  return blocks.map((b) => {
    if (b.id === containerId) {
      const zones = (b.zones ?? []).map((zone, i) => (i === zoneIndex ? [...zone, block] : zone));
      return { ...b, zones };
    }
    if (b.zones) {
      return { ...b, zones: b.zones.map((zone) => insertIntoZone(zone, containerId, zoneIndex, block)) };
    }
    return b;
  });
}

export function reorderTopLevel(blocks: Block[], activeId: string, overId: string): Block[] {
  const from = blocks.findIndex((b) => b.id === activeId);
  const to = blocks.findIndex((b) => b.id === overId);
  if (from === -1 || to === -1) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
