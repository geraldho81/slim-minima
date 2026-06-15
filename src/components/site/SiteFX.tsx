"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Lightweight scroll-reveal controller for the public site.
 * Blocks mark elements with data-reveal; this component observes them and
 * adds .sm-in as they enter the viewport.
 *
 * Safety design:
 * - html.reveal-ready is added BEFORE the observer runs, so the CSS can
 *   safely hide [data-reveal] elements only while JS is active.
 * - The class is removed on cleanup (unmount / route change), so a missed
 *   cleanup never leaves content stuck hidden.
 * - A 3s safety timer force-adds .sm-in to anything the observer missed.
 * - prefers-reduced-motion: the CSS overrides opacity to 1 regardless.
 */
export function SiteFX() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const html = document.documentElement;
    html.classList.add("reveal-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("sm-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 }
    );

    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      if (!el.classList.contains("sm-in")) observer.observe(el);
    });

    const timer = setTimeout(() => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.sm-in)").forEach((el) => {
        el.classList.add("sm-in");
      });
    }, 3000);

    return () => {
      html.classList.remove("reveal-ready");
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
