"use client";

import { useState } from "react";
import { saveIntegrations } from "@/app/admin/actions";

type Props = {
  initial: {
    emailFrom: string;
    emailTo: string;
    resendKeySet: boolean;
    cloudinaryFolder: string;
    mediaTrashTtlDays: string;
  };
  env: { resendKey: boolean; emailFrom: boolean; emailTo: boolean; folder: boolean; ttl: boolean };
};

export function IntegrationsSettings({ initial, env }: Props) {
  const [emailFrom, setEmailFrom] = useState(initial.emailFrom);
  const [emailTo, setEmailTo] = useState(initial.emailTo);
  const [resendApiKey, setResendApiKey] = useState("");
  const [cloudinaryFolder, setCloudinaryFolder] = useState(initial.cloudinaryFolder);
  const [mediaTrashTtlDays, setMediaTrashTtlDays] = useState(initial.mediaTrashTtlDays);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  async function save() {
    setState("saving");
    await saveIntegrations({ emailFrom, emailTo, resendApiKey, cloudinaryFolder, mediaTrashTtlDays });
    setResendApiKey("");
    setState("saved");
    setTimeout(() => setState("idle"), 1500);
  }

  const envNote = (
    <span className="text-xs" style={{ color: "var(--ad-muted)" }}> (set via environment)</span>
  );

  return (
    <section className="mb-6 rounded-xl bg-white p-5">
      <h2 className="mb-1 text-sm font-bold tracking-tight">Email notifications (Resend)</h2>
      <p className="mb-4 text-xs" style={{ color: "var(--ad-muted)" }}>
        Optional. Without it, contact submissions are still saved and shown in the admin. Get a free
        API key at resend.com.
      </p>
      <div className="grid grid-cols-2 gap-x-4">
        <div className="ad-field">
          <label className="ad-label">Email from{env.emailFrom && envNote}</label>
          <input
            className="ad-input"
            value={emailFrom}
            disabled={env.emailFrom}
            placeholder="Slim Minima <onboarding@resend.dev>"
            onChange={(e) => setEmailFrom(e.target.value)}
          />
        </div>
        <div className="ad-field">
          <label className="ad-label">Email to{env.emailTo && envNote}</label>
          <input
            className="ad-input"
            value={emailTo}
            disabled={env.emailTo}
            placeholder="you@yourcompany.com"
            onChange={(e) => setEmailTo(e.target.value)}
          />
        </div>
      </div>
      <div className="ad-field">
        <label className="ad-label">Resend API key{env.resendKey && envNote}</label>
        <input
          className="ad-input"
          type="password"
          value={resendApiKey}
          disabled={env.resendKey}
          placeholder={env.resendKey ? "Managed via environment" : initial.resendKeySet ? "•••••••••• (saved - leave blank to keep)" : "re_..."}
          onChange={(e) => setResendApiKey(e.target.value)}
        />
      </div>

      <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--ad-line)" }}>
        <h2 className="mb-3 text-sm font-bold tracking-tight">Media options</h2>
        <div className="grid grid-cols-2 gap-x-4">
          <div className="ad-field">
            <label className="ad-label">Cloudinary upload folder{env.folder && envNote}</label>
            <input
              className="ad-input"
              value={cloudinaryFolder}
              disabled={env.folder}
              placeholder="slim-minima"
              onChange={(e) => setCloudinaryFolder(e.target.value)}
            />
          </div>
          <div className="ad-field">
            <label className="ad-label">Trash retention (days){env.ttl && envNote}</label>
            <input
              className="ad-input"
              type="number"
              min={1}
              value={mediaTrashTtlDays}
              disabled={env.ttl}
              placeholder="30"
              onChange={(e) => setMediaTrashTtlDays(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button className="ad-btn ad-btn-primary" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving..." : "Save integrations"}
        </button>
        {state === "saved" && <span className="text-xs" style={{ color: "var(--ad-green)" }}>Saved</span>}
      </div>
    </section>
  );
}
