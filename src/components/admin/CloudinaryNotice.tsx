"use client";

import Link from "next/link";
import { useIntegrations } from "@/components/admin/IntegrationsContext";

/**
 * One canonical, consistent message about Cloudinary gating, shown wherever a
 * user can add an image. Renders nothing once Cloudinary is connected.
 * - "picker": image fields, hero/profile pickers (URL paste is the fallback).
 * - "media": the media library page (no URL fallback there).
 */
export function CloudinaryNotice({
  variant = "picker",
  className = "",
}: {
  variant?: "picker" | "media";
  className?: string;
}) {
  const { cloudinary } = useIntegrations();
  if (cloudinary) return null;

  return (
    <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${className}`} style={{ background: "#fff7ed", color: "#9a3412" }}>
      <span className="font-semibold">Cloudinary is not connected.</span>{" "}
      {variant === "media"
        ? "The media library needs your own Cloudinary account to store and serve files. "
        : "You cannot upload from your device yet, but you can still add an image by pasting its URL below. "}
      <Link href="/admin/settings" className="font-medium underline">
        Connect Cloudinary in Settings
      </Link>{" "}
      to {variant === "media" ? "upload and manage media" : "turn on device uploads"}.
    </div>
  );
}
