<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from "vue";
import { COMMENT_MAX_LENGTH } from "@/utils/blog/comments";
const props = withDefaults(
  defineProps<{
    initialValue?: string;
    label?: string;
    submitLabel?: string;
    busy?: boolean;
    cancellable?: boolean;
  }>(),
  { initialValue: "", label: "댓글 내용", submitLabel: "등록" },
);
const emit = defineEmits<{ submit: [content: string]; cancel: [] }>();
const text = ref(props.initialValue);
const textarea = ref<HTMLTextAreaElement>();
let resizeObserver: ResizeObserver | undefined;
let measuredWidth = 0;
function fitContent() {
  const input = textarea.value;
  if (!input) return;
  const styles = getComputedStyle(input);
  const minimum = parseFloat(styles.minHeight);
  const maximum = parseFloat(styles.maxHeight);
  input.style.height = "0px";
  const height = Math.max(minimum, Math.min(input.scrollHeight, maximum));
  input.style.height = `${height}px`;
  input.style.overflowY = input.scrollHeight > maximum ? "auto" : "hidden";
}
watch(text, () => nextTick(fitContent));
onMounted(() => {
  fitContent();
  if (typeof ResizeObserver === "undefined") return;
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry || entry.contentRect.width === measuredWidth) return;
    measuredWidth = entry.contentRect.width;
    fitContent();
  });
  if (textarea.value) resizeObserver.observe(textarea.value);
});
onBeforeUnmount(() => resizeObserver?.disconnect());
const picker = ref(false);
const id = useId();
const emojis = [
  "😀",
  "😊",
  "🥰",
  "😎",
  "🤔",
  "😂",
  "🥹",
  "🎉",
  "👏",
  "👍",
  "🙏",
  "💪",
  "❤️",
  "🔥",
  "✨",
  "🚀",
  "💡",
  "✅",
  "👀",
  "💻",
  "🌱",
  "☕",
  "📚",
  "🐱",
];
const valid = computed(
  () => text.value.trim().length > 0 && text.value.length <= COMMENT_MAX_LENGTH,
);
function submit() {
  if (!props.busy && valid.value) emit("submit", text.value);
}
async function insert(emoji: string) {
  const input = textarea.value;
  const start = input?.selectionStart ?? text.value.length;
  const end = input?.selectionEnd ?? start;
  if (text.value.length - (end - start) + emoji.length > COMMENT_MAX_LENGTH)
    return;
  text.value = text.value.slice(0, start) + emoji + text.value.slice(end);
  picker.value = false;
  await nextTick();
  input?.focus();
  input?.setSelectionRange(start + emoji.length, start + emoji.length);
}
function escape() {
  if (picker.value) {
    picker.value = false;
    textarea.value?.focus();
  } else if (props.cancellable && !props.busy) emit("cancel");
}
</script>
<template>
  <form
    class="comment-composer"
    @submit.prevent="submit"
    @keydown.esc.stop="escape"
  >
    <label :for="id" class="visually-hidden">{{ label }}</label>
    <textarea
      :id="id"
      ref="textarea"
      v-model="text"
      :placeholder="
        label === '답글 내용' ? '답글을 남겨보세요.' : '생각을 나눠보세요.'
      "
      :maxlength="COMMENT_MAX_LENGTH"
      :disabled="busy"
      rows="2"
      @keydown.ctrl.enter.prevent="submit"
      @keydown.meta.enter.prevent="submit"
    />
    <div class="comment-compose-footer">
      <button
        type="button"
        class="comment-emoji-toggle"
        aria-label="이모지 선택"
        :aria-expanded="picker"
        :aria-controls="`${id}-emojis`"
        :disabled="busy"
        @click="picker = !picker"
      >
        ☺
      </button>
      <span class="comment-counter"
        >{{ text.length }} / {{ COMMENT_MAX_LENGTH.toLocaleString() }}</span
      >
      <button
        v-if="cancellable"
        type="button"
        class="comment-cancel"
        :disabled="busy"
        @click="emit('cancel')"
      >
        취소
      </button>
      <button class="comment-submit" :disabled="busy || !valid">
        {{ busy ? "저장 중" : submitLabel }}
      </button>
    </div>
    <div
      v-if="picker"
      :id="`${id}-emojis`"
      class="comment-emoji-picker"
      role="group"
      aria-label="이모지"
    >
      <button
        v-for="emoji in emojis"
        :key="emoji"
        type="button"
        :aria-label="`${emoji} 삽입`"
        @click="insert(emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </form>
</template>
<style scoped>
.comment-composer {
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: var(--theme-surface);
  overflow: hidden;
}
.comment-composer:focus-within {
  border-color: var(--theme-accent);
}
.comment-composer textarea {
  display: block;
  width: 100%;
  height: 64px;
  min-height: 64px;
  max-height: 300px;
  resize: none;
  overflow-y: hidden;
  border: 0;
  outline: none;
  padding: 14px 16px;
  background: transparent;
  color: var(--theme-text);
  font: inherit;
  line-height: 1.7;
}
.comment-composer textarea::placeholder {
  color: var(--theme-muted);
}
.comment-compose-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 10px 10px;
}
.comment-emoji-toggle {
  width: 32px;
  height: 32px;
  font-size: 23px;
  color: var(--theme-muted);
  border-radius: 7px;
}
.comment-counter {
  margin-right: auto;
  color: var(--theme-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.comment-cancel,
.comment-submit {
  padding: 7px 13px;
  min-height: 32px;
  border-radius: 7px;
  font-size: inherit;
  white-space: nowrap;
}
.comment-cancel {
  color: var(--theme-muted);
}
.comment-submit {
  background: var(--theme-accent);
  color: white;
  font-weight: 600;
}
.comment-submit:disabled {
  opacity: 0.4;
  cursor: default;
}
.comment-emoji-toggle:hover,
.comment-cancel:hover {
  background: var(--theme-raised);
}
.comment-emoji-picker {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  padding: 8px;
  border-top: 1px solid var(--theme-border);
  gap: 2px;
}
.comment-emoji-picker button {
  display: grid;
  place-items: center;
  min-height: 34px;
  border-radius: 6px;
  font-size: 20px;
}
.comment-emoji-picker button:hover {
  background: var(--theme-raised);
}
button:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: -2px;
}
@media (max-width: 600px) {
  .comment-composer textarea {
    padding: 10px 12px;
    height: 42px;
    min-height: 42px;
    line-height: 20px;
  }
  .comment-emoji-picker {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
