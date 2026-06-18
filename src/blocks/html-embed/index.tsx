import { z } from "zod";
import { defineBlock } from "@/blocks/types";

const schema = z.object({
  html: z.string(),
});

type Props = z.infer<typeof schema>;

/** Raw HTML escape hatch. Trusted editors only - rendered with dangerouslySetInnerHTML. */
export default defineBlock<Props>({
  type: "html-embed",
  label: "HTML embed",
  description: "Raw HTML for embeds and custom markup (trusted content only)",
  icon: "</>",
  schema,
  rawHtmlFields: ["html"],
  defaults: { html: "" },
  fields: [{ kind: "textarea", name: "html", label: "HTML", rows: 8 }],
  Render: (p) =>
    p.html ? (
      <div className="cms-container cms-block" dangerouslySetInnerHTML={{ __html: p.html }} />
    ) : (
      <div className="cms-container cms-block">
        <div className="cms-image-placeholder">Paste HTML in the settings panel</div>
      </div>
    ),
});
