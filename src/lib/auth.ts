import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const { db } = await import("@/db");
        const { users } = await import("@/db/schema");
        const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = rows[0];
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        return token;
      }
      // On every later request, re-check the DB so a demoted or deleted user
      // loses access immediately instead of keeping their stale JWT role until
      // it expires. Returning null invalidates the session.
      if (token.id) {
        const { db } = await import("@/db");
        const { users } = await import("@/db/schema");
        const rows = await db.select({ role: users.role }).from(users).where(eq(users.id, token.id as string)).limit(1);
        if (!rows[0]) return null;
        token.role = rows[0].role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "admin" | "editor") ?? "editor";
      }
      return session;
    },
  },
});

/** Server-side guard for admin pages and actions. Redirects to /login when signed out. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/admin");
  return user;
}
