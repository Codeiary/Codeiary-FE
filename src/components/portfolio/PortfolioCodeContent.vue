<script setup lang="ts">
import { computed } from "vue";
import { highlightCode } from "@/utils/blog/code-highlight";
const props = defineProps<{ code: string; language: string }>();
// highlight.js escapes source text before adding its own token spans.
const highlighted = computed(() => highlightCode(props.code, props.language) || props.code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
</script>
<template>
  <div class="portfolio-code-block"><div class="portfolio-code-bar">{{ language || '일반 텍스트' }}</div><pre><code :class="language ? `language-${language}` : undefined" v-html="highlighted"></code></pre></div>
</template>
