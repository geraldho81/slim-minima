import { z } from "zod";
import { defineBlock } from "@/blocks/types";

const schema = z.object({
  quote: z.string(),
  name: z.string(),
  role: z.string(),
  avatarUrl: z.string(),
});

type Props = z.infer<typeof schema>;

export default defineBlock<Props>({
  type: "testimonial",
  label: "Testimonial",
  description: "Customer quote with attribution",
  icon: "❝",
  schema,
  defaults: {
    quote: "This product changed how we work. The quote goes here.",
    name: "Jane Smith",
    role: "Founder, Example Co",
    avatarUrl: "",
  },
  fields: [
    { kind: "textarea", name: "quote", label: "Quote", rows: 3 },
    { kind: "text", name: "name", label: "Name" },
    { kind: "text", name: "role", label: "Role / company" },
    { kind: "image", name: "avatarUrl", label: "Avatar" },
  ],
  Render: (p) => (
    <div className="cms-container cms-block cms-narrow" data-reveal>
      <figure className="cms-testimonial">
        <blockquote>{p.quote}</blockquote>
        <figcaption>
          {p.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt={p.name} />
          )}
          <div>
            <strong>{p.name}</strong>
            {p.role && <span>{p.role}</span>}
          </div>
        </figcaption>
      </figure>
    </div>
  ),
});
