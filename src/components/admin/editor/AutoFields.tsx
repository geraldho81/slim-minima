"use client";

import { useEffect, useState } from "react";
import type { FieldSpec } from "@/blocks/types";
import { listPagesForPicker, listContactFormsForPicker } from "@/app/admin/actions";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { CloudinaryNotice } from "@/components/admin/CloudinaryNotice";
import { RichTextField } from "@/components/admin/editor/RichTextField";

/** Renders a settings form from a block's declarative field specs. */
export function AutoFields({
  fields,
  values,
  onChange,
}: {
  fields: FieldSpec[];
  values: Record<string, unknown>;
  onChange: (partial: Record<string, unknown>) => void;
}) {
  return (
    <>
      {fields.map((field) => (
        <Field key={field.name} field={field} value={values[field.name]} onChange={(v) => onChange({ [field.name]: v })} />
      ))}
    </>
  );
}

function Field({ field, value, onChange }: { field: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.kind) {
    case "text":
      return (
        <div className="ad-field">
          <label className="ad-label">{field.label}</label>
          <input className="ad-input" value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "textarea":
      return (
        <div className="ad-field">
          <label className="ad-label">{field.label}</label>
          <textarea className="ad-textarea" rows={field.rows ?? 3} value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "number":
      return (
        <div className="ad-field">
          <label className="ad-label">{field.label}</label>
          <input
            className="ad-input"
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={(value as number) ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      );
    case "toggle":
      return (
        <div className="ad-field flex items-start gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            aria-label={field.label}
            onClick={() => onChange(!value)}
            className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors"
            style={{ background: value ? "var(--ad-accent)" : "#d6d6d0" }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
              style={{ left: value ? "calc(100% - 18px)" : "2px" }}
            />
          </button>
          <button type="button" className="min-w-0 text-left" onClick={() => onChange(!value)}>
            <span className="block text-xs font-semibold" style={{ color: "var(--ad-text)" }}>{field.label}</span>
            {field.help && (
              <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--ad-muted)" }}>{field.help}</span>
            )}
          </button>
        </div>
      );
    case "select":
      return (
        <div className="ad-field">
          <label className="ad-label">{field.label}</label>
          <select className="ad-select" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "image":
      return <ImageField label={field.label} value={(value as string) ?? ""} onChange={onChange} />;
    case "page":
      return <PageField label={field.label} placeholder={field.placeholder} value={(value as string) ?? ""} onChange={onChange} />;
    case "contactForm":
      return <ContactFormField label={field.label} placeholder={field.placeholder} value={(value as string) ?? ""} onChange={onChange} />;
    case "richtext":
      return (
        <div className="ad-field">
          <label className="ad-label">{field.label}</label>
          <RichTextField value={(value as string) ?? ""} onChange={onChange} />
        </div>
      );
    case "list":
      return <ListField field={field} value={(value as Record<string, unknown>[]) ?? []} onChange={onChange} />;
  }
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ad-field">
      <label className="ad-label">{label}</label>
      {value ? (
        <div className="mb-1.5 overflow-hidden rounded-lg bg-[var(--ad-bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="max-h-32 w-full object-cover" />
        </div>
      ) : null}
      <div className="flex gap-1.5">
        <button type="button" className="ad-btn ad-btn-soft flex-1" onClick={() => setOpen(true)}>
          {value ? "Replace" : "Choose image"}
        </button>
        {value && (
          <button type="button" className="ad-btn ad-btn-soft" onClick={() => onChange("")}>
            Clear
          </button>
        )}
      </div>
      <CloudinaryNotice className="mt-1.5" />
      {open && <MediaPicker onSelect={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

type PageOption = { path: string; title: string; status: string };

function PageField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [pages, setPages] = useState<PageOption[] | null>(null);

  useEffect(() => {
    listPagesForPicker()
      .then(setPages)
      .catch(() => setPages([]));
  }, []);

  // The stored value may point at a page that no longer exists (or one not yet
  // loaded); keep it selectable so it is never silently dropped.
  const known = pages?.some((p) => p.path === value);

  return (
    <div className="ad-field">
      <label className="ad-label">{label}</label>
      <select className="ad-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder ?? "Select a page..."}</option>
        {pages?.map((p) => (
          <option key={p.path} value={p.path}>
            {p.title} ({p.path}){p.status !== "published" ? " - draft" : ""}
          </option>
        ))}
        {value && !known && <option value={value}>{value}</option>}
      </select>
      <p className="mt-1 text-[11px]" style={{ color: "var(--ad-muted)" }}>
        Pick a page you have created. Create the thank-you page first under Pages, then choose it here.
      </p>
    </div>
  );
}

type ContactFormOption = { id: string; name: string };

function ContactFormField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [forms, setForms] = useState<ContactFormOption[] | null>(null);

  useEffect(() => {
    listContactFormsForPicker()
      .then(setForms)
      .catch(() => setForms([]));
  }, []);

  const known = forms?.some((f) => f.id === value);

  return (
    <div className="ad-field">
      <label className="ad-label">{label}</label>
      <select className="ad-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder ?? "Select a form..."}</option>
        {forms?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
        {value && !known && <option value={value}>{value}</option>}
      </select>
      <p className="mt-1 text-[11px]" style={{ color: "var(--ad-muted)" }}>
        Build and manage forms under Contacts, then pick one here. Editing the form updates every page that uses it.
      </p>
    </div>
  );
}

function ListField({
  field,
  value,
  onChange,
}: {
  field: Extract<FieldSpec, { kind: "list" }>;
  value: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(value.length ? null : null);

  function emptyItem(): Record<string, unknown> {
    const item: Record<string, unknown> = {};
    for (const f of field.fields) {
      item[f.name] = f.kind === "toggle" ? false : f.kind === "number" ? 0 : "";
    }
    return item;
  }

  return (
    <div className="ad-field">
      <label className="ad-label">{field.label}</label>
      <div className="flex flex-col gap-1.5">
        {value.map((item, i) => {
          const title =
            (Object.values(item).find((v) => typeof v === "string" && v) as string | undefined) ?? `${field.itemLabel} ${i + 1}`;
          const open = openIndex === i;
          return (
            <div key={i} className="rounded-lg bg-[var(--ad-bg)]">
              <div className="flex items-center gap-1 px-2.5 py-2">
                <button type="button" className="min-w-0 flex-1 truncate text-left text-xs font-semibold" onClick={() => setOpenIndex(open ? null : i)}>
                  {title}
                </button>
                <button
                  type="button"
                  className="px-1 text-xs"
                  style={{ color: "var(--ad-muted)" }}
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...value];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    onChange(next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1 text-xs"
                  style={{ color: "var(--ad-muted)" }}
                  disabled={i === value.length - 1}
                  onClick={() => {
                    const next = [...value];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    onChange(next);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="px-1 text-xs"
                  style={{ color: "var(--ad-danger)" }}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
              {open && (
                <div className="px-2.5 pb-2.5">
                  <AutoFields
                    fields={field.fields}
                    values={item}
                    onChange={(partial) => onChange(value.map((it, j) => (j === i ? { ...it, ...partial } : it)))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="ad-btn ad-btn-soft mt-1.5 w-full"
        onClick={() => {
          onChange([...value, emptyItem()]);
          setOpenIndex(value.length);
        }}
      >
        + Add {field.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}
