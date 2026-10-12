import type { MarkdownIt } from "markdown-it";
import texmath from "markdown-it-texmath";
import "katex/dist/katex.min.css";

export function enableMath(markdown: MarkdownIt) {
  markdown.use(texmath, {
    delimiters: "dollars",
    katexOptions: { trust: false, throwOnError: false, maxExpand: 1000 },
  });
}
