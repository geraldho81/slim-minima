import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { IntegrationsProvider } from "@/components/admin/IntegrationsContext";
import { isCloudinaryConfigured } from "@/lib/cloudinary-config";
import { getResendConfig } from "@/lib/integration-config";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [[me], cloudinary, resend] = await Promise.all([
    db.select({ image: users.image }).from(users).where(eq(users.id, user.id)).limit(1),
    isCloudinaryConfigured(),
    getResendConfig().then((c) => !!c.apiKey),
  ]);

  return (
    <IntegrationsProvider value={{ cloudinary, resend }}>
      <div className="flex min-h-screen" style={{ background: "var(--ad-bg)", color: "var(--ad-text)" }}>
        <AdminSidebar userName={user.name ?? user.email ?? ""} role={user.role} userImage={me?.image ?? null} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </IntegrationsProvider>
  );
}
