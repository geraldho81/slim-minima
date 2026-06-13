"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { updateMediaAlt, trashMedia, trashMediaItems } from "@/app/admin/actions";
import { useUpload } from "@/lib/useUpload";
import { CloudinaryNotice } from "@/components/admin/CloudinaryNotice";

type MediaItem = {
  id: string;
  resourceType: string;
  url: string;
  name: string;
  mimeType: string;
  size: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  createdAt: string;
};

function toTrashInput(m: MediaItem) {
  return {
    publicId: m.id,
    resourceType: m.resourceType,
    url: m.url,
    name: m.name,
    mimeType: m.mimeType,
    size: m.size,
    width: m.width,
    height: m.height,
    alt: m.alt,
  };
}

export function MediaLibrary({
  initial,
  trashCount = 0,
  cloudinaryConfigured = true,
}: {
  initial: MediaItem[];
  trashCount?: number;
  cloudinaryConfigured?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { upload, uploading } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? items.filter((m) => `${m.name} ${m.alt ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    const ids = [...picked];
    if (!ids.length) return;
    setBusy(true);
    try {
      const refs = items.filter((it) => picked.has(it.id)).map(toTrashInput);
      await trashMediaItems(refs);
      const removing = new Set(ids);
      setItems((prev) => prev.filter((it) => !removing.has(it.id)));
      setPicked(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await upload(file);
        setItems((prev) => [uploaded, ...prev]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Media</h1>
        <div className="flex items-center gap-2">
          <input
            className="ad-input"
            style={{ width: "14rem" }}
            type="search"
            placeholder="Search media..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link className="ad-btn ad-btn-soft" href="/admin/media/trash">
            Trash{trashCount > 0 ? ` (${trashCount})` : ""}
          </Link>
          <button
            className="ad-btn ad-btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !cloudinaryConfigured}
            title={cloudinaryConfigured ? "" : "Connect Cloudinary in Settings to upload"}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {!cloudinaryConfigured ? (
        <CloudinaryNotice variant="media" className="mb-4" />
      ) : (
        <p className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--ad-accent-soft)", color: "var(--ad-muted)" }}>
          Note: Cloudinary blocks delivery of PDF and ZIP files by default. To allow them, open your Cloudinary console and go to
          Settings -&gt; Security -&gt; &quot;PDF and ZIP files delivery&quot;, then tick &quot;Allow delivery of PDF and ZIP files&quot;.
        </p>
      )}
      {error && <p className="mb-4 text-sm" style={{ color: "var(--ad-danger)" }}>{error}</p>}

      {picked.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm">
          <span className="mr-1 font-semibold">{picked.size} selected</span>
          <button className="ad-btn ad-btn-danger" disabled={busy} onClick={bulkDelete}>
            {busy ? "Moving..." : "Move to trash"}
          </button>
          <button className="ml-auto ad-btn ad-btn-soft" onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center text-sm" style={{ color: "var(--ad-muted)" }}>
          No media yet. Uploads go to Cloudinary and are recorded here.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center text-sm" style={{ color: "var(--ad-muted)" }}>
          No media match &quot;{query}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {filtered.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-xl bg-white">
              <label
                className={`absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/90 shadow-sm transition-opacity group-hover:opacity-100 ${picked.has(m.id) ? "opacity-100" : "opacity-0"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input type="checkbox" checked={picked.has(m.id)} onChange={() => togglePick(m.id)} />
              </label>
              <button
                className="block w-full text-left"
                onClick={() => { setSelected(m); setCopied(false); }}
              >
                {m.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.alt ?? m.name} className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-2xl" style={{ background: "var(--ad-bg)" }}>📄</div>
                )}
                <div className="truncate px-2.5 py-2 text-xs font-medium">{m.name}</div>
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {selected.mimeType.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt={selected.alt ?? ""} className="mb-4 max-h-72 w-full rounded-lg object-contain" style={{ background: "var(--ad-bg)" }} />
            )}
            <div className="mb-3 text-sm font-bold">{selected.name}</div>
            <div className="mb-3 text-xs" style={{ color: "var(--ad-muted)" }}>
              {selected.width && selected.height ? `${selected.width} × ${selected.height} · ` : ""}
              {selected.size ? `${Math.round(selected.size / 1024)} KB · ` : ""}
              {new Date(selected.createdAt).toLocaleDateString()}
            </div>
            <div className="ad-field">
              <label className="ad-label">Alt text</label>
              <input
                className="ad-input"
                defaultValue={selected.alt ?? ""}
                onBlur={(e) => {
                  updateMediaAlt(selected.id, e.target.value, selected.resourceType);
                  setItems((prev) => prev.map((it) => (it.id === selected.id ? { ...it, alt: e.target.value } : it)));
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="ad-btn ad-btn-soft flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(selected.url);
                  setCopied(true);
                }}
              >
                {copied ? "Copied!" : "Copy URL"}
              </button>
              <button
                className="ad-btn ad-btn-danger"
                onClick={async () => {
                  await trashMedia(toTrashInput(selected));
                  setItems((prev) => prev.filter((it) => it.id !== selected.id));
                  setSelected(null);
                }}
              >
                Move to trash
              </button>
              <button className="ad-btn ad-btn-soft" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
