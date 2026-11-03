<script setup lang="ts">
import EditorIcon from "@/components/blog/EditorIcon.vue";
defineProps<{ modelValue: "left" | "center" | "right"; disabled?: boolean; title?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: "left" | "center" | "right"] }>();
const choices = [{ value: "left", label: "왼쪽" }, { value: "center", label: "가운데" }, { value: "right", label: "오른쪽" }] as const;
</script>
<template>
  <div class="portfolio-alignment-row"><span>정렬</span><div class="portfolio-alignment-options" role="group" :aria-label="title ? '제목 정렬' : '블록 정렬'">
    <button v-for="choice in choices" :key="choice.value" type="button" :aria-label="`${title ? '제목 ' : ''}${choice.label} 정렬`" :aria-pressed="modelValue === choice.value" :disabled="disabled" @click="emit('update:modelValue', choice.value)"><EditorIcon :name="`align-${choice.value}`" /></button>
  </div></div>
</template>
<style scoped>
.portfolio-alignment-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.portfolio-alignment-row > span { font-size: 12px; font-weight: 600; }
.portfolio-alignment-options { display: flex; gap: 2px; padding: 3px; border: 1px solid var(--theme-border); border-radius: 6px; background: var(--theme-raised); }
.portfolio-alignment-options button { display: grid; min-width: 34px; min-height: 32px; padding: 4px 9px; place-items: center; border-radius: 4px; color: var(--theme-muted); }
.portfolio-alignment-options button[aria-pressed="true"] { background: var(--theme-surface); color: var(--theme-text); box-shadow: 0 1px 3px #00000010; }
.portfolio-alignment-options button:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 2px; }
.portfolio-alignment-options button:disabled { cursor: not-allowed; opacity: .4; }
.portfolio-alignment-options svg { width: 16px; height: 16px; }
</style>
