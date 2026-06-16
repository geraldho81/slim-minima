import Link from "next/link";

export function SecurityUpdateBanner({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <Link
      href="/admin/settings"
      className="block px-8 py-2.5 text-center text-xs font-semibold text-white"
      style={{ background: "var(--ad-accent)" }}
    >
      {count} security update{count > 1 ? "s" : ""} available. Open Settings to review.
    </Link>
  );
}
