<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Point } from "@/utils/city/navigation";

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ move: [direction: Point] }>();
const base = ref<HTMLButtonElement>();
const thumb = ref({ x: 0, y: 0 });
const active = ref(false);
let pointer: number | null = null;
let center = { x: 0, y: 0 };
let radius = 36;
const keys = new Set<string>();
const directions: Record<string, Point> = {
  ArrowUp: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

function move(x: number, y: number) {
  const distance = Math.hypot(x, y);
  const length = Math.min(distance, radius);
  const scale = distance ? length / distance : 0;
  thumb.value = { x: x * scale, y: y * scale };
  // A small dead zone prevents finger jitter while the thumb is centered.
  const strength = Math.max(0, (length / radius - 0.12) / 0.88);
  emit("move", {
    x: distance ? (x / distance) * strength : 0,
    z: distance ? (y / distance) * strength : 0,
  });
}
function start(event: PointerEvent) {
  if (props.disabled || pointer !== null || event.button !== 0) return;
  const rect = base.value!.getBoundingClientRect();
  center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  radius = rect.width * 0.3;
  pointer = event.pointerId;
  active.value = true;
  keys.clear();
  base.value!.setPointerCapture(event.pointerId);
  move(event.clientX - center.x, event.clientY - center.y);
}
function drag(event: PointerEvent) {
  if (event.pointerId === pointer)
    move(event.clientX - center.x, event.clientY - center.y);
}
function stop() {
  const previous = pointer;
  pointer = null;
  active.value = false;
  keys.clear();
  thumb.value = { x: 0, y: 0 };
  emit("move", { x: 0, z: 0 });
  if (previous !== null && base.value?.hasPointerCapture(previous))
    base.value.releasePointerCapture(previous);
}
function release(event: PointerEvent) {
  if (event.pointerId === pointer) stop();
}
function key(event: KeyboardEvent, down: boolean) {
  if (!directions[event.key]) return;
  event.preventDefault();
  event.stopPropagation();
  if (props.disabled || pointer !== null) return;
  if (down) keys.add(event.key);
  else keys.delete(event.key);
  const input = [...keys].reduce(
    (sum, name) => ({
      x: sum.x + directions[name]!.x,
      z: sum.z + directions[name]!.z,
    }),
    { x: 0, z: 0 },
  );
  active.value = keys.size > 0;
  move(input.x * radius, input.z * radius);
}
function visibilityChanged() {
  if (document.hidden) stop();
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) stop();
  },
);
onMounted(() => {
  window.addEventListener("blur", stop);
  window.addEventListener("resize", stop);
  document.addEventListener("visibilitychange", visibilityChanged);
});
onBeforeUnmount(() => {
  stop();
  window.removeEventListener("blur", stop);
  window.removeEventListener("resize", stop);
  document.removeEventListener("visibilitychange", visibilityChanged);
});
</script>

<template>
  <button
    ref="base"
    type="button"
    class="virtual-joystick"
    :class="{ 'is-active': active }"
    :disabled="disabled"
    aria-label="이동 조이스틱"
    aria-description="드래그하거나 방향키로 캐릭터를 이동합니다. 손을 떼면 멈춥니다."
    @pointerdown.prevent="start"
    @pointermove.prevent="drag"
    @pointerup="release"
    @pointercancel="release"
    @lostpointercapture="release"
    @keydown="key($event, true)"
    @keyup="key($event, false)"
    @blur="stop"
    @contextmenu.prevent
  >
    <span class="joystick-track" aria-hidden="true"></span>
    <span
      class="joystick-thumb"
      :style="{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }"
      aria-hidden="true"
      ><i></i
    ></span>
  </button>
</template>

<style scoped>
.virtual-joystick {
  display: none;
  position: absolute;
  right: max(24px, env(safe-area-inset-right));
  bottom: calc(72px + env(safe-area-inset-bottom));
  z-index: 7;
  width: 120px;
  height: 120px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--theme-text) 14%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--theme-surface) 66%, transparent);
  box-shadow:
    inset 0 1px 2px #ffffff45,
    0 8px 28px #172c2d0c;
  backdrop-filter: blur(12px);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.joystick-track {
  position: absolute;
  inset: 17px;
  border: 1px solid color-mix(in srgb, var(--theme-text) 8%, transparent);
  border-radius: 50%;
}
.joystick-thumb {
  position: absolute;
  top: calc(50% - 24px);
  left: calc(50% - 24px);
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--theme-border);
  background: var(--theme-surface);
  box-shadow:
    0 3px 10px #172c2d25,
    inset 0 1px 0 #ffffff65;
  transition: transform 160ms ease-out;
  will-change: transform;
}
.joystick-thumb i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--theme-muted);
  opacity: 0.5;
}
.is-active .joystick-thumb {
  transition: none;
}
.is-active .joystick-thumb i {
  background: var(--theme-accent);
  opacity: 1;
}
.virtual-joystick:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 4px;
}
.virtual-joystick:disabled {
  opacity: 0.35;
}
@media (max-width: 649px), (hover: none) and (pointer: coarse) {
  .virtual-joystick {
    display: block;
  }
}
@media (max-height: 500px) {
  .virtual-joystick {
    bottom: calc(26px + env(safe-area-inset-bottom));
  }
}
@media (prefers-reduced-motion: reduce) {
  .joystick-thumb {
    transition: none;
  }
}
</style>
