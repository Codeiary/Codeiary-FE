import { codeLanguages } from "./code-languages";

export type EditorAction =
  | "h1"
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "strike"
  | "quote"
  | "bullet"
  | "numbered"
  | "code"
  | "table"
  | "math"
  | "divider";

export function markdownInsertion(
  action: EditorAction,
  selected: string,
  language = "",
) {
  const inline = (before: string, placeholder: string, after = before) => ({
    text: `${before}${selected || placeholder}${after}`,
    offset: before.length,
    length: (selected || placeholder).length,
  });
  switch (action) {
    case "bold":
      return inline("**", "굵은 글씨");
    case "italic":
      return inline("*", "기울인 글씨");
    case "strike":
      return inline("~~", "취소선");
    case "h1":
    case "h2":
    case "h3":
      return inline(`${"#".repeat(Number(action[1]))} `, "소제목", "");
    case "quote":
      return {
        text: (selected || "인용할 문장")
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
        offset: 2,
        length: (selected || "인용할 문장").length,
      };
    case "bullet":
      return {
        text: (selected || "목록 항목")
          .split("\n")
          .map((line) => `- ${line}`)
          .join("\n"),
        offset: 2,
        length: (selected || "목록 항목").length,
      };
    case "numbered":
      return {
        text: (selected || "목록 항목")
          .split("\n")
          .map((line, i) => `${i + 1}. ${line}`)
          .join("\n"),
        offset: 3,
        length: (selected || "목록 항목").length,
      };
    case "code": {
      const choice = codeLanguages.find((item) => item.value === language);
      const runs = selected.match(/`+/g) ?? [];
      const fence = "`".repeat(
        Math.max(3, ...runs.map((run) => run.length + 1)),
      );
      if (choice)
        return inline(
          `${fence}${choice.value}\n`,
          choice.example,
          `\n${fence}`,
        );
      return {
        text: `${fence}\n${selected}\n${fence}`,
        offset: fence.length,
        length: 0,
      };
    }
    case "math": {
      const formula = selected.replace(/\s*\n\s*/g, " ").trim() || "E = mc^2";
      return { text: `$${formula}$`, offset: 1, length: formula.length };
    }
    case "table":
      return {
        text: "| 제목 | 내용 |\n| --- | --- |\n| 항목 1 | 내용 1 |\n| 항목 2 | 내용 2 |",
        offset: 2,
        length: 2,
      };
    case "divider":
      return { text: "---", offset: 3, length: 0 };
  }
}
