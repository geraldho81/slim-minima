import { desc } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { CloudinarySettings } from "@/components/admin/CloudinarySettings";
import { IntegrationsSettings } from "@/components/admin/IntegrationsSettings";
import { ApiKeysSection } from "@/components/admin/ApiKeysSection";
import { McpConnector } from "@/components/admin/McpConnector";
import { siteUrl } from "@/lib/site-url";
import { getLivePages } from "@/lib/queries";
import { getOrCreateMcpToken } from "@/lib/mcp/token";
import { SecurityUpdates } from "@/components/admin/SecurityUpdates";
import { getUpdateStatus } from "@/lib/updates";

export default async function SettingsPage() {
  const user = await requireAdmin();
  const [rows, keys, updateStatus, livePages] = await Promise.all([
    db.select().from(settings),
    db.select({ id: apiKeys.id, name: apiKeys.name, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys).orderBy(desc(apiKeys.createdAt)),
    getUpdateStatus(),
    getLivePages(),
  ]);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const pages = livePages.map((p) => ({ slug: p.slug, title: p.title }));

  const envManaged = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const integrationsEnv = {
    resendKey: !!process.env.RESEND_API_KEY,
    emailFrom: !!process.env.EMAIL_FROM,
    emailTo: !!process.env.EMAIL_TO,
    folder: !!process.env.CLOUDINARY_FOLDER,
    ttl: !!process.env.MEDIA_TRASH_TTL_DAYS,
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>
      <SecurityUpdates status={updateStatus} />
      <SettingsForm
        initial={{
          siteName: (map.siteName as string) ?? "Slim Minima",
          tagline: (map.tagline as string) ?? "",
          logoUrl: (map.logoUrl as string) ?? "",
          defaultOgImage: (map.defaultOgImage as string) ?? "",
          footerText: (map.footerText as string) ?? "",
          social: (map.social as { label: string; href: string }[]) ?? [],
          gtmId: (map.gtmId as string) ?? "",
          homePage: (map.homePage as string) ?? "home",
        }}
        pages={pages}
      />
      <CloudinarySettings
        initial={{
          cloudName: (map.cloudinaryCloudName as string) ?? "",
          apiKey: (map.cloudinaryApiKey as string) ?? "",
          secretSet: !!map.cloudinaryApiSecret,
        }}
        envManaged={envManaged}
      />
      <IntegrationsSettings
        initial={{
          emailFrom: (map.emailFrom as string) ?? "",
          emailTo: (map.emailTo as string) ?? "",
          resendKeySet: !!map.resendApiKey,
          cloudinaryFolder: (map.cloudinaryFolder as string) ?? "",
          mediaTrashTtlDays: (map.mediaTrashTtlDays as string) ?? "",
        }}
        env={integrationsEnv}
      />
      {user.role === "admin" && (
        <>
          <McpConnector
            serverUrl={`${siteUrl()}/api/mcp`}
            token={await getOrCreateMcpToken()}
            cloudinaryConnected={envManaged || !!map.cloudinaryApiSecret}
          />
          <ApiKeysSection
            initial={keys.map((k) => ({
              ...k,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </>
      )}
    </div>
  );
}
