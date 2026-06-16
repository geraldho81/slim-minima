"use client";

import { useState } from "react";
import type { MenuItem } from "@/db/schema";
import { saveMenu } from "@/app/admin/actions";

type PageOption = { label: string; href: string };

export function MenusEditor({ header, footer, pageOptions }: { header: MenuItem[]; footer: MenuItem[]; pageOptions: PageOption[] }) {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Menus</h1>
      <SingleMenu name="header" label="Header navigation" initial={header} pageOptions={pageOptions} allowSubitems />
      <SingleMenu name="footer" label="Footer links" initial={footer} pageOptions={pageOptions} />
    </div>
  );
}

function SingleMenu({
  name,
  label,
  initial,
  pageOptions,
  allowSubitems = false,
}: {
  name: string;
  label: string;
  initial: MenuItem[];
  pageOptions: PageOption[];
  allowSubitems?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  async function persist(next: MenuItem[]) {
    setItems(next);
    setState("saving");
    await saveMenu(name, next);
    setState("saved");
    setTimeout(() => setState("idle"), 1500);
  }

  function updateItem(i: number, patch: Partial<MenuItem>) {
    persist(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...items];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    persist(next);
  }

  return (
    <section className="mb-6 rounded-xl bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight">{label}</h2>
        <span className="text-xs" style={{ color: "var(--ad-muted)" }}>
          {state === "saving" ? "Saving..." : state === "saved" ? "Saved" : ""}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg p-2" style={{ background: "var(--ad-bg)" }}>
            <ItemRow
              item={item}
              listId={`pages-${name}`}
              onChange={(patch) => updateItem(i, patch)}
              onUp={i === 0 ? undefined : () => move(i, -1)}
              onDown={i === items.length - 1 ? undefined : () => move(i, 1)}
              onDelete={() => persist(items.filter((_, j) => j !== i))}
            />

            {allowSubitems && (
              <div className="ml-6 mt-2 flex flex-col gap-2">
                {(item.children ?? []).map((child, ci) => (
                  <ItemRow
                    key={ci}
                    item={child}
                    listId={`pages-${name}`}
                    onChange={(patch) =>
                      updateItem(i, { children: (item.children ?? []).map((c, j) => (j === ci ? { ...c, ...patch } : c)) })
                    }
                    onUp={
                      ci === 0
                        ? undefined
                        : () => {
                            const next = [...(item.children ?? [])];
                            [next[ci - 1], next[ci]] = [next[ci], next[ci - 1]];
                            updateItem(i, { children: next });
                          }
                    }
                    onDown={
                      ci === (item.children ?? []).length - 1
                        ? undefined
                        : () => {
                            const next = [...(item.children ?? [])];
                            [next[ci], next[ci + 1]] = [next[ci + 1], next[ci]];
                            updateItem(i, { children: next });
                          }
                    }
                    onDelete={() => updateItem(i, { children: (item.children ?? []).filter((_, j) => j !== ci) })}
                  />
                ))}
                <button
                  className="ad-btn ad-btn-soft w-fit text-xs"
                  onClick={() => updateItem(i, { children: [...(item.children ?? []), { label: "", href: "" }] })}
                >
                  + Add sub-item
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <datalist id={`pages-${name}`}>
        {pageOptions.map((p) => (
          <option key={p.href} value={p.href}>
            {p.label}
          </option>
        ))}
      </datalist>

      <button className="ad-btn ad-btn-soft mt-3" onClick={() => persist([...items, { label: "", href: "" }])}>
        + Add item
      </button>
    </section>
  );
}

function ItemRow({
  item,
  listId,
  onChange,
  onUp,
  onDown,
  onDelete,
}: {
  item: MenuItem;
  listId: string;
  onChange: (patch: Partial<MenuItem>) => void;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="ad-input"
        style={{ background: "#fff" }}
        placeholder="Label"
        value={item.label}
        onChange={(e) => onChange({ label: e.target.value })}
      />
      <input
        className="ad-input"
        style={{ background: "#fff" }}
        placeholder="/about or https://..."
        value={item.href}
        list={listId}
        onChange={(e) => onChange({ href: e.target.value })}
      />
      <label className="flex shrink-0 items-center gap-1 text-xs" style={{ color: "var(--ad-muted)" }} title="Open this link in a new tab">
        <input type="checkbox" checked={!!item.newTab} onChange={(e) => onChange({ newTab: e.target.checked })} />
        New tab
      </label>
      <button className="px-1 text-xs disabled:opacity-30" style={{ color: "var(--ad-muted)" }} disabled={!onUp} onClick={onUp}>
        ↑
      </button>
      <button className="px-1 text-xs disabled:opacity-30" style={{ color: "var(--ad-muted)" }} disabled={!onDown} onClick={onDown}>
        ↓
      </button>
      <button className="px-1 text-xs" style={{ color: "var(--ad-danger)" }} onClick={onDelete}>
        ✕
      </button>
    </div>
  );
}
