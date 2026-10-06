import hljs from "highlight.js/lib/core";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import kotlin from "highlight.js/lib/languages/kotlin";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import cpp from "highlight.js/lib/languages/cpp";

for (const [name, grammar] of Object.entries({
  java,
  javascript,
  typescript,
  python,
  kotlin,
  xml,
  css,
  sql,
  json,
  bash,
  yaml,
  go,
  rust,
  cpp,
})) {
  hljs.registerLanguage(name, grammar);
}

export function highlightCode(code: string, language: string) {
  const name = language.toLowerCase();
  if (!name || !hljs.getLanguage(name)) return "";
  try {
    return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
  } catch {
    // Markdown-it escapes the original source when highlighting is unavailable.
    return "";
  }
}
