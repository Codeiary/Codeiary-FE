<script setup lang="ts">
import { useRecentPortfolioColors } from "@/composables/useRecentPortfolioColors";
import { computed, ref, watch } from "vue";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Markdown } from "@tiptap/markdown";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import Paragraph from "@tiptap/extension-paragraph";
import { PortfolioCodeBlock } from "@/utils/portfolio/code-block";
import type { JSONContent } from "@tiptap/core";
import { safePortfolioImage, type PortfolioBlock } from "@/utils/portfolio/layout";
import { documentFromPortfolioBlocks, normalizePortfolioDocument, portablePortfolioDocument } from "@/utils/portfolio/document";
import { portfolioFonts, portfolioFontFamily, loadPortfolioFont } from "@/utils/portfolio/fonts";
import { contentFromEditorDocument, normalizeTextRuns, runsToEditorDocument, type PortfolioTextRun } from "@/utils/portfolio/rich-text";

const props = withDefaults(defineProps<{
  content: string;
  runs?: PortfolioTextRun[];
  disabled?: boolean;
  heading?: boolean;
  label?: string;
  toolbarTarget?: string;
  singleLine?: boolean;
  defaultSize?: number;
  flow?: boolean;
  document?: JSONContent;
  sourceBlocks?: PortfolioBlock[];
  showToolbar?: boolean;
  placeholder?: string;
}>(), { label: "본문 직접 편집", disabled: false, heading: false, showToolbar: true });
const emit = defineEmits<{
  change: [value: { content: string; runs: PortfolioTextRun[]; document?: JSONContent }];
  enter: [];
  focus: [];
}>();
const { colors: recentColors, remember: rememberColor } = useRecentPortfolioColors();
const selectionVersion = ref(0);
const editor = useEditor({
  content: props.flow ? (props.document ? normalizePortfolioDocument(props.document) : props.content) : runsToEditorDocument(props.content, props.runs),
  contentType: props.flow && !props.document ? "markdown" : "json",
  editable: !props.disabled,
  autofocus: "end",
  extensions: [
    StarterKit.configure(props.flow ? { paragraph: false, heading: { levels: [1, 2, 3] }, codeBlock: false, underline: false, link: { openOnClick: false }, trailingNode: false } : {
      blockquote: false, bulletList: false, orderedList: false, listItem: false,
      listKeymap: false, code: false, codeBlock: false, heading: false,
      horizontalRule: false, strike: false, underline: false, link: false,
      dropcursor: false, gapcursor: false, trailingNode: false,
    }),
    TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
    ...(props.flow ? [Markdown, TableKit, PortfolioCodeBlock, Paragraph.extend({
      renderMarkdown(node, helpers) {
        return helpers.renderChildren(node.content ?? []).replace(/^( {0,3})(#{1,6}(?=\s)|>(?=\s)|[-+](?=\s)|\d+\.(?=\s))/gm, "$1\\$2");
      },
    }), Image.extend({
      renderHTML({ HTMLAttributes }) { return ["img", { ...HTMLAttributes, src: safePortfolioImage(HTMLAttributes.src) ?? "" }]; },
    }).configure({ resize: { enabled: !props.disabled, directions: ["bottom-right", "bottom-left"], minWidth: 50, minHeight: 50, alwaysPreserveAspectRatio: true } })] : []),
  ],
  editorProps: {
    attributes: { role: "textbox", "aria-label": props.label, "aria-multiline": props.singleLine ? "false" : "true", "data-block-input": "" },
    handleKeyDown: (_view, event) => {
      if (props.flow && event.key === "Enter" && !event.isComposing && editor.value?.isActive("paragraph")) {
        const { $from, empty } = editor.value.state.selection;
        const fence = /^ {0,3}```([\w+-]*)$/.exec($from.parent.textContent);
        if (fence && empty && $from.parentOffset === $from.parent.content.size) {
          editor.value.chain().deleteRange({ from: $from.start(), to: $from.end() }).setCodeBlock({ language: fence[1] || "" }).run();
          return true;
        }
      }
      if (!props.singleLine || event.key !== "Enter" || event.isComposing) return false;
      emit("enter");
      return true;
    },
    handlePaste: (_view, event) => {
      const text = event.clipboardData?.getData("text/plain");
      if (!props.flow || !text || event.clipboardData?.getData("text/html") || !/(?:^|\n)(?:#{1,3} |[-*>] |\d+\. |```)|\*\*[^*]+\*\*/.test(text)) return false;
      editor.value?.commands.insertContent(text, { contentType: "markdown" });
      return true;
    },
  },
  onSelectionUpdate: () => { selectionVersion.value++; },
  onTransaction: () => { selectionVersion.value++; },
  onCreate: ({ editor: current }) => {
    if (props.flow && !props.document && props.sourceBlocks?.length)
      current.commands.setContent(documentFromPortfolioBlocks(props.sourceBlocks, (source) => current.markdown!.parse(source)), { emitUpdate: false });
  },
  onFocus: () => emit("focus"),
  onUpdate: ({ editor: current }) => {
    if (!props.flow) { emit("change", contentFromEditorDocument(current.getJSON())); return; }
    const document = normalizePortfolioDocument(current.getJSON());
    emit("change", { content: current.markdown!.serialize(portablePortfolioDocument(document)), document, runs: [] });
  },
});
const textStyle = computed(() => {
  void selectionVersion.value;
  return editor.value?.getAttributes("textStyle") ?? {};
});
const selectedFont = computed(() => portfolioFonts.find((font) => font.family === textStyle.value.fontFamily)?.id ?? "");
const selectedSize = computed(() => Number.parseFloat(textStyle.value.fontSize) || props.defaultSize || (props.flow ? ({ 1: 32, 2: 26, 3: 21 }[editor.value?.getAttributes("heading").level as 1 | 2 | 3] || 16) : props.heading ? 24 : 16));
const selectedColor = computed(() => /^#[\da-f]{6}$/i.test(textStyle.value.color ?? "") ? textStyle.value.color : "#303d35");
function setFont(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (!value) editor.value?.chain().focus().unsetFontFamily().run();
  else {
    loadPortfolioFont(value);
    editor.value?.chain().focus().setFontFamily(portfolioFontFamily(value)).run();
  }
}
function setSize(event: Event) {
  const size = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(size) && size >= 10 && size <= 96)
    editor.value?.chain().setFontSize(`${size}px`).run();
}
function applyColor(color: string) {
  if (/^#[\da-f]{6}$/i.test(color)) editor.value?.chain().setColor(color).run();
}
function setColor(event: Event) { applyColor((event.target as HTMLInputElement).value); }
function saveColor(event: Event) { rememberColor((event.target as HTMLInputElement).value); }
function useColor(color: string) { applyColor(color); rememberColor(color); }
watch(() => props.disabled, (disabled) => editor.value?.setEditable(!disabled));
watch(() => [props.content, props.runs, props.document] as const, ([content, runs, document]) => {
  if (!editor.value) return;
  if (props.flow) {
    if (document) {
      const normalized = normalizePortfolioDocument(document);
      if (JSON.stringify(normalized) !== JSON.stringify(normalizePortfolioDocument(editor.value.getJSON())))
        editor.value.commands.setContent(normalized, { emitUpdate: false });
    } else if (editor.value.getMarkdown() !== content) editor.value.commands.setContent(content, { contentType: "markdown", emitUpdate: false });
    return;
  }
  const current = contentFromEditorDocument(editor.value.getJSON());
  if (current.content !== content || JSON.stringify(current.runs) !== JSON.stringify(normalizeTextRuns(runs, content)))
    editor.value.commands.setContent(runsToEditorDocument(content, runs), { emitUpdate: false });
}, { deep: true });
defineExpose({ editor });
</script>

<template>
  <div class="portfolio-rich-editor" :class="{ 'is-heading': heading }" @click.stop>
    <Teleport :to="toolbarTarget || 'body'" :disabled="!toolbarTarget" defer>
    <div v-if="showToolbar && !disabled" class="rich-text-toolbar" role="group" aria-label="선택한 글자 서식">
      <strong class="rich-toolbar-heading">글자 스타일</strong>
      <select aria-label="선택 글꼴" :value="selectedFont" :disabled="disabled" @change="setFont">
        <option value="">페이지 글꼴</option>
        <option v-for="font in portfolioFonts" :key="font.id" :value="font.id">{{ font.label }}</option>
      </select>
      <label class="rich-size"><input aria-label="선택 글자 크기" type="number" min="10" max="96" :value="selectedSize" :disabled="disabled" @input="setSize" /><span>px</span></label>
      <label class="rich-color" title="선택 글자 색상"><span aria-hidden="true" :style="{ borderColor: selectedColor }">A</span><input type="color" aria-label="선택 글자 색상" :value="selectedColor" :disabled="disabled" @input="setColor" @change="saveColor" /></label>
      <input class="rich-color-code" aria-label="선택 글자 색상 코드" :value="selectedColor" maxlength="7" :disabled="disabled" @input="setColor" @change="saveColor" />
      <button type="button" aria-label="굵게" :aria-pressed="editor?.isActive('bold')" :disabled="disabled" @mousedown.prevent @click="editor?.chain().focus().toggleBold().run()"><strong>B</strong></button>
      <button type="button" aria-label="기울임" :aria-pressed="editor?.isActive('italic')" :disabled="disabled" @mousedown.prevent @click="editor?.chain().focus().toggleItalic().run()"><em>I</em></button>
      <div v-if="recentColors.length" class="rich-recent-colors" role="group" aria-label="최근 사용한 색상">
        <span>최근 색상</span><button v-for="color in recentColors" :key="color" type="button" :aria-label="`최근 색상 ${color}`" :title="color" :style="{ backgroundColor: color }" :disabled="disabled" @mousedown.prevent @click="useColor(color)"></button>
      </div>
    </div>
    </Teleport>
    <EditorContent :editor="editor" class="rich-text-content" :class="{ 'is-flow': flow }" :data-placeholder="placeholder" />
  </div>
</template>

<style scoped>
.portfolio-rich-editor { min-width: 0; position: relative; }
.rich-text-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin: -4px 0 14px; padding: 7px; border: 1px solid var(--theme-border); border-radius: 8px; background: var(--theme-surface); color: var(--theme-text); text-align: left; font: 12px/1.3 -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: normal; }
.rich-text-toolbar :is(input, select, button) { height: 30px; font: inherit; color: var(--theme-text); border-radius: 4px; }
.rich-text-toolbar :is(input, select) { padding: 4px 6px; background: var(--theme-raised); border: 1px solid var(--theme-border); }
.rich-text-toolbar select { width: 125px; }
.rich-text-toolbar button { min-width: 30px; padding: 4px 7px; }
.rich-text-toolbar button[aria-pressed='true'] { background: var(--theme-raised); color: var(--theme-accent); }
.rich-text-toolbar :is(input, select, button):focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 2px; }
.rich-size { display: flex; align-items: center; gap: 4px; }
.rich-size input { width: 53px; }
.rich-size > span { color: var(--theme-muted); font-size: 10px; }
.rich-color { display: grid; place-items: center; position: relative; width: 30px; height: 30px; cursor: pointer; }
.rich-color > span { border-bottom: 4px solid; font-weight: 700; font-size: 17px; line-height: 20px; }
.rich-color input { position: absolute; width: 30px; inset: 0; opacity: 0; cursor: pointer; }
.rich-color-code { width: 71px; font-family: ui-monospace, monospace !important; }
.rich-toolbar-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; margin-bottom: 6px; font-size: 13px; font-weight: 650; }
.rich-text-content :deep(.tiptap) { min-height: 0; outline: none; white-space: pre-wrap; overflow-wrap: anywhere; cursor: text; }
.rich-text-content { position: relative; }
.rich-text-content[data-placeholder]:has(.tiptap > p:only-child > br:only-child)::before,
.rich-text-content[data-placeholder]:has(.tiptap:empty)::before { content: attr(data-placeholder); position: absolute; inset: 0; color: var(--theme-muted); opacity: .65; pointer-events: none; }
.rich-text-content :deep(.tiptap p) { font-size: inherit; line-height: inherit; }
.rich-text-content:not(.is-flow) :deep(.tiptap p) { margin: 0; }
.is-heading .rich-text-content { font-size: inherit; font-weight: inherit; line-height: inherit; }
.rich-text-content :deep(.tiptap p.is-editor-empty:first-child::before) { color: var(--theme-muted); }
.rich-text-content :deep(.tiptap ::selection) { background: color-mix(in srgb, var(--theme-accent) 26%, transparent); }
.rich-recent-colors { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; margin-top: 5px; color: var(--theme-muted); }
.rich-recent-colors button { width: 22px; min-width: 22px; height: 22px; border: 1px solid var(--theme-border); border-radius: 50%; }
.rich-text-toolbar :disabled { opacity: .5; }
@media (max-width: 600px) { .rich-text-toolbar select { width: 112px; } }
</style>
