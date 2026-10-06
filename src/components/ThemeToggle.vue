<script setup lang="ts">
import Icon from "@/components/Icon.vue";
import { useTheme } from "@/composables/useTheme";

const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <button
    class="theme-toggle"
    :title="isDark ? '라이트 모드로 전환' : '다크 모드로 전환'"
    :aria-label="isDark ? '라이트 모드로 전환' : '다크 모드로 전환'"
    :aria-pressed="isDark"
    @click="toggleTheme"
  >
    <Icon :name="isDark ? 'moon' : 'sun'" :size="20" />
  </button>
</template>
