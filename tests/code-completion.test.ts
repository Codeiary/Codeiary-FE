import { describe, expect, it, vi } from "vitest";
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { codeLanguageCompletion } from "../src/blog/code-completion";
import { markdownInsertion } from "../src/blog/editor-commands";

function completionFixture(doc: string, pos = doc.length) {
  let state = EditorState.create({
    doc,
    extensions: [markdown()],
    selection: { anchor: pos },
  });
  const result = codeLanguageCompletion(
    new CompletionContext(state, pos, false),
  );
  return {
    result,
    apply(language: string) {
      const option = result?.options.find((item) => item.label === language);
      if (!result || !option || typeof option.apply !== "function")
        throw new Error("언어 선택 항목이 없어요.");
      const view = {
        get state() {
          return state;
        },
        dispatch(spec: TransactionSpec) {
          state = state.update(spec).state;
        },
        focus: vi.fn(),
      } as unknown as EditorView;
      option.apply(view, option, result.from, result.to ?? pos);
      return state;
    },
  };
}

describe("코드 블록 언어 선택", () => {
  it("여는 백틱 세 개를 입력하면 코드 언어를 선택할 수 있다.", () => {
    const fixture = completionFixture("```");
    expect(fixture.result?.options.map((item) => item.displayLabel)).toEqual(
      expect.arrayContaining(["Java", "JavaScript", "Python"]),
    );
    const state = fixture.apply("java");
    expect(state.doc.toString()).toBe("```java\n\n```");
    expect(state.selection.main.head).toBe("```java\n".length);
  });
  it("코드 블록 버튼으로 감싼 내용을 유지하며 언어를 선택할 수 있다.", () => {
    const source = 'const title = "Code Diary";';
    const insertion = markdownInsertion("code", source);
    const fixture = completionFixture(insertion.text, insertion.offset);
    expect(fixture.apply("javascript").doc.toString()).toBe(
      "```javascript\n" + source + "\n```",
    );
  });
  it("입력하던 언어 이름을 완성하고 본문을 보존할 수 있다.", () => {
    const fixture = completionFixture("```ja\n기존 내용\n```", 5);
    expect(fixture.apply("java").doc.toString()).toBe(
      "```java\n기존 내용\n```",
    );
  });
  it.each(["문장 안의 ```", "```java\ncode\n```", "````text\n```"])(
    "%s에서는 불필요한 언어 목록을 숨길 수 있다.",
    (source) => expect(completionFixture(source).result).toBeNull(),
  );
});
