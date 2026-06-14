import Link from "next/link";
import { getMenu, getSettings } from "@/lib/queries";
import type { MenuItem } from "@/db/schema";
import { safeHref } from "@/lib/content";
import { GoogleTagManager } from "@/components/site/GoogleTagManager";
import { SiteHeader } from "@/components/site/SiteHeader";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let settings = { siteName: "Slim Minima", tagline: "", logoUrl: "", footerText: "", social: [] as { label: string; href: string }[], defaultOgImage: "", gtmId: "" };
  let header: MenuItem[] = [];
  let footer: MenuItem[] = [];
  try {
    [settings, header, footer] = await Promise.all([getSettings(), getMenu("header"), getMenu("footer")]);
  } catch {
    // Database not reachable yet (e.g. before first setup) - render shell with defaults.
  }

  return (
    <>
      <GoogleTagManager gtmId={settings.gtmId} />
      <SiteHeader siteName={settings.siteName} logoUrl={settings.logoUrl} items={header} />
      <main>{children}</main>
      <footer className="site-footer">
        <div className="cms-container site-footer-inner">
          <div>
            <p>
              <strong>{settings.siteName}</strong>
              {settings.tagline ? ` - ${settings.tagline}` : ""}
            </p>
            {settings.footerText && <p>{settings.footerText}</p>}
          </div>
          <nav>
            {footer.map((item) => (
              <Link key={item.href} href={safeHref(item.href)}>
                {item.label}
              </Link>
            ))}
            {settings.social.map((item) => (
              <a key={item.href} href={safeHref(item.href)} target="_blank" rel="noreferrer">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--cms-muted, #888)", marginTop: "1rem", textAlign: "center" }}>
          Built on <a href="https://slimminima.xyz" target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>Slim Minima</a>
        </p>
      </footer>
    </>
  );
}
