import { htmlToMarkdown } from "@/lib/block-text";
import { safeHref } from "@/lib/content";

export { htmlToMarkdown };

/**
 * Minimal Markdown -> HTML for post bodies written over the MCP connector.
 * posts.body is stored as HTML, but AI clients are far more reliable writing
 * Markdown, so the connector reads bodies back as Markdown (htmlToMarkdown) and
 * accepts Markdown on write, converting it here. Covers the formatting an AI
 * uses in an article: headings, lists, blockquotes, code, images, links,
 * bold/italic/code/strike, horizontal rules and paragraphs.
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

const INLINE_RE =
  /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)|(~~([^~]+)~~)|(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)\))/;

function inlineToHtml(text: string): string {
  let rest = text;
  let out = "";
  while (rest.length > 0) {
    const m = rest.match(INLINE_RE);
    if (!m || m.index === undefined) {
      out += escapeHtml(rest);
      break;
    }
    if (m.index > 0) out += escapeHtml(rest.slice(0, m.index));
    if (m[1]) out += `<strong>${inlineToHtml(m[2])}</strong>`;
    else if (m[3]) out += `<strong>${inlineToHtml(m[4])}</strong>`;
    else if (m[5]) out += `<em>${inlineToHtml(m[6])}</em>`;
    else if (m[7]) out += `<em>${inlineToHtml(m[8])}</em>`;
    else if (m[9]) out += `<code>${escapeHtml(m[10])}</code>`;
    else if (m[11]) out += `<s>${inlineToHtml(m[12])}</s>`;
    else if (m[13]) out += `<img src="${escapeAttr(safeHref(m[15]))}" alt="${escapeAttr(m[14])}" />`;
    else if (m[16]) out += `<a href="${escapeAttr(safeHref(m[18]))}">${inlineToHtml(m[17])}</a>`;
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function markdownToHtml(markdown: string): string {
  const lines = (markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const headingRe = /^(#{1,6})\s+(.*)$/;
  const bulletRe = /^\s*[-*+]\s+(.*)$/;
  const orderedRe = /^\s*\d+[.)]\s+(.*)$/;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(headingRe);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inlineToHtml(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s*_-]*$/.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    if (bulletRe.test(line)) {
      const items: string[] = [];
      while (i < lines.length && bulletRe.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].match(bulletRe)![1])}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (orderedRe.test(line)) {
      const items: string[] = [];
      while (i < lines.length && orderedRe.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].match(orderedRe)![1])}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (line.trimStart().startsWith(">")) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        inner.push(inlineToHtml(lines[i].replace(/^\s*>\s?/, "")));
        i++;
      }
      out.push(`<blockquote><p>${inner.join("<br />")}</p></blockquote>`);
      continue;
    }

    // A standalone image line becomes a bare <img>, not wrapped in a paragraph.
    const imgOnly = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imgOnly) {
      out.push(`<img src="${escapeAttr(safeHref(imgOnly[2]))}" alt="${escapeAttr(imgOnly[1])}" />`);
      i++;
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !headingRe.test(lines[i]) &&
      !bulletRe.test(lines[i]) &&
      !orderedRe.test(lines[i]) &&
      !lines[i].trimStart().startsWith(">") &&
      !lines[i].trim().startsWith("```")
    ) {
      para.push(inlineToHtml(lines[i].trim()));
      i++;
    }
    out.push(`<p>${para.join("<br />")}</p>`);
  }

  return out.join("\n");
}
