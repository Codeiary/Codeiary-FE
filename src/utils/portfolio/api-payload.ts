import { waitForPortfolioFonts } from "./fonts";
import { encodeHtmlEntities, type JSONContent } from "@tiptap/core";
import { blocksToMarkdown, type PortfolioBlock, type PortfolioTextRun } from "./layout";
import { contentFromEditorDocument, normalizeTextRuns } from "./rich-text";

export interface PortfolioFont { id: number; code: string }
export interface BlockLayout { x: number; y: number; widthPx: number; heightPx: number }
export interface TextStyleInput {
  startOffset: number; endOffset: number; fontId?: number; fontSize?: number; textColor?: string;
}
export interface PortfolioInput {
  title: string;
  titleAlign: string;
  titleStyles: TextStyleInput[];
  defaultFontId: number;
  representativeImageUrl?: string;
  publicPortfolio: boolean;
  blocks: ({ type: "TEXT" | "IMAGE"; content?: string; textAlign?: string;
    imageUrl?: string; imageAlt?: string; styles?: TextStyleInput[] } & BlockLayout)[];
}
export interface PortfolioDraft {
  defaultFont?: string;
  title: string; titleRuns: PortfolioTextRun[]; titleAlign: string;
  coverImage?: string; visibility: string; blocks: PortfolioBlock[];
}

function fontId(code: string, fonts: PortfolioFont[]): number {
  const font = fonts.find((font) => font.code === code);
  if (!font) throw new Error("선택한 글꼴을 사용할 수 없어요. 다른 글꼴을 선택해 주세요.");
  return font.id;
}

function styled(run: PortfolioTextRun) {
  return run.font !== undefined || run.size !== undefined || run.color !== undefined;
}

/** Offsets refer to the serialized Markdown, in UTF-16 units like Java String/JS string. */
function textStyles(source: string, nodes: { run: PortfolioTextRun; encoded: string }[], fonts: PortfolioFont[]) {
  if (!nodes.some(({ run }) => styled(run))) return [];
  let cursor = 0;
  const result: TextStyleInput[] = [];
  for (const { run, encoded: original } of nodes) {
    let encoded = original;
    if (!encoded) continue;
    let start = source.indexOf(encoded, cursor);
    if (/^[\t ]+$/.test(encoded)) {
      const spaces = encoded.replace(/ /g, "&#32;").replace(/\t/g, "&#9;");
      const spaceStart = source.indexOf(spaces, cursor);
      if (spaceStart >= 0 && (start < 0 || spaceStart < start)) { start = spaceStart; encoded = spaces; }
    }
    if (start < 0) throw new Error("글자 서식 위치를 저장할 수 없어요. 해당 본문을 다시 확인해 주세요.");
    cursor = start + encoded.length;
    if (!styled(run)) continue;
    const style = { startOffset: start, endOffset: cursor,
      ...(run.font ? { fontId: fontId(run.font, fonts) } : {}),
      ...(run.size !== undefined ? { fontSize: run.size } : {}),
      ...(run.color ? { textColor: run.color } : {}),
    };
    const previous = result[result.length - 1];
    if (previous && previous.endOffset === start && previous.fontId === style.fontId
      && previous.fontSize === style.fontSize && previous.textColor === style.textColor) previous.endOffset = cursor;
    else result.push(style);
  }
  return result;
}

function documentNodes(document: JSONContent) {
  const nodes: { run: PortfolioTextRun; encoded: string }[] = [];
  function visit(node: JSONContent, code = false, table = false) {
    code ||= node.type === "codeBlock" || !!node.marks?.some((mark) => mark.type === "code");
    table ||= node.type === "table";
    if (node.type === "text" && node.text) {
      const run = contentFromEditorDocument({ type: "doc", content: [{ type: "paragraph", content: [node] }] }).runs[0]!;
      for (const text of node.text.split(/(\s+)/).filter(Boolean)) {
        let encoded = code ? text : encodeHtmlEntities(text).replace(/([\\`*_[\]~])/g, "\\$1");
        if (table && !code) encoded = encoded.replace(/\|/g, "\\|");
        nodes.push({ run: { ...run, text }, encoded });
      }
    }
    node.content?.forEach((child) => visit(child, code, table));
  }
  visit(document);
  return nodes;
}

function plainStyles(content: string, runs: PortfolioTextRun[], source: string, fonts: PortfolioFont[]) {
  const nodes = normalizeTextRuns(runs, content).flatMap((run) => run.text.split(/(\s+)/).filter(Boolean).map((text) => {
    const encoded = text.replace(/[!-/:-@[-`{-~]/g, "\\$&");
    return { run: { ...run, text }, encoded };
  }));
  return textStyles(source, nodes, fonts);
}

export function portfolioPayload(draft: PortfolioDraft, fonts: PortfolioFont[], layouts: Map<string, BlockLayout>): PortfolioInput {
  const title = blocksToMarkdown([{ id: "title", type: "text", content: draft.title, runs: draft.titleRuns, align: "left" }]);
  if (title.length > 200) throw new Error("제목을 서식 포함 200자 이내로 줄여 주세요.");
  return {
    title, titleAlign: draft.titleAlign.toUpperCase(),
    titleStyles: plainStyles(draft.title, draft.titleRuns, title, fonts),
    defaultFontId: fontId(draft.defaultFont ?? "sans", fonts), representativeImageUrl: draft.coverImage,
    publicPortfolio: draft.visibility === "PUBLIC",
    blocks: draft.blocks.map((block) => {
      const layout = layouts.get(block.id);
      if (!layout) throw new Error("본문 크기를 확인하지 못했어요. 잠시 후 다시 저장해 주세요.");
      if (block.type === "image") return { type: "IMAGE", imageUrl: block.imageUrl, imageAlt: block.alt, ...layout };
      const content = blocksToMarkdown([block]);
      const styles = block.document ? textStyles(content, documentNodes(block.document), fonts)
        : block.type === "text" ? plainStyles(block.content, block.runs ?? [], content, fonts) : [];
      return { type: "TEXT", content, textAlign: block.align.toUpperCase(), styles, ...layout };
    }),
  };
}

export async function measurePortfolioBlocks(canvas: HTMLElement, blocks: PortfolioBlock[]): Promise<Map<string, BlockLayout>> {
  await waitForPortfolioFonts(canvas);
  await Promise.all(Array.from(canvas.querySelectorAll("img"), (image) => image.decode?.().catch(() => undefined)));
  const stage = canvas.querySelector<HTMLElement>(".portfolio-document-blocks");
  const bounds = stage?.getBoundingClientRect();
  if (!bounds?.width) throw new Error("본문 크기를 확인하지 못했어요. 미리보기를 닫고 다시 저장해 주세요.");
  const layouts = new Map<string, BlockLayout>();
  for (const element of canvas.querySelectorAll<HTMLElement>(".portfolio-document-block[data-block-id]")) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) layouts.set(element.dataset.blockId!, {
      x: Math.max(0, rect.left - bounds.left), y: Math.max(0, rect.top - bounds.top),
      widthPx: rect.width, heightPx: rect.height,
    });
  }
  if (blocks.some((block) => !layouts.has(block.id))) throw new Error("본문 크기를 확인하지 못했어요. 잠시 후 다시 저장해 주세요.");
  return layouts;
}
