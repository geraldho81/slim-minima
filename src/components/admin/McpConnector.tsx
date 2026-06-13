"use client";

import { useState } from "react";
import { rotateMcpToken, revokeMcpTokenAction } from "@/app/admin/actions";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-semibold" style={{ color: "var(--ad-muted)" }}>
        {label}
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs" style={{ background: "var(--ad-bg)" }}>
          {value}
        </code>
        <button
          className="ad-btn shrink-0"
          style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function McpConnector({
  serverUrl,
  token,
  cloudinaryConnected,
}: {
  serverUrl: string;
  token: string | null;
  cloudinaryConnected: boolean;
}) {
  const [current, setCurrent] = useState<string | null>(token);
  const [busy, setBusy] = useState(false);

  return (
    <section className="mt-6 rounded-xl bg-white p-5">
      <h2 className="mb-1 text-sm font-bold tracking-tight">AI connector (MCP)</h2>
      <p className="mb-4 text-xs" style={{ color: "var(--ad-muted)" }}>
        Connect ChatGPT, Claude, Perplexity or Grok to this site. The assistant can read your pages and posts and write blog
        posts (create and update). It cannot edit pages or delete anything. Images are added through your Cloudinary when
        connected, or by URL otherwise.
      </p>

      {current ? (
        <>
          <CopyField label="MCP server URL" value={serverUrl} />
          <CopyField label="Token (paste in the connector's API key / token field)" value={current} />
          <CopyField label="One-line URL (for clients with only a URL field - token included)" value={`${serverUrl}/${current}`} />

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              className="ad-btn"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Regenerate the connector token? Any AI client using the current token will stop working until you update it.")) return;
                setBusy(true);
                try {
                  setCurrent(await rotateMcpToken());
                } finally {
                  setBusy(false);
                }
              }}
            >
              Regenerate token
            </button>
            <button
              className="ad-btn ad-btn-danger"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Revoke the connector? It turns off completely and any AI client using it loses access until you turn it back on.")) return;
                setBusy(true);
                try {
                  await revokeMcpTokenAction();
                  setCurrent(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Revoke
            </button>
            <span className="text-xs" style={{ color: "var(--ad-muted)" }}>
              Regenerate rotates the token; Revoke turns the connector off.
            </span>
          </div>
        </>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            className="ad-btn ad-btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setCurrent(await rotateMcpToken());
              } finally {
                setBusy(false);
              }
            }}
          >
            Turn on connector
          </button>
          <span className="text-xs" style={{ color: "var(--ad-muted)" }}>
            The connector is off. Turn it on to generate a token and reconnect your AI clients.
          </span>
        </div>
      )}

      {current && !cloudinaryConnected && (
        <p className="mb-4 text-xs" style={{ color: "var(--ad-muted)" }}>
          Cloudinary is not connected, so the assistant will use image URLs directly. Connect Cloudinary above to have it
          upload images into your own media library instead.
        </p>
      )}

      <details className="text-xs" style={{ color: "var(--ad-muted)" }}>
        <summary className="cursor-pointer font-semibold">How to connect</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong>Claude</strong>: Settings - Connectors - Add custom connector. Paste the MCP server URL and your token.
          </li>
          <li>
            <strong>ChatGPT</strong>: Settings - Connectors - Add. Paste the MCP server URL and token (or use the one-line URL).
          </li>
          <li>
            <strong>Perplexity / Grok</strong>: add a custom MCP connector with the server URL and token, or paste the one-line
            URL where only a URL is accepted.
          </li>
        </ul>
      </details>
    </section>
  );
}
