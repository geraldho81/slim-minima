import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Defense-in-depth gate for the admin surface. Every /admin page and
 * /api/admin route already calls requireUser()/requireAdmin(), but this
 * proxy verifies the session JWT up front so no admin route is ever
 * reachable unauthenticated - even one that forgets its own guard.
 * Next runs proxy files on the Node.js runtime, so the DB-backed auth
 * check works without edge-runtime constraints.
 */
export default auth((req) => {
  if (req.auth?.user) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
