import type { JSONContent } from "@tiptap/core";
import { blocksToMarkdown, safePortfolioLinkUrl, safePortfolioImage, type PortfolioBlock } from "./layout";
import { contentFromEditorDocument, runsToEditorDocument } from "./rich-text";

/** Keep only the editor's supported nodes, marks and safe attributes. */
export function normalizePortfolioDocument(value: JSONContent): JSONContent {
  const nodes = new Set(["doc", "paragraph", "text", "heading", "hardBreak", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "horizontalRule", "image", "table", "tableRow", "tableCell", "tableHeader"]);
  function clean(node: JSONContent, depth = 0): JSONContent[] {
    if (depth > 64 || !nodes.has(node.type ?? "")) return [];
    const attrs: Record<string, unknown> = {};
    if (node.type === "heading") attrs.level = [1, 2, 3].includes(node.attrs?.level) ? node.attrs?.level : 2;
    if (node.type === "orderedList") attrs.start = Math.max(1, Math.min(10000, Number(node.attrs?.start) || 1));
    if (node.type === "codeBlock" && typeof node.attrs?.language === "string") attrs.language = node.attrs.language.slice(0, 40);
    if (node.type === "image") {
      const src = safePortfolioImage(node.attrs?.src);
      if (!src) return [];
      Object.assign(attrs, { src, alt: String(node.attrs?.alt ?? "").slice(0, 1000) });
      for (const key of ["width", "height"])
        if (Number.isFinite(Number(node.attrs?.[key])) && Number(node.attrs?.[key]) > 0) attrs[key] = Math.max(50, Math.min(2400, Number(node.attrs?.[key])));
    }
    if (node.type === "tableCell" || node.type === "tableHeader") {
      for (const key of ["colspan", "rowspan"]) attrs[key] = Math.max(1, Math.min(100, Number(node.attrs?.[key]) || 1));
    }
    let marks: JSONContent["marks"] = [];
    if (node.type === "text" && typeof node.text === "string") {
      const normalized = contentFromEditorDocument({ type: "doc", content: [{ type: "paragraph", content: [node] }] });
      marks = runsToEditorDocument(normalized.content, normalized.runs).content[0]?.content[0]?.marks ?? [];
      for (const mark of node.marks ?? []) {
        if (["code", "strike"].includes(mark.type)) marks.push({ type: mark.type });
        if (mark.type === "link") {
          const href = safePortfolioLinkUrl(mark.attrs?.href);
          if (href) marks.push({ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } });
        }
      }
    }
    return [{ type: node.type, ...(node.type === "text" ? { text: node.text ?? "", marks } : {}),
      ...(Object.keys(attrs).length ? { attrs } : {}),
      ...(node.content ? { content: node.content.flatMap((child) => clean(child, depth + 1)) } : {}),
    }];
  }
  return clean(value)[0] ?? { type: "doc", content: [{ type: "paragraph" }] };
}

export function documentFromPortfolioBlocks(blocks: PortfolioBlock[], parse: (source: string) => JSONContent): JSONContent {
  return normalizePortfolioDocument({ type: "doc", content: blocks.flatMap<JSONContent>((block) => {
    if (block.document) return block.document.content ?? [];
    if (block.type === "text") return runsToEditorDocument(block.content, block.runs).content;
    return parse(blocksToMarkdown([block])).content ?? [];
  }) });
}

export function portablePortfolioDocument(doc: JSONContent): JSONContent {
  return { ...doc, ...(doc.marks ? { marks: doc.marks.filter((mark) => mark.type !== "textStyle") } : {}),
    ...(doc.content ? { content: doc.content.map(portablePortfolioDocument) } : {}) };
}
