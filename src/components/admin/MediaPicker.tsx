"use client";

import { useEffect, useRef, useState } from "react";
import { listMedia } from "@/app/admin/actions";
import { useUpload } from "@/lib/useUpload";
import { useIntegrations } from "@/components/admin/IntegrationsContext";
import { CloudinaryNotice } from "@/components/admin/CloudinaryNotice";

type MediaItem = {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  alt: string | null;
  createdAt: string;
};

export function MediaPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const { cloudinary } = useIntegrations();
  // Without Cloudinary there is no library to load, so start with an empty list.
  const [items, setItems] = useState<MediaItem[] | null>(cloudinary ? null : []);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const { upload, uploading } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cloudinary) listMedia().then(setItems).catch(() => setItems([]));
  }, [cloudinary]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      const uploaded = await upload(files[0]);
      setItems((prev) => [uploaded, ...(prev ?? [])]);
      onSelect(uploaded.url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  function applyUrl() {
    const v = url.trim();
    if (!v) return;
    onSelect(v);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-6" onClick={onClose}>
      <div
        className="flex h-[70vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Add an image</h2>
          <div className="flex items-center gap-2">
            <button
              className="ad-btn ad-btn-primary"
              onClick={() => fileRef.current?.click()}
              disabled={!cloudinary || uploading}
              title={cloudinary ? "Upload from your device" : "Connect Cloudinary in Settings to upload from your device"}
            >
              {uploading ? "Uploading..." : "Upload from device"}
            </button>
            <button className="ad-btn ad-btn-soft" onClick={onClose}>Close</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFiles(e.target.files)} />
        </div>

        {/* Paste a URL - always available, no Cloudinary needed */}
        <div className="mb-3 flex gap-1.5">
          <input
            className="ad-input"
            placeholder="Paste an image URL (https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyUrl();
              }
            }}
          />
          <button type="button" className="ad-btn ad-btn-soft shrink-0" disabled={!url.trim()} onClick={applyUrl}>
            Use URL
          </button>
        </div>

        <CloudinaryNotice className="mb-3" />

        {error && <p className="mb-3 text-sm" style={{ color: "var(--ad-danger)" }}>{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items === null ? (
            <p className="text-sm" style={{ color: "var(--ad-muted)" }}>Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ad-muted)" }}>
              {cloudinary ? "No media yet. Upload your first image." : "Your media library appears here once Cloudinary is connected."}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {items
                .filter((m) => m.mimeType.startsWith("image/"))
                .map((m) => (
                  <button
                    key={m.id}
                    className="group overflow-hidden rounded-lg bg-[var(--ad-bg)] text-left"
                    onClick={() => {
                      onSelect(m.url);
                      onClose();
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.alt ?? m.name} className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.03]" />
                    <div className="truncate px-2 py-1.5 text-xs" style={{ color: "var(--ad-muted)" }}>{m.name}</div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
