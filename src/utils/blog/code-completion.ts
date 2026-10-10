import type {
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { Transaction } from "@codemirror/state";
import { codeLanguages } from "@/utils/blog/code-languages";

export function codeLanguageCompletion(
  context: CompletionContext,
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const match = /^( {0,3})(`{3,})([\w+-]*)$/.exec(
    line.text.slice(0, context.pos - line.from),
  );
  if (!match) return null;
  const indent = match[1]!;
  const fence = match[2]!;
  const mark = syntaxTree(context.state).resolveInner(
    line.from + indent.length + 1,
    1,
  );
  // A closing fence (or backticks inside code) must not open the language menu.
  if (
    mark.name !== "CodeMark" ||
    mark.parent?.name !== "FencedCode" ||
    mark.parent.firstChild?.from !== mark.from
  )
    return null;

  return {
    from: line.from + indent.length + fence.length,
    to: line.to,
    validFor: /^[\w+-]*$/,
    options: codeLanguages.map((language, index) => ({
      label: language.value,
      displayLabel: language.label,
      type: "type",
      boost: codeLanguages.length - index,
      section: "코드 언어",
      apply(view, _completion, from, to) {
        const currentLine = view.state.doc.lineAt(from);
        const atEnd = currentLine.to === view.state.doc.length;
        const insert = language.value + (atEnd ? `\n\n${indent}${fence}` : "");
        const cursor = atEnd
          ? from + language.value.length + 1
          : currentLine.to + language.value.length - (to - from) + 1;
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: cursor },
          scrollIntoView: true,
          annotations: Transaction.userEvent.of("input.complete"),
        });
        view.focus();
      },
    })),
  };
}
