import { z } from "zod";
import { defineBlock } from "@/blocks/types";
import { safeHref, linkAttrs } from "@/lib/content";

const schema = z.object({
  heading: z.string(),
  body: z.string(),
  buttonLabel: z.string(),
  buttonHref: z.string(),
  buttonNewTab: z.boolean().default(false),
  tone: z.enum(["accent", "soft"]),
});

type Props = z.infer<typeof schema>;

export default defineBlock<Props>({
  type: "cta",
  label: "Call to action",
  description: "Banner with heading and a button",
  icon: "→",
  schema,
  defaults: {
    heading: "Ready to get started?",
    body: "Join today, it only takes a minute.",
    buttonLabel: "Get started",
    buttonHref: "/contact",
    buttonNewTab: false,
    tone: "accent",
  },
  fields: [
    { kind: "text", name: "heading", label: "Heading" },
    { kind: "textarea", name: "body", label: "Body", rows: 2 },
    { kind: "text", name: "buttonLabel", label: "Button label" },
    { kind: "text", name: "buttonHref", label: "Button link" },
    { kind: "toggle", name: "buttonNewTab", label: "Open link in a new tab", help: "Keeps your site open behind the new page. Use this for links to other websites." },
    {
      kind: "select",
      name: "tone",
      label: "Style",
      options: [
        { value: "accent", label: "Accent" },
        { value: "soft", label: "Soft" },
      ],
    },
  ],
  Render: (p) => (
    <div className="cms-container cms-block" data-reveal>
      <div className={`cms-cta cms-cta-${p.tone}`}>
        <div>
          <h2>{p.heading}</h2>
          {p.body && <p>{p.body}</p>}
        </div>
        {p.buttonLabel && (
          <a className={`cms-btn ${p.tone === "accent" ? "cms-btn-inverse" : "cms-btn-primary"}`} href={safeHref(p.buttonHref)} {...linkAttrs({ newTab: p.buttonNewTab })}>
            {p.buttonLabel}
          </a>
        )}
      </div>
    </div>
  ),
});
