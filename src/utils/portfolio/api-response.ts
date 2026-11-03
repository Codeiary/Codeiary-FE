import { encodeHtmlEntities, type JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { normalizePortfolioDocument } from "./document";
import { contentFromEditorDocument } from "./rich-text";
import { portfolioFontFamily } from "./fonts";
import type { PortfolioItem } from "@/store/portfolio";

export interface ApiStyle { startOffset: number; endOffset: number; fontCode?: string | null; fontSize?: number | null; textColor?: string | null }
export interface ApiPortfolioItem {
  id: number; title: string; author: { id: number; nickname: string | null };
  publicPortfolio: boolean; representativeImageUrl?: string | null; createdAt: string;
}
export interface ApiPortfolio extends ApiPortfolioItem {
  titleAlign: string; defaultFontCode: string; titleStyles: ApiStyle[];
  blocks: { id: number; type: "TEXT" | "IMAGE"; sortOrder: number; x: number; y: number; widthPx: number; heightPx: number;
    content?: string; textAlign?: string; imageUrl?: string; imageAlt?: string; styles: ApiStyle[] }[];
}
const parser = new MarkdownManager({ extensions: [StarterKit, Image, TableKit] });

/** Restore source-based style ranges after parsing Markdown, including escaped characters/entities. */
export function styledDocument(source: string, styles: ApiStyle[]): JSONContent {
  if (!styles.length) return normalizePortfolioDocument(parser.parse(source));
  let cursor = 0;
  function visit(node: JSONContent, code = false): JSONContent[] {
    if (node.type === "codeBlock") {
      const fence = /(?:^|\n)\s*(```+|~~~+)[^\n]*\n/g;
      fence.lastIndex = cursor;
      const match = fence.exec(source);
      if (match) cursor = match.index + match[0].length;
      code = true;
    }
    if (node.type !== "text" || !node.text) return [{ ...node,
      ...(node.content ? { content: node.content.flatMap((child) => visit(child, code || !!child.marks?.some((m) => m.type === "code"))) } : {}) }];
    const parts: JSONContent[] = [];
    for (const chunk of node.text.split(/(\s+)/).filter(Boolean)) {
      const encoders = code ? [(s: string) => s] : [
        (s: string) => s.replace(/[!-/:-@[-`{-~]/g, "\\$&"),
        (s: string) => encodeHtmlEntities(s).replace(/([\\`*_[\]~])/g, "\\$1"),
        (s: string) => s.replace(/ /g, "&#32;").replace(/\t/g, "&#9;"),
        (s: string) => s,
      ];
      const candidates = encoders.map((encode) => ({ encode, start: source.indexOf(encode(chunk), cursor) })).filter((x) => x.start >= 0).sort((a, b) => a.start - b.start);
      const found = candidates[0];
      if (!found) { parts.push({ ...node, text: chunk }); continue; }
      let offset = found.start;
      for (const character of chunk) {
        const end = offset + found.encode(character).length;
        const attrs: Record<string, string> = {};
        for (const style of styles) if (style.startOffset < end && style.endOffset > offset) {
          if (style.fontCode) attrs.fontFamily = portfolioFontFamily(style.fontCode);
          if (style.fontSize != null) attrs.fontSize = `${style.fontSize}px`;
          if (style.textColor) attrs.color = style.textColor;
        }
        const marks = [...(node.marks ?? []), ...(Object.keys(attrs).length ? [{ type: "textStyle", attrs }] : [])];
        const previous = parts[parts.length - 1];
        if (previous && JSON.stringify(previous.marks) === JSON.stringify(marks)) previous.text += character;
        else parts.push({ type: "text", text: character, marks });
        offset = end;
      }
      cursor = offset;
    }
    return parts;
  }
  return normalizePortfolioDocument(visit(parser.parse(source))[0]!);
}
function alignment(value?: string): "left" | "center" | "right" {
  return value === "CENTER" ? "center" : value === "RIGHT" ? "right" : "left";
}
export function mapPortfolioItem(item: ApiPortfolioItem): PortfolioItem {
  return { id: item.id, title: contentFromEditorDocument(styledDocument(item.title, [])).content,
    author: { id: item.author.id, name: item.author.nickname || "사용자" }, summary: "", content: "",
    coverImage: item.representativeImageUrl ?? undefined, visibility: item.publicPortfolio ? "PUBLIC" : "PRIVATE" };
}
export function mapPortfolio(item: ApiPortfolio): PortfolioItem {
  const title = contentFromEditorDocument(styledDocument(item.title, item.titleStyles));
  // A4 CSS pixels minus the document's 36px padding on each side.
  const contentWidth = 210 * 96 / 25.4 - 72;
  return { ...mapPortfolioItem(item), title: title.content, titleRuns: title.runs, titleAlign: alignment(item.titleAlign),
    defaultFont: item.defaultFontCode,
    content: item.blocks.filter((block) => block.type === "TEXT").map((block) => block.content ?? "").join("\n\n"),
    blocks: [...item.blocks].sort((a, b) => a.sortOrder - b.sortOrder).map((block) => ({
      id: String(block.id), type: block.type === "IMAGE" ? "image" : "markdown", content: block.content ?? "",
      align: alignment(block.textAlign),
      position: { x: block.x / contentWidth * 100, y: block.y, width: block.widthPx / contentWidth * 100, height: block.heightPx },
      ...(block.type === "IMAGE" ? { imageUrl: block.imageUrl, alt: block.imageAlt ?? "" }
        : { document: styledDocument(block.content ?? "", block.styles) }),
    })) };
}
