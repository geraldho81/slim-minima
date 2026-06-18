import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes author-supplied HTML before it is rendered on the public site.
 * Stored post bodies, richtext blocks, and html-embed blocks are written by
 * editors and over the API/MCP connector, so the markup is untrusted: an editor
 * (or anyone holding an API key) must not be able to run script in a visitor's
 * or admin's browser. This strips <script>, on* handlers, and javascript:/data:
 * URLs while keeping normal rich text and iframe embeds (https only) working.
 *
 * Note: script-based third-party embeds (e.g. Twitter's widgets.js) will not
 * survive this on purpose. Use an iframe-based embed instead.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "span", "div",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "mark", "sub", "sup", "small",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    "iframe",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "loading", "referrerpolicy"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    col: ["span"],
    "*": ["class", "style"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  // New-tab links always get noopener/noreferrer.
  transformTags: {
    a: (tagName, attribs) => {
      if (attribs.target === "_blank") {
        attribs.rel = Array.from(new Set(`${attribs.rel ?? ""} noopener noreferrer`.trim().split(/\s+/))).join(" ");
      }
      return { tagName, attribs };
    },
  },
};

export function sanitizeContentHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
