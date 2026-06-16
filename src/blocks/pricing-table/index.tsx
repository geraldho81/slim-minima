import { z } from "zod";
import { defineBlock } from "@/blocks/types";
import { safeHref, linkAttrs } from "@/lib/content";

const schema = z.object({
  heading: z.string(),
  tiers: z.array(
    z.object({
      name: z.string(),
      price: z.string(),
      period: z.string(),
      description: z.string(),
      features: z.string(),
      buttonLabel: z.string(),
      buttonHref: z.string(),
      buttonNewTab: z.boolean().default(false),
      highlighted: z.boolean(),
    })
  ),
});

type Props = z.infer<typeof schema>;

export default defineBlock<Props>({
  type: "pricing-table",
  label: "Pricing",
  description: "Pricing tiers side by side",
  icon: "$",
  schema,
  defaults: {
    heading: "Simple pricing",
    tiers: [
      {
        name: "Starter",
        price: "$0",
        period: "forever",
        description: "For trying things out",
        features: "1 project\nCommunity support",
        buttonLabel: "Start free",
        buttonHref: "#",
        buttonNewTab: false,
        highlighted: false,
      },
      {
        name: "Pro",
        price: "$19",
        period: "per month",
        description: "For serious work",
        features: "Unlimited projects\nPriority support\nAdvanced features",
        buttonLabel: "Go Pro",
        buttonHref: "#",
        buttonNewTab: false,
        highlighted: true,
      },
    ],
  },
  fields: [
    { kind: "text", name: "heading", label: "Heading" },
    {
      kind: "list",
      name: "tiers",
      label: "Tiers",
      itemLabel: "Tier",
      fields: [
        { kind: "text", name: "name", label: "Name" },
        { kind: "text", name: "price", label: "Price" },
        { kind: "text", name: "period", label: "Period (e.g. per month)" },
        { kind: "text", name: "description", label: "Description" },
        { kind: "textarea", name: "features", label: "Features (one per line)", rows: 4 },
        { kind: "text", name: "buttonLabel", label: "Button label" },
        { kind: "text", name: "buttonHref", label: "Button link" },
        { kind: "toggle", name: "buttonNewTab", label: "Open link in a new tab", help: "Keeps your site open behind the new page. Use this for links to other websites." },
        { kind: "toggle", name: "highlighted", label: "Highlight this tier" },
      ],
    },
  ],
  Render: (p) => (
    <section className="cms-container cms-block">
      {p.heading && (
        <div className="cms-section-head">
          <h2>{p.heading}</h2>
        </div>
      )}
      <div className="cms-grid" style={{ gridTemplateColumns: `repeat(${Math.min(p.tiers.length, 4) || 1}, 1fr)` }}>
        {p.tiers.map((tier, i) => (
          <div className={`cms-card cms-pricing ${tier.highlighted ? "cms-pricing-hot" : ""}`} key={i}>
            <h3>{tier.name}</h3>
            <div className="cms-price">
              {tier.price}
              {tier.period && <span> {tier.period}</span>}
            </div>
            {tier.description && <p className="cms-pricing-desc">{tier.description}</p>}
            <ul>
              {tier.features
                .split("\n")
                .filter(Boolean)
                .map((f, j) => (
                  <li key={j}>{f}</li>
                ))}
            </ul>
            {tier.buttonLabel && (
              <a className={`cms-btn ${tier.highlighted ? "cms-btn-primary" : "cms-btn-ghost"}`} href={safeHref(tier.buttonHref)} {...linkAttrs({ newTab: tier.buttonNewTab })}>
                {tier.buttonLabel}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  ),
});
