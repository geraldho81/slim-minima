import { z } from "zod";
import { defineBlock } from "@/blocks/types";
import { safeHref, linkAttrs } from "@/lib/content";

const schema = z.object({
  eyebrow: z.string(),
  heading: z.string(),
  subheading: z.string(),
  primaryLabel: z.string(),
  primaryHref: z.string(),
  primaryNewTab: z.boolean().default(false),
  secondaryLabel: z.string(),
  secondaryHref: z.string(),
  secondaryNewTab: z.boolean().default(false),
  imageUrl: z.string(),
  imageAlt: z.string(),
  align: z.enum(["center", "left"]),
});

type Props = z.infer<typeof schema>;

export default defineBlock<Props>({
  type: "hero",
  label: "Hero",
  description: "Large opening section with heading, subheading and calls to action",
  icon: "🏔",
  schema,
  defaults: {
    eyebrow: "Welcome",
    heading: "A headline that earns attention",
    subheading: "One or two sentences that explain what this site offers and why it matters.",
    primaryLabel: "Get started",
    primaryHref: "/contact",
    primaryNewTab: false,
    secondaryLabel: "",
    secondaryHref: "",
    secondaryNewTab: false,
    imageUrl: "",
    imageAlt: "",
    align: "center",
  },
  fields: [
    { kind: "text", name: "eyebrow", label: "Eyebrow" },
    { kind: "text", name: "heading", label: "Heading" },
    { kind: "textarea", name: "subheading", label: "Subheading", rows: 3 },
    { kind: "text", name: "primaryLabel", label: "Primary button label" },
    { kind: "text", name: "primaryHref", label: "Primary button link" },
    { kind: "toggle", name: "primaryNewTab", label: "Open primary button in a new tab", help: "Keeps your site open behind the new page. Use this for links to other websites." },
    { kind: "text", name: "secondaryLabel", label: "Secondary button label" },
    { kind: "text", name: "secondaryHref", label: "Secondary button link" },
    { kind: "toggle", name: "secondaryNewTab", label: "Open secondary button in a new tab", help: "Keeps your site open behind the new page. Use this for links to other websites." },
    { kind: "image", name: "imageUrl", label: "Image" },
    { kind: "text", name: "imageAlt", label: "Image alt text" },
    {
      kind: "select",
      name: "align",
      label: "Alignment",
      options: [
        { value: "center", label: "Centered" },
        { value: "left", label: "Left" },
      ],
    },
  ],
  Render: (p) => (
    <section className={`cms-hero ${p.align === "left" ? "cms-hero-left" : ""}`}>
      <div className="cms-container">
        <div className="cms-hero-inner">
          <div className="cms-hero-copy">
            {p.eyebrow && <p className="cms-eyebrow">{p.eyebrow}</p>}
            <h1>{p.heading}</h1>
            {p.subheading && <p className="cms-hero-sub">{p.subheading}</p>}
            {(p.primaryLabel || p.secondaryLabel) && (
              <div className="cms-hero-actions">
                {p.primaryLabel && (
                  <a className="cms-btn cms-btn-primary" href={safeHref(p.primaryHref)} {...linkAttrs({ newTab: p.primaryNewTab })}>
                    {p.primaryLabel}
                  </a>
                )}
                {p.secondaryLabel && (
                  <a className="cms-btn cms-btn-ghost" href={safeHref(p.secondaryHref)} {...linkAttrs({ newTab: p.secondaryNewTab })}>
                    {p.secondaryLabel}
                  </a>
                )}
              </div>
            )}
          </div>
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="cms-hero-image" src={p.imageUrl} alt={p.imageAlt} />
          )}
        </div>
      </div>
    </section>
  ),
});
