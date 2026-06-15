import { z } from "zod";
import { defineBlock } from "@/blocks/types";

const schema = z.object({
  heading: z.string(),
  intro: z.string(),
  columns: z.enum(["2", "3", "4"]),
  items: z.array(
    z.object({
      icon: z.string(),
      title: z.string(),
      body: z.string(),
    })
  ),
});

type Props = z.infer<typeof schema>;

export default defineBlock<Props>({
  type: "feature-grid",
  label: "Feature grid",
  description: "Grid of features with icon, title and description",
  icon: "▦",
  schema,
  defaults: {
    heading: "Everything you need",
    intro: "",
    columns: "3",
    items: [
      { icon: "⚡", title: "Fast", body: "Describe the first benefit in a sentence or two." },
      { icon: "🎯", title: "Focused", body: "Describe the second benefit in a sentence or two." },
      { icon: "🔒", title: "Secure", body: "Describe the third benefit in a sentence or two." },
    ],
  },
  fields: [
    { kind: "text", name: "heading", label: "Heading" },
    { kind: "textarea", name: "intro", label: "Intro text", rows: 2 },
    {
      kind: "select",
      name: "columns",
      label: "Columns",
      options: [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
    {
      kind: "list",
      name: "items",
      label: "Features",
      itemLabel: "Feature",
      fields: [
        { kind: "text", name: "icon", label: "Icon (emoji or short text)" },
        { kind: "text", name: "title", label: "Title" },
        { kind: "textarea", name: "body", label: "Description", rows: 2 },
      ],
    },
  ],
  Render: (p) => (
    <section className="cms-container cms-block" data-reveal>
      {(p.heading || p.intro) && (
        <div className="cms-section-head">
          {p.heading && <h2>{p.heading}</h2>}
          {p.intro && <p>{p.intro}</p>}
        </div>
      )}
      <div className="cms-grid" style={{ gridTemplateColumns: `repeat(${p.columns}, 1fr)` }}>
        {p.items.map((item, i) => (
          <div className="cms-card" key={i}>
            {item.icon && <div className="cms-card-icon">{item.icon}</div>}
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  ),
});
