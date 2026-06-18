import { z } from "zod";
import { defineBlock } from "@/blocks/types";

const schema = z.object({
  // HTML produced by the Tiptap editor in the settings panel.
  html: z.string(),
  width: z.enum(["normal", "narrow"]),
});

type Props = z.infer<typeof schema>;

export default defineBlock<Props>({
  type: "richtext",
  label: "Rich text",
  description: "Free-form text with headings, lists, links and images",
  icon: "¶",
  schema,
  rawHtmlFields: ["html"],
  defaults: {
    html: "<p>Write something here. Use the editor in the settings panel to format text, add links and lists.</p>",
    width: "normal",
  },
  fields: [
    { kind: "richtext", name: "html", label: "Content" },
    {
      kind: "select",
      name: "width",
      label: "Width",
      options: [
        { value: "normal", label: "Normal" },
        { value: "narrow", label: "Narrow (reading width)" },
      ],
    },
  ],
  Render: (p) => (
    <div className={`cms-container cms-block ${p.width === "narrow" ? "cms-narrow" : ""}`}>
      <div className="cms-prose" dangerouslySetInnerHTML={{ __html: p.html }} />
    </div>
  ),
});
