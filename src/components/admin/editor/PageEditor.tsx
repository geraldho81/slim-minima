"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Block } from "@/blocks/types";
import { registry, blockList } from "@/blocks/registry";
import { savePage, trashPage, listRevisions, restoreRevision, namePageRevision } from "@/app/admin/actions";
import { Canvas, CANVAS_END_DROP_ID, type BlockAction } from "@/components/admin/editor/Canvas";
import { AutoFields } from "@/components/admin/editor/AutoFields";
import {
  createBlock,
  findBlock,
  updateBlockProps,
  removeBlock,
  duplicateBlock,
  moveBlock,
  insertTopLevel,
  insertTopLevelBefore,
  insertIntoZone,
  reorderTopLevel,
} from "@/components/admin/editor/blockTree";

export type PageData = {
  id: string;
  title: string;
  slug: string;
  blocks: Block[];
  status: "draft" | "published" | "scheduled";
  publishAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  noindex: boolean;
  customSchema: string | null;
  createdAt: string;
  updatedAt: string;
};

type SaveState = "saved" | "dirty" | "saving" | "error";
type Viewport = "desktop" | "tablet" | "mobile";
type InspectorTab = "page" | "settings" | "seo";

const VIEWPORT_WIDTH: Record<Viewport, number> = { desktop: 1100, tablet: 768, mobile: 390 };

const STATUS_CHIP: Record<PageData["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "ad-chip-draft" },
  published: { label: "Published", className: "ad-chip-published" },
  scheduled: { label: "Scheduled", className: "ad-chip-scheduled" },
};

export function PageEditor({ initial }: { initial: PageData }) {
  const router = useRouter();
  const [page, setPage] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [tab, setTab] = useState<InspectorTab>("page");
  const [draggingType, setDraggingType] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const pageRef = useRef(page);
  pageRef.current = page;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async (override?: Partial<PageData>) => {
    const current = { ...pageRef.current, ...override };
    setSaveState("saving");
    try {
      const result = await savePage(current.id, {
        title: current.title,
        slug: current.slug,
        blocks: current.blocks,
        status: current.status,
        publishAt: current.publishAt,
        metaTitle: current.metaTitle,
        metaDescription: current.metaDescription,
        ogImage: current.ogImage,
        noindex: current.noindex,
        customSchema: current.customSchema,
      });
      // Server may normalize the slug
      if (result.slug !== pageRef.current.slug) setPage((p) => ({ ...p, slug: result.slug }));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    // Live (published) pages never autosave: edits only reach the public site
    // on an explicit Save click. Drafts keep autosaving so work is not lost.
    if (pageRef.current.status === "published") return;
    timerRef.current = setTimeout(() => doSave(), 800);
  }, [doSave]);

  const update = useCallback(
    (partial: Partial<PageData>) => {
      setPage((p) => ({ ...p, ...partial }));
      scheduleSave();
    },
    [scheduleSave]
  );

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const hasUnsaved = saveState === "dirty" || saveState === "error";

  // Warn on tab close / refresh while edits are unsaved.
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  async function handleBack() {
    // Live pages never autosave, so unsaved edits would be lost: confirm first.
    if (hasUnsaved && pageRef.current.status === "published") {
      setLeaveOpen(true);
      return;
    }
    // Drafts autosave: flush anything pending so no work is lost, then leave.
    if (timerRef.current) clearTimeout(timerRef.current);
    if (hasUnsaved) await doSave();
    router.push("/admin/pages");
  }

  function leaveWithoutSaving() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLeaveOpen(false);
    router.push("/admin/pages");
  }

  function handleAction(id: string, action: BlockAction) {
    if (action === "delete") {
      update({ blocks: removeBlock(page.blocks, id) });
      if (selectedId === id) setSelectedId(null);
    } else if (action === "duplicate") {
      update({ blocks: duplicateBlock(page.blocks, id) });
    } else {
      update({ blocks: moveBlock(page.blocks, id, action === "up" ? -1 : 1) });
    }
  }

  function handleInsert(type: string) {
    const block = createBlock(type);
    const afterId = selectedId && page.blocks.some((b) => b.id === selectedId) ? selectedId : null;
    update({ blocks: insertTopLevel(page.blocks, block, afterId) });
    setSelectedId(block.id);
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.kind === "palette") setDraggingType(String(data.type));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingType(null);
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current;

    if (data?.kind === "palette") {
      // New block dropped in from the palette: insert before the block under the
      // cursor, or append when dropped on the trailing end zone / empty canvas.
      const block = createBlock(String(data.type));
      const overId = String(over.id);
      const beforeId = page.blocks.some((b) => b.id === overId) ? overId : null;
      update({ blocks: insertTopLevelBefore(page.blocks, block, beforeId) });
      setSelectedId(block.id);
      return;
    }

    // Reordering an existing top-level block.
    if (active.id !== over.id && over.id !== CANVAS_END_DROP_ID) {
      update({ blocks: reorderTopLevel(page.blocks, String(active.id), String(over.id)) });
    }
  }

  async function handleSaveClick() {
    if (timerRef.current) clearTimeout(timerRef.current);
    await doSave();
  }

  async function setStatus(status: PageData["status"]) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPage((p) => ({ ...p, status }));
    await doSave({ status });
  }

  const selectedBlock = selectedId ? findBlock(page.blocks, selectedId) : null;
  const selectedDef = selectedBlock ? registry[selectedBlock.type] : null;

  const saveLabel =
    saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : saveState === "dirty" ? "Unsaved changes" : "Save failed - retrying on next change";

  const previewHref = `/preview/page/${page.slug}`;
  const chip = STATUS_CHIP[page.status];

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--ad-bg)", color: "var(--ad-text)" }}>
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-4 bg-white px-4">
        <button type="button" onClick={handleBack} className="ad-btn ad-btn-soft" style={{ padding: "0.4rem 0.7rem" }}>
          ←
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2.5">
            <input
              className="min-w-0 bg-transparent text-[17px] font-bold tracking-tight outline-none"
              value={page.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Page title"
              size={Math.max(page.title.length, 4)}
            />
            <span className={`ad-chip ${chip.className}`}>{chip.label}</span>
          </div>
          <span className="text-xs" style={{ color: "var(--ad-muted)" }}>/{page.slug === "home" ? "" : page.slug}</span>
        </div>

        <ViewportToggle viewport={viewport} setViewport={setViewport} />
        <button
          title="Page settings"
          className="ad-icon-btn"
          onClick={() => { setSelectedId(null); setTab("page"); }}
        >
          <GearIcon />
        </button>

        <span className="shrink-0 text-xs" style={{ color: saveState === "error" ? "var(--ad-danger)" : "var(--ad-muted)" }}>
          {saveLabel}
        </span>
        <a href={previewHref} target="_blank" className="ad-btn ad-btn-soft">
          Preview
        </a>
        <SaveButton
          status={page.status}
          saving={saveState === "saving"}
          onSave={handleSaveClick}
          onSetStatus={setStatus}
        />
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <aside className="w-52 shrink-0 overflow-y-auto p-3">
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ad-muted)" }}>
            Blocks
          </p>
          <div className="flex flex-col gap-1">
            {blockList.map((def) => (
              <PaletteItem key={def.type} type={def.type} label={def.label} icon={def.icon} description={def.description} onInsert={handleInsert} />
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div className="min-w-0 flex-1 overflow-y-auto py-4 pr-1">
          <div
            className="mx-auto overflow-hidden rounded-xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] transition-[max-width] duration-300"
            style={{ maxWidth: `${VIEWPORT_WIDTH[viewport]}px`, background: "var(--bg)" }}
          >
            <Canvas
              blocks={page.blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAction={handleAction}
              onAddToZone={(containerId, zoneIndex, type) => {
                const block = createBlock(type);
                update({ blocks: insertIntoZone(page.blocks, containerId, zoneIndex, block) });
                setSelectedId(block.id);
              }}
            />
          </div>
        </div>

        {/* Inspector panel */}
        <aside className="w-80 shrink-0 overflow-y-auto bg-white p-4">
          {selectedBlock && selectedDef ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-tight">{selectedDef.label}</h2>
                <button className="text-xs font-medium" style={{ color: "var(--ad-muted)" }} onClick={() => setSelectedId(null)}>
                  Page settings
                </button>
              </div>
              <AutoFields
                fields={selectedDef.fields}
                values={{ ...selectedDef.defaults, ...selectedBlock.props }}
                onChange={(partial) => update({ blocks: updateBlockProps(page.blocks, selectedBlock.id, partial) })}
              />
            </>
          ) : (
            <PageInspector
              page={page}
              update={update}
              tab={tab}
              setTab={setTab}
              onShowRevisions={() => setRevisionsOpen(true)}
            />
          )}
        </aside>
      </div>
      <DragOverlay dropAnimation={null}>
        {draggingType ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2 text-left text-[13px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <span className="w-5 text-center text-sm" style={{ color: "var(--ad-muted)" }}>{registry[draggingType]?.icon}</span>
            {registry[draggingType]?.label}
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {revisionsOpen && (
        <RevisionsModal
          pageId={page.id}
          onClose={() => setRevisionsOpen(false)}
          onRestored={(blocks) => {
            setPage((p) => ({ ...p, blocks }));
            setRevisionsOpen(false);
            setSaveState("saved");
          }}
        />
      )}

      {leaveOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-6" onClick={() => setLeaveOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold tracking-tight">Leave without saving?</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--ad-muted)" }}>
              This page is live. Your changes have not been saved yet, so the published page still shows the old version. Leave now and your edits will be lost.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="ad-btn ad-btn-soft" onClick={() => setLeaveOpen(false)}>
                Keep editing
              </button>
              <button className="ad-btn ad-btn-danger" onClick={leaveWithoutSaving}>
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaletteItem({
  type,
  label,
  icon,
  description,
  onInsert,
}: {
  type: string;
  label: string;
  icon: ReactNode;
  description?: string;
  onInsert: (type: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { kind: "palette", type },
  });
  return (
    <button
      ref={setNodeRef}
      className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2 text-left text-[13px] font-semibold transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
      style={{ cursor: "grab", touchAction: "none", opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onInsert(type)}
      title={description}
      {...attributes}
      {...listeners}
    >
      <span className="w-5 text-center text-sm" style={{ color: "var(--ad-muted)" }}>{icon}</span>
      {label}
    </button>
  );
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.4a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.62.78 1 1.42 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function ViewportToggle({ viewport, setViewport }: { viewport: Viewport; setViewport: (v: Viewport) => void }) {
  const icons: Record<Viewport, ReactNode> = {
    desktop: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    tablet: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>,
    mobile: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M12 18h.01" /></>,
  };
  return (
    <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "var(--ad-bg)" }}>
      {(Object.keys(icons) as Viewport[]).map((v) => (
        <button
          key={v}
          title={v}
          className="ad-vp-btn"
          data-active={viewport === v}
          onClick={() => setViewport(v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {icons[v]}
          </svg>
        </button>
      ))}
    </div>
  );
}

function SaveButton({
  status,
  saving,
  onSave,
  onSetStatus,
}: {
  status: PageData["status"];
  saving: boolean;
  onSave: () => void;
  onSetStatus: (status: PageData["status"]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex">
      <button className="ad-btn ad-btn-primary" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} onClick={onSave} disabled={saving}>
        Save
      </button>
      <button
        className="ad-btn ad-btn-primary"
        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: "0 0.5rem", marginLeft: 1 }}
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
      >
        ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg bg-white p-1 shadow-xl" style={{ border: "1px solid var(--ad-line)" }}>
            {status !== "published" ? (
              <button className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--ad-bg)]" onClick={() => { onSetStatus("published"); setOpen(false); }}>
                Publish now
              </button>
            ) : (
              <button className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--ad-bg)]" onClick={() => { onSetStatus("draft"); setOpen(false); }}>
                Unpublish (to draft)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PageInspector({
  page,
  update,
  tab,
  setTab,
  onShowRevisions,
}: {
  page: PageData;
  update: (partial: Partial<PageData>) => void;
  tab: InspectorTab;
  setTab: (t: InspectorTab) => void;
  onShowRevisions: () => void;
}) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <>
      <div className="mb-4 flex gap-4" style={{ borderBottom: "1px solid var(--ad-line)" }}>
        {(["page", "settings", "seo"] as InspectorTab[]).map((t) => (
          <button key={t} className={`ad-tab ${tab === t ? "ad-tab-active" : ""}`} onClick={() => setTab(t)}>
            {t === "page" ? "Page" : t === "settings" ? "Settings" : "SEO"}
          </button>
        ))}
      </div>

      {tab === "page" && (
        <>
          <div className="ad-field">
            <label className="ad-label">Status</label>
            <select
              className="ad-select"
              value={page.status}
              onChange={(e) => update({ status: e.target.value as PageData["status"] })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>

          {page.status === "scheduled" && (
            <div className="ad-field">
              <label className="ad-label">Go live at</label>
              <input
                className="ad-input"
                type="datetime-local"
                value={page.publishAt ? page.publishAt.slice(0, 16) : ""}
                onChange={(e) => update({ publishAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
          )}

          <div className="ad-field">
            <label className="ad-label">Slug</label>
            <div className="flex items-center gap-1">
              <span className="text-sm" style={{ color: "var(--ad-muted)" }}>/</span>
              <input className="ad-input" value={page.slug} onChange={(e) => update({ slug: e.target.value })} />
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ad-muted)" }}>
              The slug &quot;home&quot; is served at the site root.
            </p>
          </div>

          <div className="mt-5 flex justify-between border-t pt-4 text-xs" style={{ borderColor: "var(--ad-line)" }}>
            <span style={{ color: "var(--ad-muted)" }}>Created</span>
            <span className="font-medium">{fmt(page.createdAt)}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            <span style={{ color: "var(--ad-muted)" }}>Updated</span>
            <span className="font-medium">{fmt(page.updatedAt)}</span>
          </div>
        </>
      )}

      {tab === "settings" && (
        <>
          <button className="ad-btn ad-btn-soft mb-2 w-full" onClick={onShowRevisions}>
            Revision history
          </button>
          <button
            className="ad-btn ad-btn-danger w-full"
            title="Reversible - restore it from the Trash tab on the pages list"
            onClick={() => trashPage(page.id)}
          >
            Move to trash
          </button>
        </>
      )}

      {tab === "seo" && (
        <>
          <div className="ad-field">
            <label className="ad-label">Meta title</label>
            <input className="ad-input" value={page.metaTitle ?? ""} onChange={(e) => update({ metaTitle: e.target.value || null })} />
          </div>
          <div className="ad-field">
            <label className="ad-label">Meta description</label>
            <textarea className="ad-textarea" rows={3} value={page.metaDescription ?? ""} onChange={(e) => update({ metaDescription: e.target.value || null })} />
          </div>
          <div className="ad-field">
            <label className="ad-label">Social image URL</label>
            <input className="ad-input" value={page.ogImage ?? ""} onChange={(e) => update({ ogImage: e.target.value || null })} placeholder="https://..." />
          </div>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={page.noindex} onChange={(e) => update({ noindex: e.target.checked })} />
            Hide from search engines (noindex)
          </label>
          <div className="ad-field">
            <label className="ad-label">Custom schema markup (JSON-LD)</label>
            <textarea className="ad-textarea" rows={6} value={page.customSchema ?? ""} onChange={(e) => update({ customSchema: e.target.value || null })} placeholder={'{\n  "@type": "Product",\n  "name": "..."\n}'} style={{ fontFamily: "monospace", fontSize: "13px" }} />
            <p style={{ fontSize: "12px", color: "var(--ad-muted)", marginTop: "0.4rem" }}>Generate your schema at <a href="https://technicalseo.com/tools/schema-markup-generator/" target="_blank" rel="noopener noreferrer">TechnicalSEO.com</a> and validate with <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer">Google Rich Results Test</a>.</p>
          </div>
        </>
      )}
    </>
  );
}

type PageRevision = { id: string; savedAt: string; title: string; versionName: string | null; savedByName: string | null };

function RevisionsModal({
  pageId,
  onClose,
  onRestored,
}: {
  pageId: string;
  onClose: () => void;
  onRestored: (blocks: Block[]) => void;
}) {
  const [revisions, setRevisions] = useState<PageRevision[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listRevisions(pageId).then(setRevisions).catch(() => setRevisions([]));
  }, [pageId]);

  function updateName(id: string, versionName: string) {
    setRevisions((prev) => prev?.map((r) => r.id === id ? { ...r, versionName: versionName || null } : r) ?? prev);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-6" onClick={onClose}>
      <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Revisions</h2>
          <button className="ad-btn ad-btn-soft" onClick={onClose}>Close</button>
        </div>
        {revisions === null ? (
          <p className="text-sm" style={{ color: "var(--ad-muted)" }}>Loading...</p>
        ) : revisions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ad-muted)" }}>
            No revisions yet. Snapshots are taken automatically as you edit.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {revisions.map((rev) => (
              <div key={rev.id} className="rounded-lg bg-[var(--ad-bg)] px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{new Date(rev.savedAt).toLocaleString()}</div>
                    <div className="text-xs" style={{ color: "var(--ad-muted)" }}>
                      {rev.title}{rev.savedByName ? ` · ${rev.savedByName}` : ""}
                    </div>
                  </div>
                  <button
                    className="ad-btn ad-btn-soft shrink-0"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const blocks = await restoreRevision(pageId, rev.id);
                        onRestored(blocks);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Restore
                  </button>
                </div>
                <input
                  className="w-full rounded-md px-2 py-1 text-xs outline-none"
                  style={{ background: "var(--ad-line)", color: "var(--ad-text)" }}
                  placeholder="Add a label for this version..."
                  defaultValue={rev.versionName ?? ""}
                  onBlur={(e) => {
                    const val = e.currentTarget.value;
                    if ((val || null) !== rev.versionName) {
                      updateName(rev.id, val);
                      namePageRevision(pageId, rev.id, val);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
