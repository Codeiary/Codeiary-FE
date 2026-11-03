import type { JSONContent } from "@tiptap/core";
import { normalizeTextRuns, type PortfolioTextRun } from "@/utils/portfolio/rich-text";
export type { PortfolioTextRun } from "@/utils/portfolio/rich-text";
export const PORTFOLIO_TITLE_ID = "portfolio-title";
export type PortfolioBlockType = "text" | "image" | "markdown";

export interface PortfolioBlockPosition {
  x: number;
  y: number;
  width: number;
  height?: number;
}

export interface PortfolioBlock {
  id: string;
  type: PortfolioBlockType;
  content: string;
  runs?: PortfolioTextRun[];
  document?: JSONContent;
  imageUrl?: string;
  alt?: string;
  align: "left" | "center" | "right";
  position?: PortfolioBlockPosition;
}

export function normalizeBlockPosition(value: unknown, minimumWidth = 10): PortfolioBlockPosition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const position = value as Record<string, unknown>;
  if (typeof position.x !== "number" || !Number.isFinite(position.x)
    || typeof position.y !== "number" || !Number.isFinite(position.y)
    || typeof position.width !== "number" || !Number.isFinite(position.width)) return undefined;
  const width = Math.min(100, Math.max(minimumWidth, position.width));
  return {
    x: Math.min(100 - width, Math.max(0, position.x)),
    y: Math.min(20000, Math.max(0, position.y)),
    width,
    ...(typeof position.height === "number" && Number.isFinite(position.height)
      ? { height: Math.min(20000, Math.max(32, position.height)) } : {}),
  };
}

let nextBlockId = 0;
function blockId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `portfolio-block-${Date.now().toString(36)}-${(++nextBlockId).toString(36)}`;
}

export function safePortfolioLinkUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || /[\\\u0000-\u001f\u007f]/.test(value)) return undefined;
  const source = value.trim();
  if (!source || /%(?:0[\da-f]|1[\da-f]|7f)/i.test(source)) return undefined;
  try {
    const url = new URL(source);
    if (url.username || url.password) return undefined;
    if (/^https?:\/\//i.test(source) && url.hostname
      && (url.protocol === "https:" || url.protocol === "http:")) return source;
    if (url.protocol === "mailto:" && url.pathname && !url.host
      && !/[\s:/]/.test(url.pathname)) return source;
  } catch { /* An invalid address remains editable without becoming a link. */ }
  return undefined;
}

export function safePortfolioImage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const source = value.trim();
  // Backslashes and control characters can change how a URL is interpreted.
  if (!source || /[\\\u0000-\u001f\u007f]/.test(source)) return undefined;
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  try {
    const url = new URL(source);
    if ((url.protocol === "https:" || url.protocol === "http:")
      && url.hostname && !url.username && !url.password) return source;
  } catch { /* Invalid URLs leave an empty image block available for correction. */ }
  return undefined;
}

export function createPortfolioBlock(type: PortfolioBlockType, overrides: Partial<PortfolioBlock> = {}): PortfolioBlock {
  const content = overrides.content ?? "";
  const position = normalizeBlockPosition(overrides.position, type === "image" ? .1 : 10);
  return {
    id: overrides.id || blockId(), type, content,
    align: overrides.align === "center" || overrides.align === "right" ? overrides.align : "left",
    ...(overrides.runs ? { runs: normalizeTextRuns(overrides.runs, content) } : {}),
    ...(position ? { position } : {}),
    ...(type === "image" ? { imageUrl: safePortfolioImage(overrides.imageUrl), alt: overrides.alt ?? "" } : {}),
  };
}

function escapePlainText(value: string): string {
  // Escape punctuation before Markdown parses blocks, links, HTML, or inline
  // styles. Escaped punctuation also prevents automatic linkification.
  return value.replace(/\r\n?/g, "\n")
    .replace(/[!-/:-@[-`{-~]/g, "\\$&")
    .replace(/^[\t ]+/gm, (spaces) => Array.from(spaces, (space) =>
      space === "\t" ? "&#9;" : "&#32;").join(""));
}

function inlineText(value: string): string {
  return escapePlainText(value.replace(/[\r\n]+/g, " "));
}

function markdownDestination(source: string): string {
  return source.replace(/[\s()<>]/g, (character) =>
    character === "(" ? "%28" : character === ")" ? "%29" : encodeURIComponent(character));
}

function styledTextMarkdown(block: PortfolioBlock): string {
  // Fonts, sizes and colors remain in runs; Markdown keeps semantic emphasis.
  const runs: PortfolioTextRun[] = [];
  for (const run of normalizeTextRuns(block.runs, block.content)) {
    const previous = runs[runs.length - 1];
    if (previous && !!previous.bold === !!run.bold && !!previous.italic === !!run.italic)
      previous.text += run.text;
    else runs.push({ text: run.text, bold: run.bold, italic: run.italic });
  }
  if (!runs.some((run) => run.bold || run.italic)) return escapePlainText(block.content);
  return runs.map((run) => run.text.split(/(\r?\n+)/).map((line) => {
    if (!line || /^[\r\n]+$/.test(line)) return line;
    const [, before = "", text = "", after = ""] = line.match(/^(\s*)(.*?)(\s*)$/)!;
    const marker = `${run.bold ? "**" : ""}${run.italic ? "*" : ""}`;
    return escapePlainText(before) + (text ? marker + escapePlainText(text) + marker : "") + escapePlainText(after);
  }).join("")).join("");
}

function serializeBlock(block: PortfolioBlock): string {
  if (block.type === "markdown") return block.content;
  if (block.type === "text") return styledTextMarkdown(block);
  const source = safePortfolioImage(block.imageUrl);
  return source ? `![${inlineText(block.alt ?? "")}](${markdownDestination(source)})` : "";
}

export function blocksToMarkdown(blocks: readonly PortfolioBlock[]): string {
  return blocks.map(serializeBlock).filter((content) => content !== "").join("\n\n");
}

export function blocksFromMarkdown(content: string): PortfolioBlock[] {
  return content ? [createPortfolioBlock("markdown", { content })] : [];
}
