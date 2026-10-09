<script setup lang="ts">
import Icon from "@/components/Icon.vue";
const modelValue = defineModel<string>({ required: true });
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
        v-model="modelValue"
        type="search"
        placeholder="제목, 카테고리, 태그 검색"
        aria-label="블로그 글 검색" /><button
        v-if="modelValue"
        class="clear-blog-search"
        aria-label="검색어 지우기"
        @click="modelValue = ''"
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
