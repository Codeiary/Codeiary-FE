<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";
const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  label?: string;
}>(), {
  placeholder: "제목, 카테고리, 태그 검색",
  label: "블로그 글 검색",
});
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const input = ref(props.modelValue);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(() => props.modelValue, (value) => {
  clearTimeout(timer);
  input.value = value;
});
function updateSearch(value: string) {
  input.value = value;
  clearTimeout(timer);
  timer = setTimeout(() => emit("update:modelValue", value), 300);
}
function clearSearch() {
  clearTimeout(timer);
  input.value = "";
  emit("update:modelValue", "");
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div role="search">
    <label class="search-input"
      ><svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" /></svg
      ><input
        :value="input"
        @input="updateSearch(($event.target as HTMLInputElement).value)"
        type="search"
        :placeholder="placeholder"
        :aria-label="label" /><button
        v-if="input"
        class="clear-blog-search"
        aria-label="검색어 지우기"
        @click="clearSearch"
      >
        <Icon name="close" :size="16" /></button
    ></label>
  </div>
</template>

<style scoped>
.search-input {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--theme-raised);
  color: var(--theme-muted);
  font-size: var(--font-size-min);
}
.search-input:focus-within {
  border-color: var(--theme-accent);
  outline: 2px solid color-mix(in srgb, var(--theme-accent) 15%, transparent);
}
.search-input > svg { flex-shrink: 0; width: 16px; height: 16px; margin: 0; }
.search-input input {
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--theme-text);
  font: inherit;
}
.search-input input::placeholder { color: var(--theme-muted); }
.clear-blog-search { display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; padding: 0; border-radius: 6px; color: var(--theme-muted); }
.clear-blog-search:hover { color: var(--theme-text); }
.clear-blog-search:focus-visible { outline: 2px solid var(--theme-accent); }
input::-webkit-search-cancel-button {
  display: none;
}
</style>
