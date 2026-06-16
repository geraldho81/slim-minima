import type { UpdateStatus } from "@/lib/updates";
import { getApplyConfig } from "@/lib/updates";
import { SecurityUpdateActions } from "@/components/admin/SecurityUpdateButton";

export async function SecurityUpdates({ status }: { status: UpdateStatus }) {
  const count = status.pending.length;
  const apply = await getApplyConfig();
  const target = status.pending[0]?.version ?? null;

  return (
    <section className="mb-6 rounded-xl bg-white p-5">
      <h2 className="mb-1 text-sm font-bold tracking-tight">Security updates</h2>
      <p className="mb-4 text-xs" style={{ color: "var(--ad-muted)" }}>
        Slim Minima checks GitHub for security releases. Feature and layout changes stay
        in your own repository; only security fixes show up here.
      </p>

      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--ad-muted)" }}>
        <span>Installed version</span>
        <span className="font-semibold" style={{ color: "var(--ad-text)" }}>v{status.installed}</span>
      </div>

      {count === 0 ? (
        <p className="mt-3 text-sm font-medium">
          {status.checked
            ? "You are up to date."
            : "Could not reach GitHub to check. Showing your installed version only."}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--ad-accent)" }}>
            {count} security update{count > 1 ? "s" : ""} available
          </p>
          {status.pending.map((r) => {
            const heading = r.name && r.name !== `v${r.version}` ? `v${r.version}: ${r.name}` : `v${r.version}`;
            return (
              <div key={r.version} className="rounded-lg p-3" style={{ background: "var(--ad-accent-soft)" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">{heading}</span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs font-medium"
                    style={{ color: "var(--ad-accent)" }}
                  >
                    View on GitHub ↗
                  </a>
                </div>
                {r.notes && (
                  <p className="mt-1 whitespace-pre-line text-xs" style={{ color: "var(--ad-muted)" }}>
                    {r.notes}
                  </p>
                )}
              </div>
            );
          })}
          {target && (
            <SecurityUpdateActions
              version={target}
              connected={apply.connected}
              repo={apply.repo}
            />
          )}
          <p className="text-xs" style={{ color: "var(--ad-muted)" }}>
            Updating changes only Slim Minima security files and the version number, then
            redeploys your site. Your blocks, theme, and content are not touched.
          </p>
        </div>
      )}
    </section>
  );
}
