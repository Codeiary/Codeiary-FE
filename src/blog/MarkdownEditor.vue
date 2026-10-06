<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Compartment, EditorState, EditorSelection } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder,
  drawSelection,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentMore,
  indentLess,
  undo,
  redo,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { tags } from "@lezer/highlight";
import {
  autocompletion,
  completionKeymap,
  startCompletion,
} from "@codemirror/autocomplete";
import {
  defaultHighlightStyle,
  HighlightStyle,
  syntaxHighlighting,
  bracketMatching,
  indentUnit,
} from "@codemirror/language";
import { markdownInsertion, type EditorAction } from "./editor-commands";
import { codeLanguageCompletion } from "./code-completion";
import "./syntax.css";

const props = defineProps<{ modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  save: [];
  images: [files: File[]];
  scroll: [];
}>();
const host = ref<HTMLElement>();
let view: EditorView | undefined;
const editable = new Compartment();

function insert(text: string, block = false, offset = text.length, length = 0) {
  if (!view || props.disabled) return;
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const before =
    block && from > 0
      ? doc.sliceString(Math.max(0, from - 2), from).endsWith("\n\n")
        ? ""
        : doc.sliceString(from - 1, from) === "\n"
          ? "\n"
          : "\n\n"
      : "";
  const after =
    block && to < doc.length
      ? doc.sliceString(to, to + 2).startsWith("\n\n")
        ? ""
        : doc.sliceString(to, to + 1) === "\n"
          ? "\n"
          : "\n\n"
      : "";
  view.dispatch({
    changes: { from, to, insert: before + text + after },
    selection: EditorSelection.range(
      from + before.length + offset,
      from + before.length + offset + length,
    ),
    scrollIntoView: true,
  });
  view.focus();
}
function format(action: EditorAction) {
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const insertion = markdownInsertion(
    action,
    view.state.doc.sliceString(from, to),
  );
  insert(
    insertion.text,
    !["bold", "italic", "strike", "math"].includes(action),
    insertion.offset,
    insertion.length,
  );
  if (action === "code") startCompletion(view);
}
function selectedText() {
  if (!view) return "";
  const { from, to } = view.state.selection.main;
  return view.state.doc.sliceString(from, to);
}
defineExpose({
  format,
  insert,
  selectedText,
  scrollElement: () => view?.scrollDOM,
  undo: () => view && undo(view),
  redo: () => view && redo(view),
});
onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        history(),
        drawSelection(),
        bracketMatching(),
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        markdown({ codeLanguages: languages }),
        autocompletion({
          override: [codeLanguageCompletion],
          activateOnTypingDelay: 60,
          interactionDelay: 0,
          defaultKeymap: false,
          icons: false,
        }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        syntaxHighlighting(
          HighlightStyle.define([
            {
              tag: [tags.keyword, tags.bool, tags.null, tags.meta],
              color: "var(--syntax-keyword)",
            },
            { tag: [tags.string, tags.regexp], color: "var(--syntax-string)" },
            { tag: [tags.number, tags.atom], color: "var(--syntax-number)" },
            {
              tag: [tags.function(tags.variableName), tags.propertyName],
              color: "var(--syntax-function)",
            },
            {
              tag: [
                tags.typeName,
                tags.className,
                tags.tagName,
                tags.attributeName,
              ],
              color: "var(--syntax-type)",
            },
            {
              tag: tags.comment,
              color: "var(--syntax-comment)",
              fontStyle: "italic",
            },
            { tag: tags.heading, fontWeight: "700" },
            { tag: tags.strong, fontWeight: "700" },
            { tag: tags.emphasis, fontStyle: "italic" },
            { tag: tags.strikethrough, textDecoration: "line-through" },
            {
              tag: [tags.link, tags.url],
              color: "var(--theme-accent)",
              textDecoration: "underline",
            },
          ]),
        ),
        EditorView.lineWrapping,
        editable.of([
          EditorState.readOnly.of(Boolean(props.disabled)),
          EditorView.editable.of(!props.disabled),
        ]),
        placeholder(
          "여기에 이야기를 적어보세요.\n\n마크다운으로 자유롭게 작성하고, 미리보기로 확인하세요.",
        ),
        EditorView.contentAttributes.of({
          "aria-label": "마크다운 본문",
          spellcheck: "false",
        }),
        keymap.of([
          ...completionKeymap,
          {
            key: "Tab",
            run: (editor) => {
              if (editor.state.readOnly) return false;
              if (editor.state.selection.ranges.some((range) => !range.empty))
                return indentMore(editor);
              editor.dispatch(
                editor.state.update(editor.state.replaceSelection("    "), {
                  scrollIntoView: true,
                  userEvent: "input.indent",
                }),
              );
              return true;
            },
            shift: indentLess,
          },
          {
            key: "Mod-b",
            run: () => {
              format("bold");
              return true;
            },
          },
          {
            key: "Mod-i",
            run: () => {
              format("italic");
              return true;
            },
          },
          {
            key: "Mod-s",
            run: () => {
              emit("save");
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            emit("update:modelValue", update.state.doc.toString());
        }),
        EditorView.domEventHandlers({
          scroll(event, editor) {
            if (event.target === editor.scrollDOM) emit("scroll");
            return false;
          },
          paste(event) {
            const files = Array.from(event.clipboardData?.files ?? []).filter(
              (file) => file.type.startsWith("image/"),
            );
            if (!files.length) return false;
            event.preventDefault();
            emit("images", files);
            return true;
          },
          drop(event, editor) {
            const files = Array.from(event.dataTransfer?.files ?? []);
            if (!files.length) return false;
            event.preventDefault();
            const position = editor.posAtCoords({
              x: event.clientX,
              y: event.clientY,
            });
            if (position !== null)
              editor.dispatch({ selection: { anchor: position } });
            emit("images", files);
            return true;
          },
          dragover(event) {
            if (event.dataTransfer?.types.includes("Files")) {
              event.preventDefault();
              return true;
            }
            return false;
          },
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            backgroundColor: "transparent",
            color: "var(--theme-text)",
            fontSize: "15px",
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, 'Noto Sans KR', monospace",
            lineHeight: "1.95",
          },
          ".cm-content": {
            padding: "18px 30px 70px",
            minHeight: "100%",
            caretColor: "var(--theme-accent)",
          },
          ".cm-line": { padding: "0" },
          "&.cm-focused": { outline: "none" },
          ".cm-placeholder": { color: "var(--theme-muted)", opacity: ".7" },
          ".cm-cursor": { borderLeftColor: "var(--theme-accent)" },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            backgroundColor:
              "color-mix(in srgb, var(--theme-accent) 24%, transparent)",
          },
          ".cm-activeLine": { backgroundColor: "transparent" },
          ".cm-tooltip-autocomplete": {
            border: "1px solid var(--theme-border)",
            backgroundColor: "var(--theme-surface)",
            color: "var(--theme-text)",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 8px 28px #0002",
            fontFamily: "'DM Sans', 'Noto Sans KR', sans-serif",
            fontSize: "var(--font-size-min)",
          },
          ".cm-tooltip.cm-tooltip-autocomplete > ul": {
            maxHeight: "240px",
            minWidth: "175px",
            fontFamily: "inherit",
          },
          ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
            padding: "7px 12px",
          },
          ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
            backgroundColor: "var(--theme-raised)",
            color: "var(--theme-text)",
          },
          ".cm-completionMatchedText": {
            textDecoration: "none",
            color: "var(--theme-accent)",
            fontWeight: "700",
          },
          ".cm-tooltip.cm-tooltip-autocomplete completion-section": {
            color: "var(--theme-muted)",
            fontSize: "var(--font-size-min)",
            borderBottom: "1px solid var(--theme-border)",
          },
          "@media (max-width: 760px)": {
            ".cm-content": { padding: "14px 20px 60px" },
          },
        }),
      ],
    }),
  });
});
watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString())
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
  },
);
watch(
  () => props.disabled,
  (disabled) =>
    view?.dispatch({
      effects: editable.reconfigure([
        EditorState.readOnly.of(Boolean(disabled)),
        EditorView.editable.of(!disabled),
      ]),
    }),
);
onBeforeUnmount(() => view?.destroy());
</script>

<template><div ref="host" class="markdown-editor"></div></template>
