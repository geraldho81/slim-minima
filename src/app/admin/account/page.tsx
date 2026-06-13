import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AccountManager } from "@/components/admin/AccountManager";

export default async function AccountPage() {
  const me = await requireUser();
  const [row] = await db.select({ image: users.image }).from(users).where(eq(users.id, me.id)).limit(1);
  return <AccountManager name={me.name ?? ""} email={me.email ?? ""} role={me.role} image={row?.image ?? null} />;
}
