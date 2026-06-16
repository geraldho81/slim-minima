"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startSecurityUpdate, connectGithubUpdates, disconnectGithubUpdates } from "@/app/admin/actions";

type Props = {
  version: string;
  connected: boolean;
  repo: string | null;
};

const TOKEN_HELP = "https://github.com/settings/personal-access-tokens/new";

export function SecurityUpdateActions({ version, connected, repo }: Props) {
  const router = useRouter();

  // ---- Connected: a real one-click Update button ----
  if (connected) {
    return <ConnectedActions version={version} repo={repo} onChange={() => router.refresh()} />;
  }

  // ---- Not connected: a one-time connect step ----
  return <ConnectForm repo={repo} onConnected={() => router.refresh()} />;
}

function ConnectedActions({
  version,
  repo,
  onChange,
}: {
  version: string;
  repo: string | null;
  onChange: () => void;
}) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function update() {
    setState("working");
    setMessage("");
    const res = await startSecurityUpdate(version);
    if (res.ok) {
      setState("done");
      setMessage(`Updating to v${version}. Your site redeploys with the fix in a few minutes - this notice clears itself once it is live.`);
    } else {
      setState("error");
      setMessage(res.error ?? "Could not start the update.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {state !== "done" && (
        <button
          type="button"
          onClick={update}
          disabled={state === "working"}
          className="inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--ad-accent)" }}
        >
          {state === "working" ? "Starting..." : `Update to v${version}`}
        </button>
      )}
      {message && <span className="text-xs" style={{ color: state === "error" ? "var(--ad-accent)" : "var(--ad-muted)" }}>{message}</span>}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--ad-muted)" }}>
        <span>Connected to GitHub{repo ? `: ${repo}` : ""}</span>
        <span>·</span>
        <button type="button" onClick={async () => { await disconnectGithubUpdates(); onChange(); }} className="underline">
          Disconnect
        </button>
      </div>
    </div>
  );
}

function ConnectForm({ repo, onConnected }: { repo: string | null; onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [repoInput, setRepoInput] = useState(repo ?? "");
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");

  async function connect() {
    setState("working");
    setError("");
    const res = await connectGithubUpdates({ repo: repoInput, token });
    if (res.ok) {
      setToken("");
      onConnected();
    } else {
      setState("error");
      setError(res.error ?? "Could not connect.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
        style={{ background: "var(--ad-accent)" }}
      >
        Connect GitHub to enable one-click updates
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg p-4" style={{ background: "var(--ad-accent-soft)" }}>
      <p className="text-xs" style={{ color: "var(--ad-muted)" }}>
        Connect once and updating becomes a single click. Create a GitHub token, give it
        the <strong>Actions: Read and write</strong> permission on your site repository,
        then paste it here. It is stored only in your own site and used only to start the
        update workflow.
      </p>
      <a href={TOKEN_HELP} target="_blank" rel="noreferrer" className="w-fit text-xs font-semibold underline" style={{ color: "var(--ad-accent)" }}>
        Create a token on GitHub ↗
      </a>
      <div className="ad-field">
        <label className="ad-label">Repository (owner/name)</label>
        <input className="ad-input" value={repoInput} placeholder="acme/acme-website" onChange={(e) => setRepoInput(e.target.value)} />
      </div>
      <div className="ad-field">
        <label className="ad-label">GitHub token</label>
        <input className="ad-input" type="password" value={token} placeholder="github_pat_..." onChange={(e) => setToken(e.target.value)} />
      </div>
      {error && <span className="text-xs" style={{ color: "var(--ad-accent)" }}>{error}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={connect}
          disabled={state === "working"}
          className="inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--ad-accent)" }}
        >
          {state === "working" ? "Connecting..." : "Connect"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs underline" style={{ color: "var(--ad-muted)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
