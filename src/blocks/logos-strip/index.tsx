import { z } from "zod";
import { defineBlock } from "@/blocks/types";
import { safeHref, linkAttrs } from "@/lib/content";

const schema = z.object({
  heading: z.string(),
  logos: z.array(
    z.object({
      url: z.string(),
      alt: z.string(),
      href: z.string().default(""),
      newTab: z.boolean().default(false),
    })
  ),
});

type Props = z.infer<typeof schema>;

export default defineBlock<Props>({
  type: "logos-strip",
  label: "Logo strip",
  description: "Row of partner or client logos",
  icon: "◦◦◦",
  schema,
  defaults: { heading: "Trusted by teams everywhere", logos: [] },
  fields: [
    { kind: "text", name: "heading", label: "Heading" },
    {
      kind: "list",
      name: "logos",
      label: "Logos",
      itemLabel: "Logo",
      fields: [
        { kind: "image", name: "url", label: "Logo image" },
        { kind: "text", name: "alt", label: "Company name" },
        { kind: "text", name: "href", label: "Link (optional)" },
        { kind: "toggle", name: "newTab", label: "Open link in a new tab", help: "Keeps your site open behind the new page. Use this for links to other websites." },
      ],
    },
  ],
  Render: (p) => (
    <div className="cms-container cms-block">
      {p.heading && <p className="cms-logos-heading">{p.heading}</p>}
      {p.logos.length === 0 ? (
        <div className="cms-image-placeholder">Add logos in the settings panel</div>
      ) : (
        <div className="cms-logos">
          {p.logos.map((logo, i) =>
            logo.href ? (
              <a key={i} href={safeHref(logo.href)} {...linkAttrs({ newTab: logo.newTab })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.url} alt={logo.alt} />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={logo.url} alt={logo.alt} />
            )
          )}
        </div>
      )}
    </div>
  ),
});
