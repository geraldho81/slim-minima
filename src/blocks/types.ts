import type { ComponentType, ReactNode } from "react";
import type { ZodType } from "zod";

/**
 * A block instance as stored in the pages.blocks jsonb column.
 * `zones` holds nested child blocks for container blocks (e.g. columns):
 * zones[0] = blocks in the first column, zones[1] = second column, etc.
 */
export interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
  zones?: Block[][];
}

/** Declarative field specs - the editor auto-generates the settings form from these. */
export type FieldSpec =
  | { kind: "text"; name: string; label: string; placeholder?: string }
  | { kind: "textarea"; name: string; label: string; rows?: number; placeholder?: string }
  | { kind: "number"; name: string; label: string; min?: number; max?: number; step?: number }
  | { kind: "toggle"; name: string; label: string; help?: string }
  | { kind: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { kind: "image"; name: string; label: string }
  | { kind: "page"; name: string; label: string; placeholder?: string }
  | { kind: "contactForm"; name: string; label: string; placeholder?: string }
  | { kind: "richtext"; name: string; label: string }
  | { kind: "list"; name: string; label: string; itemLabel: string; fields: FieldSpec[] };

export interface RenderContext {
  /** Extra data resolved server-side via getData (e.g. posts for posts-list). */
  data?: unknown;
  /** Rendered child zones for container blocks. */
  zones?: ReactNode[];
}

export interface BlockDef<P = Record<string, unknown>> {
  type: string;
  label: string;
  description: string;
  /** Small inline SVG path or emoji shown in the block palette. */
  icon: ReactNode;
  schema: ZodType<P>;
  defaults: P;
  /** Field specs for the auto-generated settings form. */
  fields: FieldSpec[];
  /** Number of child zones this block exposes (e.g. column count). 0 = leaf block. */
  zoneCount?: (props: P) => number;
  /** Server-side data loader, awaited by the public BlockRenderer. */
  getData?: (props: P) => Promise<unknown>;
  /** Pure component. Must work in both server and client trees - no hooks, no async. */
  Render: ComponentType<P & { ctx?: RenderContext }>;
  /** Optional editor-canvas stand-in for blocks whose Render needs server data. */
  Preview?: ComponentType<P>;
}

/** Helper so block files get prop type inference from their zod schema. */
export function defineBlock<P>(def: BlockDef<P>): BlockDef<P> {
  return def;
}

export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10);
}
