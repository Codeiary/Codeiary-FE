<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from "vue";
import type { JSONContent } from "@tiptap/core";
import { normalizePortfolioDocument } from "@/utils/portfolio/document";
import { contentFromEditorDocument, textRunStyle } from "@/utils/portfolio/rich-text";
import CodeContent from "./PortfolioCodeContent.vue";

export default defineComponent({
  props: { document: { type: Object as PropType<JSONContent>, required: true } },
  setup(props) {
    function render(node: JSONContent): VNode | string {
      if (node.type === "text") {
        let text: VNode | string = node.text ?? "";
        const run = contentFromEditorDocument({ type: "doc", content: [{ type: "paragraph", content: [node] }] }).runs[0];
        if (run) text = h("span", { style: textRunStyle(run) }, text);
        for (const mark of node.marks ?? []) {
          const tag = { bold: "strong", italic: "em", code: "code", strike: "s", link: "a" }[mark.type];
          if (tag) text = h(tag, tag === "a" ? { href: mark.attrs?.href, target: "_blank", rel: "noopener noreferrer" } : {}, [text]);
        }
        return text;
      }
      const tags: Record<string, string> = { doc: "div", paragraph: "p", hardBreak: "br", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", horizontalRule: "hr", table: "table", tableRow: "tr", tableCell: "td", tableHeader: "th" };
      if (node.type === "image") return h("img", { ...node.attrs, loading: "lazy" });
      const children = node.content?.map(render) ?? [];
      if (node.type === "codeBlock") return h(CodeContent, { code: node.content?.map((child) => child.text ?? "").join("") ?? "", language: String(node.attrs?.language || "") });
      return h(node.type === "heading" ? `h${node.attrs?.level ?? 2}` : tags[node.type ?? ""] ?? "div",
        node.type === "orderedList" ? { start: node.attrs?.start } : node.type === "tableCell" || node.type === "tableHeader" ? { colspan: node.attrs?.colspan, rowspan: node.attrs?.rowspan } : {}, children);
    }
    return () => h("div", { class: "portfolio-formatted-content" }, [render(normalizePortfolioDocument(props.document))]);
  },
});
</script>
