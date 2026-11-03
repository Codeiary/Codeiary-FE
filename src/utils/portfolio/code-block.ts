import CodeBlock from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import { codeGrammars } from "@/utils/blog/code-highlight";
const lowlight = createLowlight(codeGrammars);

export const portfolioCodeLanguages = [
  ["", "일반 텍스트"], ["java", "Java"], ["javascript", "JavaScript"], ["typescript", "TypeScript"],
  ["python", "Python"], ["kotlin", "Kotlin"], ["sql", "SQL"], ["bash", "Bash"], ["json", "JSON"],
  ["html", "HTML"], ["css", "CSS"], ["cpp", "C++"], ["c", "C"], ["go", "Go"], ["rust", "Rust"], ["yaml", "YAML"],
] as const;

export const PortfolioCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement("div");
      dom.className = "portfolio-code-block";
      const bar = document.createElement("div");
      bar.className = "portfolio-code-bar";
      bar.contentEditable = "false";
      const select = document.createElement("select");
      select.setAttribute("aria-label", "코드 블록 언어");
      portfolioCodeLanguages.forEach(([value, label]) => select.add(new Option(label, value)));
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      pre.append(code); bar.append(select); dom.append(bar, pre);
      function sync() {
        const language = String(current.attrs.language ?? "");
        if (![...select.options].some((option) => option.value === language)) select.add(new Option(language, language));
        select.value = language;
        select.disabled = !editor.isEditable;
        code.className = language ? `language-${language}` : "";
      }
      select.onchange = () => {
        const position = getPos();
        if (!editor.isEditable || typeof position !== "number") return;
        editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, language: select.value }));
      };
      sync();
      return {
        dom, contentDOM: code,
        update(next) { if (next.type !== current.type) return false; current = next; sync(); return true; },
        stopEvent(event) { return event.target instanceof Node && bar.contains(event.target); },
        ignoreMutation(mutation) { return mutation.type !== "selection" && bar.contains(mutation.target); },
        destroy() { select.onchange = null; },
      };
    };
  },
}).configure({ lowlight, defaultLanguage: "plaintext", enableTabIndentation: true, tabSize: 4 });
