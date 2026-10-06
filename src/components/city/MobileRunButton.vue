<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ change: [running: boolean] }>();
const running = ref(false);
function setRunning(value: boolean) {
  running.value = value;
  emit("change", value);
}
function reset() {
  setRunning(false);
}
function visibilityChanged() {
  if (document.hidden) reset();
}
watch(
  () => props.disabled,
  (value) => {
    if (value) reset();
  },
);
onMounted(() => {
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", visibilityChanged);
});
onBeforeUnmount(() => {
  reset();
  window.removeEventListener("blur", reset);
  document.removeEventListener("visibilitychange", visibilityChanged);
});
</script>

<template>
  <button
    class="mobile-run-button"
    type="button"
    :disabled="disabled"
    :aria-pressed="running"
    aria-label="달리기"
    @click="setRunning(!running)"
  >
    <Icon name="run" :size="18" /><span>달리기</span>
  </button>
</template>

<style scoped>
.mobile-run-button {
  display: none;
  position: absolute;
  left: max(16px, env(safe-area-inset-left));
  bottom: calc(96px + env(safe-area-inset-bottom));
  z-index: 7;
  width: 78px;
  height: 40px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  color: var(--theme-muted);
  background: color-mix(in srgb, var(--theme-surface) 85%, transparent);
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 18px #172c2d10;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.mobile-run-button span {
  font-size: 11px;
  font-weight: 600;
}
.mobile-run-button[aria-pressed="true"] {
  color: var(--theme-accent);
  border-color: color-mix(in srgb, var(--theme-accent) 45%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface));
}
.mobile-run-button:disabled {
  opacity: 0.35;
}
.mobile-run-button:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 4px;
}
@media (max-width: 649px), (hover: none) and (pointer: coarse) {
  .mobile-run-button {
    display: flex;
  }
}
</style>
