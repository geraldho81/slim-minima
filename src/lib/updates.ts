import "server-only";
import pkg from "../../package.json";

export type SecurityRelease = {
  version: string;
  name: string;
  notes: string;
  url: string;
  publishedAt: string | null;
};

export type UpdateStatus = {
  installed: string;
  latest: string | null;
  pending: SecurityRelease[];
  /** false when GitHub could not be reached - the panel degrades gracefully. */
  checked: boolean;
};

const DEFAULT_REPO = "geraldho81/slim-minima";
const SECURITY_MARKER = /^\s*type:\s*security/i;

type GhRelease = {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
};

export function getInstalledVersion(): string {
  return pkg.version;
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/, "").split(/[.-]/).map((p) => parseInt(p, 10) || 0);
}

/** Positive when a is newer than b, negative when older, 0 when equal. */
function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Drop the "Type: security" marker line and trim for display. */
function cleanNotes(body: string): string {
  return body
    .split("\n")
    .filter((line) => !SECURITY_MARKER.test(line))
    .join("\n")
    .trim();
}

/**
 * Reads the upstream GitHub releases, keeps only those flagged as security
 * (release notes contain a "Type: security" line), and reports which are newer
 * than the installed version. Never throws: a GitHub outage degrades to
 * "could not check" rather than an error page.
 */
export async function getUpdateStatus(): Promise<UpdateStatus> {
  const installed = getInstalledVersion();
  const repo = process.env.SLIM_MINIMA_UPDATE_REPO || DEFAULT_REPO;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { installed, latest: null, pending: [], checked: false };

    const releases = (await res.json()) as GhRelease[];
    const security = releases
      .filter((r) => !r.draft && !r.prerelease && SECURITY_MARKER.test(r.body ?? ""))
      .map((r) => ({
        version: r.tag_name.replace(/^v/, ""),
        name: r.name || r.tag_name,
        notes: cleanNotes(r.body ?? ""),
        url: r.html_url,
        publishedAt: r.published_at,
      }))
      .sort((a, b) => compareVersions(b.version, a.version));

    const latest = security[0]?.version ?? null;
    const pending = security.filter((r) => compareVersions(r.version, installed) > 0);
    return { installed, latest, pending, checked: true };
  } catch {
    return { installed, latest: null, pending: [], checked: false };
  }
}
