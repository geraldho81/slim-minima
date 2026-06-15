"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Block } from "@/blocks/types";
import { registry, blockList } from "@/blocks/registry";

export type BlockAction = "up" | "down" | "duplicate" | "delete";

export const CANVAS_END_DROP_ID = "canvas-end";

type CanvasProps = {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAction: (id: string, action: BlockAction) => void;
  onAddToZone: (containerId: string, zoneIndex: number, type: string) => void;
};

export function Canvas(props: CanvasProps) {
  const { setNodeRef: setEndDropRef, isOver: endDropOver } = useDroppable({ id: CANVAS_END_DROP_ID });

  return (
    <div
      className="min-h-full bg-white"
      onClick={() => props.onSelect(null)}
      onClickCapture={(e) => {
        // Keep links and embeds inert inside the editor canvas
        const el = e.target as HTMLElement;
        if (el.closest("a")) e.preventDefault();
      }}
    >
      {props.blocks.length === 0 ? (
        <div
          ref={setEndDropRef}
          className={`flex h-[60vh] items-center justify-center ${endDropOver ? "canvas-drop-active" : ""}`}
        >
          <p className="text-sm" style={{ color: "var(--ad-muted)" }}>
            Add your first block from the palette, or drag one in.
          </p>
        </div>
      ) : (
        <SortableContext items={props.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {props.blocks.map((block, i) => (
            <SortableBlock
              key={block.id}
              block={block}
              index={i}
              total={props.blocks.length}
              {...props}
            />
          ))}
          <div
            ref={setEndDropRef}
            className={`canvas-end-drop ${endDropOver ? "canvas-end-drop-active" : ""}`}
          />
        </SortableContext>
      )}
    </div>
  );
}

function SortableBlock(props: CanvasProps & { block: Block; index: number; total: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active } = useSortable({ id: props.block.id });
  const paletteHover = isOver && active?.data.current?.kind === "palette";
  return (
    <div
      ref={setNodeRef}
      className={paletteHover ? "canvas-insert-before" : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <CanvasBlock
        block={props.block}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        onAction={props.onAction}
        onAddToZone={props.onAddToZone}
        canMoveUp={props.index > 0}
        canMoveDown={props.index < props.total - 1}
        dragHandle={
          <button title="Drag to reorder" style={{ cursor: "grab", touchAction: "none" }} {...attributes} {...listeners}>
            ⠿
          </button>
        }
      />
    </div>
  );
}

function CanvasBlock({
  block,
  selectedId,
  onSelect,
  onAction,
  onAddToZone,
  canMoveUp,
  canMoveDown,
  dragHandle,
}: {
  block: Block;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAction: (id: string, action: BlockAction) => void;
  onAddToZone: (containerId: string, zoneIndex: number, type: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragHandle?: ReactNode;
}) {
  const def = registry[block.type];
  if (!def) {
    return (
      <div className="cms-container cms-block">
        <div className="cms-image-placeholder">Unknown block type: {block.type}</div>
      </div>
    );
  }

  const parsed = def.schema.safeParse({ ...def.defaults, ...block.props });
  const blockProps = parsed.success ? parsed.data : def.defaults;
  const selected = selectedId === block.id;

  const zoneCount = def.zoneCount?.(blockProps) ?? 0;
  let zones: ReactNode[] | undefined;
  if (zoneCount > 0) {
    zones = Array.from({ length: zoneCount }, (_, zi) => {
      const zoneBlocks = block.zones?.[zi] ?? [];
      return (
        <div key={zi} className={`canvas-zone ${zoneBlocks.length === 0 ? "canvas-zone-empty" : ""}`}>
          {zoneBlocks.map((child, ci) => (
            <CanvasBlock
              key={child.id}
              block={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onAction={onAction}
              onAddToZone={onAddToZone}
              canMoveUp={ci > 0}
              canMoveDown={ci < zoneBlocks.length - 1}
            />
          ))}
          <ZoneAdd onAdd={(type) => onAddToZone(block.id, zi, type)} />
        </div>
      );
    });
  }

  const Component = def.Preview ?? def.Render;

  return (
    <div
      className={`canvas-block ${selected ? "canvas-block-selected" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
    >
      <div className="canvas-block-header" onClick={(e) => e.stopPropagation()}>
        <span className="canvas-block-label">
          {dragHandle}
          <span aria-hidden className="canvas-block-icon">{def.icon}</span>
          {def.label}
        </span>
        <BlockMenu
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onAction={(a) => onAction(block.id, a)}
        />
      </div>
      <Component {...blockProps} ctx={{ zones }} />
    </div>
  );
}

function BlockMenu({
  canMoveUp,
  canMoveDown,
  onAction,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAction: (action: BlockAction) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="canvas-block-menu-wrap">
      <button title="Block actions" className="canvas-block-menu-btn" onClick={() => setOpen((v) => !v)}>
        ⋮
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="canvas-block-menu">
            <button disabled={!canMoveUp} onClick={() => { onAction("up"); setOpen(false); }}>↑ Move up</button>
            <button disabled={!canMoveDown} onClick={() => { onAction("down"); setOpen(false); }}>↓ Move down</button>
            <button onClick={() => { onAction("duplicate"); setOpen(false); }}>⧉ Duplicate</button>
            <button className="canvas-block-menu-danger" onClick={() => { onAction("delete"); setOpen(false); }}>✕ Delete</button>
          </span>
        </>
      )}
    </span>
  );
}

function ZoneAdd({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="rounded-md px-2.5 py-1 text-xs font-semibold"
        style={{ color: "var(--ad-accent)", background: "var(--ad-accent-soft)" }}
        onClick={() => setOpen((v) => !v)}
      >
        + Add block
      </button>
      {open && (
        <div className="absolute left-1/2 z-30 mt-1 max-h-56 w-44 -translate-x-1/2 overflow-y-auto rounded-lg bg-white p-1 text-left shadow-xl">
          {blockList
            .filter((d) => !d.zoneCount)
            .map((d) => (
              <button
                key={d.type}
                type="button"
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-[var(--ad-bg)]"
                onClick={() => {
                  onAdd(d.type);
                  setOpen(false);
                }}
              >
                {d.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
