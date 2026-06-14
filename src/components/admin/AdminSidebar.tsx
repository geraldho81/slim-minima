"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/admin/logout-action";

function Icon({ path }: { path: ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {path}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  pages: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 3h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></>,
  posts: <><path d="M4 4h16M4 9h16M4 14h10M4 19h10" /></>,
  categories: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  tags: <><path d="M3 7v5l8 8 7-7-8-8H6a3 3 0 0 0-3 3Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  media: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></>,
  menus: <><circle cx="5" cy="6" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="5" cy="18" r="1.5" /><path d="M10 6h10M10 12h10M10 18h10" /></>,
  redirects: <><path d="M16 3h5v5" /><path d="M21 3 9 15" /><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.4a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.62.78 1 1.42 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
};

type NavItem = { href: string; label: string; icon: string; exact?: boolean; adminOnly?: boolean };

const NAV_MAIN: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/pages", label: "Pages", icon: "pages" },
  { href: "/admin/posts", label: "Posts", icon: "posts" },
  { href: "/admin/categories", label: "Categories", icon: "categories" },
  { href: "/admin/tags", label: "Tags", icon: "tags" },
  { href: "/admin/media", label: "Media", icon: "media" },
  { href: "/admin/menus", label: "Menus", icon: "menus" },
  { href: "/admin/redirects", label: "Redirects", icon: "redirects" },
];

const NAV_FOOT: NavItem[] = [
  { href: "/admin/settings", label: "Settings", icon: "settings", adminOnly: true },
  { href: "/admin/users", label: "Users", icon: "users", adminOnly: true },
  { href: "/admin/account", label: "Account", icon: "account" },
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

  const renderItem = (item: NavItem) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    return (
      <Link key={item.href} href={item.href} className={`ad-nav-item ${active ? "ad-nav-active" : ""}`}>
        <Icon path={ICONS[item.icon]} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col px-3 py-5">
      <Link href="/admin" className="mb-7 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: "var(--ad-accent)" }}>
          <svg width="17" height="17" viewBox="0 0 40 40" fill="none">
            <path d="M11 29V13M20 29V13M29 29V13M11 13H29" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[15px] font-bold tracking-tight">Slim Minima</span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV_MAIN.map(renderItem)}
      </nav>

      <div className="my-3 h-px" style={{ background: "var(--ad-line)" }} />

      <nav className="flex flex-col gap-0.5">
        {NAV_FOOT.filter((item) => !item.adminOnly || role === "admin").map(renderItem)}
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
