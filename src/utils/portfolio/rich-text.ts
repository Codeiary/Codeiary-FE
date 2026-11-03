import { portfolioFontFamily, portfolioFonts, type PortfolioFontId } from "@/utils/portfolio/fonts";

export interface PortfolioTextRun {
  text: string;
  font?: PortfolioFontId;
  color?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
}

export interface PortfolioEditorMark {
  type: "bold" | "italic" | "textStyle";
  attrs?: { fontFamily?: string; color?: string; fontSize?: string };
}

export interface PortfolioEditorInline {
  type: "text" | "hardBreak";
  text?: string;
  marks?: PortfolioEditorMark[];
}

export interface PortfolioEditorDocument {
  type: "doc";
  content: { type: "paragraph"; content: PortfolioEditorInline[] }[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function safeStyle(value: unknown): Omit<PortfolioTextRun, "text"> {
  const source = record(value) ?? {};
  const font = portfolioFonts.find((candidate) => candidate.id === source.font);
  return {
    ...(font ? { font: font.id } : {}),
    ...(typeof source.color === "string" && source.color.length === 7 && /^#[\da-f]{6}$/i.test(source.color)
      ? { color: source.color.toLowerCase() } : {}),
    ...(typeof source.size === "number" && Number.isFinite(source.size) && source.size >= 10 && source.size <= 96
      ? { size: source.size } : {}),
    ...(source.bold === true ? { bold: true } : {}),
    ...(source.italic === true ? { italic: true } : {}),
  };
}

function sameStyle(left: PortfolioTextRun, right: PortfolioTextRun): boolean {
  return left.font === right.font && left.color === right.color && left.size === right.size
    && left.bold === right.bold && left.italic === right.italic;
}

/** Plain content is authoritative: stale formatting must never restore deleted text. */
export function normalizeTextRuns(runs: unknown, content: string): PortfolioTextRun[] {
  if (!Array.isArray(runs) || !runs.every((run) => typeof record(run)?.text === "string")
    || runs.map((run) => (run as PortfolioTextRun).text).join("") !== content)
    return [{ text: content }];
  const normalized: PortfolioTextRun[] = [];
  for (const value of runs) {
    const text = (value as PortfolioTextRun).text;
    if (!text) continue;
    const run = { text, ...safeStyle(value) };
    const previous = normalized[normalized.length - 1];
    if (previous && sameStyle(previous, run)) previous.text += text;
    else normalized.push(run);
  }
  return normalized.length ? normalized : [{ text: content }];
}

export function textRunStyle(run: unknown): Record<string, string> {
  const style = safeStyle(run);
  return {
    ...(style.font ? { fontFamily: portfolioFontFamily(style.font) } : {}),
    ...(style.color ? { color: style.color } : {}),
    ...(style.size !== undefined ? { fontSize: `${style.size}px` } : {}),
    ...(style.bold ? { fontWeight: "700" } : {}),
    ...(style.italic ? { fontStyle: "italic" } : {}),
  };
}

function marksForRun(run: PortfolioTextRun): PortfolioEditorMark[] {
  const marks: PortfolioEditorMark[] = [];
  if (run.bold) marks.push({ type: "bold" });
  if (run.italic) marks.push({ type: "italic" });
  const attrs: NonNullable<PortfolioEditorMark["attrs"]> = {
    ...(run.font ? { fontFamily: portfolioFontFamily(run.font) } : {}),
    ...(run.color ? { color: run.color } : {}),
    ...(run.size !== undefined ? { fontSize: `${run.size}px` } : {}),
  };
  if (Object.keys(attrs).length) marks.push({ type: "textStyle", attrs });
  return marks;
}

/** Double newlines separate paragraphs; single newlines remain hard breaks. */
export function runsToEditorDocument(content: string, runs?: unknown): PortfolioEditorDocument {
  let runOffset = 0;
  const positioned = normalizeTextRuns(runs, content).map((run) => {
    const start = runOffset;
    runOffset += run.text.length;
    return { run, start, end: runOffset };
  });
  let paragraphOffset = 0;
  const paragraphs = content.split("\n\n").map((paragraph) => {
    const start = paragraphOffset;
    const end = start + paragraph.length;
    paragraphOffset = end + 2;
    const nodes: PortfolioEditorInline[] = [];
    for (const item of positioned) {
      if (item.end <= start || item.start >= end) continue;
      const text = item.run.text.slice(Math.max(0, start - item.start), Math.min(item.run.text.length, end - item.start));
      text.split("\n").forEach((line, index) => {
        if (index > 0) nodes.push({ type: "hardBreak", marks: marksForRun(item.run) });
        if (line) nodes.push({ type: "text", text: line, marks: marksForRun(item.run) });
      });
    }
    return { type: "paragraph" as const, content: nodes };
  });
  return { type: "doc", content: paragraphs };
}

function styleFromMarks(marks: unknown): Omit<PortfolioTextRun, "text"> {
  const style: Record<string, unknown> = {};
  if (!Array.isArray(marks)) return {};
  for (const value of marks) {
    const mark = record(value);
    if (mark?.type === "bold") style.bold = true;
    else if (mark?.type === "italic") style.italic = true;
    else if (mark?.type === "textStyle") {
      const attrs = record(mark.attrs);
      if (!attrs) continue;
      const font = portfolioFonts.find((candidate) => candidate.family === attrs.fontFamily);
      if (font) style.font = font.id;
      if (attrs.color !== undefined) style.color = attrs.color;
      const size = attrs.fontSize ?? attrs.size;
      if (typeof size === "string" && /^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(size))
        style.size = Number(size.slice(0, -2));
    }
  }
  return safeStyle(style);
}

/** Read text only; arbitrary HTML, attributes, node names and marks are never emitted. */
export function contentFromEditorDocument(document: unknown): { content: string; runs: PortfolioTextRun[] } {
  const root = record(document);
  if (root?.type !== "doc" || !Array.isArray(root.content)) return { content: "", runs: [{ text: "" }] };
  const ancestors = new WeakSet<object>();
  function readNode(value: unknown, depth: number): PortfolioTextRun[] {
    const node = record(value);
    if (!node || depth > 64 || ancestors.has(node)) return [];
    if (node.type === "text") return typeof node.text === "string"
      ? [{ text: node.text, ...styleFromMarks(node.marks) }] : [];
    if (node.type === "hardBreak") return [{ text: "\n", ...styleFromMarks(node.marks) }];
    if (!Array.isArray(node.content)) return [];
    ancestors.add(node);
    const runs = node.content.flatMap((child) => readNode(child, depth + 1));
    ancestors.delete(node);
    return runs;
  }
  const paragraphs = root.content.flatMap((node) => {
    const runs = readNode(node, 0);
    return runs.length || record(node)?.type === "paragraph" ? [runs] : [];
  });
  const runs = paragraphs.flatMap((paragraph, index) => index ? [{ text: "\n\n" }, ...paragraph] : paragraph);
  const content = runs.map((run) => run.text).join("");
  return { content, runs: normalizeTextRuns(runs, content) };
}
