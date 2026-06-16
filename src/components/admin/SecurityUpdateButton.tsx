"use client";

import { useState } from "react";
import { startSecurityUpdate } from "@/app/admin/actions";

type Props = {
  version: string;
  canDispatch: boolean;
  runWorkflowUrl: string | null;
};

export function SecurityUpdateButton({ version, canDispatch, runWorkflowUrl }: Props) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  // No token: send the developer to the Action's "Run workflow" page instead of
  // storing repo write access in the CMS.
  if (!canDispatch) {
    if (!runWorkflowUrl) {
      return (
        <p className="text-xs" style={{ color: "var(--ad-muted)" }}>
          To enable updating, set SLIM_MINIMA_SITE_REPO (and optionally a token) in your environment.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <a
          href={runWorkflowUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--ad-accent)" }}
        >
          Update to v{version} on GitHub ↗
        </a>
        <span className="text-xs" style={{ color: "var(--ad-muted)" }}>
          Opens the update workflow. Run it, then review and merge the pull request it creates.
        </span>
      </div>
    );
  }

  async function run() {
    setState("working");
    setMessage("");
    const res = await startSecurityUpdate(version);
    if (res.ok) {
      setState("done");
      setMessage("Update started. A pull request will appear in your repository shortly. Review and merge it to deploy the fix.");
    } else {
      setState("error");
      setMessage(res.error ?? "Could not start the update.");
    }
  }

  if (state === "done") {
    return <p className="text-xs font-medium" style={{ color: "var(--ad-text)" }}>{message}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={state === "working"}
        className="inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--ad-accent)" }}
      >
        {state === "working" ? "Starting..." : `Update to v${version}`}
      </button>
      {message && (
        <span className="text-xs" style={{ color: "var(--ad-muted)" }}>{message}</span>
      )}
    </div>
  );
}
