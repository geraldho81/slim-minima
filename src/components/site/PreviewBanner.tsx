/** Sticky notice shown on /preview routes so editors know this URL is private. */
export function PreviewBanner({ status }: { status: string }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#1a1a1a",
        color: "#fff",
        textAlign: "center",
        padding: "0.5rem 1rem",
        fontSize: "0.85rem",
      }}
    >
      Preview. Only signed-in editors can see this, and search engines never index it.{" "}
      <span style={{ opacity: 0.7 }}>Status: {status}</span>
    </div>
  );
}
