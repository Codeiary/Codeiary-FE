<script setup lang="ts">
import Icon from "@/components/Icon.vue";
</script>

<template>
  <div class="default-post-cover" aria-hidden="true">
    <Icon name="book" :size="32" />
  </div>
</template>

<style scoped>
.default-post-cover {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: #f0efeb;
  color: #a6a59e;
}
.default-post-cover svg {
  opacity: 0.65;
}
:root[data-theme="dark"] .default-post-cover {
  background: var(--theme-raised);
  color: var(--theme-muted);
}
</style>
