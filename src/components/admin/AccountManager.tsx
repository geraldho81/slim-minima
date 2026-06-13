"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeOwnPassword, updateOwnProfileImage } from "@/app/admin/actions";
import { MediaPicker } from "@/components/admin/MediaPicker";

export function AccountManager({
  name,
  email,
  role,
  image: initialImage,
}: {
  name: string;
  email: string;
  role: "admin" | "editor";
  image: string | null;
}) {
  const router = useRouter();
  const [image, setImage] = useState(initialImage);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveImage(next: string | null) {
    setImage(next);
    try {
      await updateOwnProfileImage(next);
      router.refresh();
    } catch {
      setImage(initialImage);
    }
  }

  async function submit() {
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await changeOwnPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Account</h1>

      <section className="mb-6 rounded-xl bg-white p-5">
        <h2 className="mb-3 text-sm font-bold tracking-tight">Profile</h2>
        <div className="flex gap-5">
          <div className="shrink-0 text-center">
            <div className="mb-2 h-20 w-20 overflow-hidden rounded-full bg-[var(--ad-bg)]">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-bold" style={{ color: "var(--ad-muted)" }}>
                  {(name || email).slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex justify-center gap-1.5">
              <button type="button" className="ad-btn ad-btn-soft" style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem" }} onClick={() => setPickerOpen(true)}>
                {image ? "Change" : "Add photo"}
              </button>
              {image && (
                <button type="button" className="ad-btn ad-btn-soft" style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem" }} onClick={() => saveImage(null)}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="ad-field">
              <label className="ad-label">Name</label>
              <input className="ad-input" value={name} disabled />
            </div>
            <div className="ad-field">
              <label className="ad-label">Email</label>
              <input className="ad-input" value={email} disabled />
            </div>
            <p className="text-xs" style={{ color: "var(--ad-muted)" }}>
              Signed in as {role}.
            </p>
          </div>
        </div>
      </section>

      {pickerOpen && <MediaPicker onSelect={(u) => saveImage(u)} onClose={() => setPickerOpen(false)} />}

      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-3 text-sm font-bold tracking-tight">Change password</h2>
        <div className="ad-field">
          <label className="ad-label">Current password</label>
          <input className="ad-input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="ad-field">
          <label className="ad-label">New password</label>
          <input className="ad-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="ad-field">
          <label className="ad-label">Confirm new password</label>
          <input className="ad-input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="mb-2 text-sm" style={{ color: "var(--ad-danger)" }}>{error}</p>}
        {done && <p className="mb-2 text-sm" style={{ color: "var(--ad-accent)" }}>Password updated.</p>}
        <button
          className="ad-btn ad-btn-primary"
          disabled={busy || !current || next.length < 8 || !confirm}
          onClick={submit}
        >
          {busy ? "Saving..." : "Update password"}
        </button>
      </section>
    </div>
  );
}
