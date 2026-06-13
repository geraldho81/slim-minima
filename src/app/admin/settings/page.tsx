import { desc } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { CloudinarySettings } from "@/components/admin/CloudinarySettings";
import { IntegrationsSettings } from "@/components/admin/IntegrationsSettings";
import { ApiKeysSection } from "@/components/admin/ApiKeysSection";

export default async function SettingsPage() {
  const user = await requireAdmin();
  const [rows, keys] = await Promise.all([
    db.select().from(settings),
    db.select({ id: apiKeys.id, name: apiKeys.name, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys).orderBy(desc(apiKeys.createdAt)),
  ]);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

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
      <SettingsForm
        initial={{
          siteName: (map.siteName as string) ?? "Slim Minima",
          tagline: (map.tagline as string) ?? "",
          logoUrl: (map.logoUrl as string) ?? "",
          defaultOgImage: (map.defaultOgImage as string) ?? "",
          footerText: (map.footerText as string) ?? "",
          social: (map.social as { label: string; href: string }[]) ?? [],
          gtmId: (map.gtmId as string) ?? "",
        }}
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
        <ApiKeysSection
          initial={keys.map((k) => ({
            ...k,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      )}
    </div>
  );
}
