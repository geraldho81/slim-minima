"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { MenuItem } from "@/db/schema";
import { safeHref, linkAttrs } from "@/lib/content";

export function SiteHeader({
  siteName,
  logoUrl,
  items,
}: {
  siteName: string;
  logoUrl: string;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, scrollY);
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`site-header${open ? " site-menu-open" : ""}`}>
      <div className="cms-container site-header-inner">
        <Link href="/" className="site-logo" onClick={close}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} />
          ) : (
            siteName
          )}
        </Link>

        <nav className="site-nav site-nav-desktop" aria-label="Primary navigation">
          {items.map((item) => {
            const children = item.children ?? [];
            if (children.length === 0) {
              return (
                <Link key={item.href} href={safeHref(item.href)} {...linkAttrs({ newTab: item.newTab })}>
                  {item.label}
                </Link>
              );
            }
            return (
              <div key={item.href} className="site-nav-group">
                <Link href={safeHref(item.href)} {...linkAttrs({ newTab: item.newTab })} className="site-nav-parent">
                  {item.label}
                  <span aria-hidden="true" className="site-nav-caret">▾</span>
                </Link>
                <div className="site-dropdown">
                  {children.map((child) => (
                    <Link key={child.href} href={safeHref(child.href)} {...linkAttrs({ newTab: child.newTab })}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <button
          ref={toggleRef}
          className="site-menu-toggle"
          type="button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="site-mobile-menu" data-open={open} aria-hidden={!open}>
        <button
          className="site-mobile-menu-backdrop"
          type="button"
          aria-label="Close navigation menu"
          tabIndex={-1}
          onClick={close}
        />
        <nav id={menuId} className="site-mobile-nav" aria-label="Mobile navigation">
          {items.map((item, index) => (
            <div key={item.href} className="site-mobile-nav-item">
              <Link href={safeHref(item.href)} {...linkAttrs({ newTab: item.newTab })} tabIndex={open ? 0 : -1} onClick={close}>
                <span className="site-mobile-nav-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{item.label}</span>
                <span aria-hidden="true">↗</span>
              </Link>
              {(item.children ?? []).map((child) => (
                <Link
                  key={child.href}
                  href={safeHref(child.href)}
                  {...linkAttrs({ newTab: child.newTab })}
                  className="site-mobile-nav-child"
                  tabIndex={open ? 0 : -1}
                  onClick={close}
                >
                  <span>{child.label}</span>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
