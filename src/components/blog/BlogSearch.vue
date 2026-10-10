<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";
const props = defineProps<{ modelValue: string }>();
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
      >
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" /></svg
      ><input
        :value="input"
        @input="updateSearch(($event.target as HTMLInputElement).value)"
        type="search"
        placeholder="제목, 카테고리, 태그 검색"
        aria-label="블로그 글 검색" /><button
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
input::-webkit-search-cancel-button {
  display: none;
}
</style>
