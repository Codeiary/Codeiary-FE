import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";
import DOMPurify from "dompurify";
import {
  normalizeImageLayout,
  type ImageLayouts,
  type ImageSizes,
} from "./image-layout";
import { highlightCode } from "./code-highlight";
import type { ArticleHeading } from "./heading-outline";

interface RenderOptions {
  imageLayouts?: ImageLayouts;
  editableImages?: boolean;
  selectedImage?: string;
  deferAttachments?: boolean;
  imageSizes?: ImageSizes;
}
interface RenderEnvironment extends RenderOptions {
  images: Record<string, string>;
  imageCounts: Map<string, number>;
  headingIndex: number;
}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight: highlightCode,
}).use(texmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: { trust: false, throwOnError: false, maxExpand: 1000 },
});
// Only images on the same Markdown line form a row. Explicit line breaks,
// paragraphs and surrounding text keep their normal Markdown behavior.
markdown.core.ruler.after("inline", "image_rows", (state) => {
  for (const block of state.tokens) {
    const children = block.children;
    if (block.type !== "inline" || !children) continue;
    for (let start = 0; start < children.length; start++) {
      if (children[start]?.type !== "image") continue;
      const indexes = [start];
      let end = start;
      while (end + 1 < children.length) {
        let next = end + 1;
        const separator = children[next];
        if (separator?.type === "text" && /^[\t ]*$/.test(separator.content))
          next++;
        if (children[next]?.type !== "image") break;
        indexes.push(next);
        end = next;
      }
      if (indexes.length > 1) {
        indexes.forEach((index, position) => {
          children[index]!.meta = {
            ...children[index]!.meta,
            imageRow: {
              count: indexes.length,
              first: position === 0,
              last: position === indexes.length - 1,
            },
          };
        });
      }
      start = end;
    }
  }
});
const renderImage = markdown.renderer.rules.image!;
markdown.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  const context = env as unknown as RenderEnvironment;
  tokens[index]!.attrSet("id", `post-heading-${context.headingIndex++}`);
  return self.renderToken(tokens, index, options);
};
export function markdownHeadings(content: string): ArticleHeading[] {
  const tokens = markdown.parse(content, {});
  const headings: ArticleHeading[] = [];
  let index = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.type !== "heading_open") continue;
    const id = `post-heading-${index++}`;
    const text = (tokens[i + 1]?.children ?? [])
      .filter((token) =>
        ["text", "code_inline", "image", "softbreak"].includes(token.type),
      )
      .map((token) => (token.type === "softbreak" ? " " : token.content))
      .join("")
      .trim();
    if (text)
      headings.push({ id, text, level: Number(tokens[i]!.tag.slice(1)) });
  }
  return headings;
}
markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index]!;
  const src = String(token.attrGet("src") ?? "");
  const context = env as unknown as RenderEnvironment;
  const occurrence = context.imageCounts.get(src) ?? 0;
  context.imageCounts.set(src, occurrence + 1);
  // Each occurrence has its own layout, including repeated uses of one image.
  const key = JSON.stringify([src, occurrence]);
  const row = token.meta?.imageRow as
    | { count: number; first: boolean; last: boolean }
    | undefined;
  const layout = normalizeImageLayout(context.imageLayouts?.[key]);
  // Unconfigured images share the row evenly; explicit widths can change the
  // proportions. Flex shrinking keeps oversized combinations inside the row.
  const width =
    row && !context.imageLayouts?.[key] ? 100 / row.count : layout.width;
  token.attrSet(
    "style",
    row
      ? `width: calc((100% - var(--image-row-gaps)) * ${width / 100}); margin: 0;`
      : `width: ${layout.original ? "auto" : `${width}%`}; margin-left: ${layout.align === "left" ? "0" : "auto"}; margin-right: ${layout.align === "right" ? "0" : "auto"};`,
  );
  token.attrSet("data-image-align", layout.align);
  token.attrSet("data-image-width", String(width));
  token.attrSet("data-image-original", String(!row && layout.original));
  if (row) token.attrSet("data-image-row-size", String(row.count));
  if (context.editableImages) {
    token.attrSet("data-image-key", key);
    token.attrSet("role", "button");
    token.attrSet("tabindex", "0");
    token.attrSet(
      "aria-label",
      `${token.content || "첨부 이미지"} 크기와 정렬 편집`,
    );
    token.attrSet("aria-pressed", String(key === context.selectedImage));
    token.attrSet("class", "markdown-editable-image");
  }
  let missing = false;
  if (src.startsWith("attachment:")) {
    const resolved = context.images[src];
    if (resolved) token.attrSet("src", resolved);
    else if (context.deferAttachments) {
      token.attrSet("data-attachment-src", src);
      token.attrJoin("class", "markdown-attachment-pending");
      token.attrSet(
        "src",
        "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
      );
      const size = context.imageSizes?.[src] ?? { width: 640, height: 360 };
      token.attrSet("width", String(size.width));
      token.attrSet("height", String(size.height));
      token.attrJoin(
        "style",
        `--image-placeholder-width: ${size.width}px; --image-placeholder-ratio: ${size.width} / ${size.height};`,
      );
    } else missing = true;
  }
  token.attrSet("loading", "lazy");
  token.attrSet("decoding", "async");
  const rendered = missing
    ? '<span class="markdown-image-missing">이미지를 불러오는 중이에요.</span>'
    : renderImage(tokens, index, options, env, self);
  return (
    (row?.first
      ? `<span class="markdown-image-row" style="--image-row-gaps: calc(${row.count - 1} * var(--image-row-gap));">`
      : "") +
    rendered +
    (row?.last ? "</span>" : "")
  );
};
markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  tokens[index]!.attrSet("target", "_blank");
  tokens[index]!.attrSet("rel", "noopener noreferrer");
  return self.renderToken(tokens, index, options);
};
export function renderMarkdown(
  content: string,
  images: Record<string, string> = {},
  options: RenderOptions = {},
) {
  return DOMPurify.sanitize(
    markdown.render(content, {
      ...options,
      images,
      imageCounts: new Map(),
      headingIndex: 0,
    }),
    {
      ADD_ATTR: ["target"],
      // KaTeX emits MathML and SVG for accessible formulas. HTML input stays disabled.
      USE_PROFILES: { html: true, mathMl: true, svg: true },
    },
  );
}
