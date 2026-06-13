"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/logout-action";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/menus", label: "Menus" },
  { href: "/admin/redirects", label: "Redirects" },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
  { href: "/admin/users", label: "Users", adminOnly: true },
  { href: "/admin/account", label: "Account" },
];

export function AdminSidebar({
  userName,
  role,
  userImage,
}: {
  userName: string;
  role: "admin" | "editor";
  userImage: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col px-3 py-5">
      <Link href="/admin" className="mb-7 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: "#14110e" }}>
          <svg width="17" height="17" viewBox="0 0 40 40" fill="none">
            <path d="M11 29V13M20 29V13M29 29V13M11 13H29" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[15px] font-bold tracking-tight">Slim Minima</span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.filter((item) => !item.adminOnly || role === "admin").map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={
                active
                  ? { background: "var(--ad-accent-soft)", color: "var(--ad-accent)" }
                  : { color: "var(--ad-muted)" }
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2">
        <a href="/" target="_blank" className="mb-3 block text-xs font-medium" style={{ color: "var(--ad-muted)" }}>
          View site ↗
        </a>
        <Link href="/admin/account" className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ad-accent-soft)] text-[11px] font-bold" style={{ color: "var(--ad-accent)" }}>
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="" className="h-full w-full object-cover" />
            ) : (
              (userName || "?").slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="truncate text-xs font-semibold">{userName}</span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="text-xs font-medium" style={{ color: "var(--ad-muted)" }}>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
