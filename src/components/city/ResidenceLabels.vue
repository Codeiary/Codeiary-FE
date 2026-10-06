<script setup lang="ts">
import { displayName } from "@/utils/profile/display-name";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@/components/Icon.vue";
import type { ResidenceAnchor } from "@/utils/city/world";
import type { Residence } from "@/utils/city/residences";
import { layoutLabels } from "@/utils/city/label-layout";
const props = defineProps<{ labels: ResidenceAnchor[] }>();
defineEmits<{ visit: [resident: Residence] }>();
const root = ref<HTMLElement>();
const size = ref({ width: 0, height: 0 });
let observer: ResizeObserver | undefined;
const positioned = computed(() =>
  layoutLabels(
    props.labels.filter((label) => label.visible),
    new Map(
      props.labels.map((label) => [
        label.id,
        size.value.width < 650
          ? { width: 70, height: 20 }
          : { width: 122, height: 39 },
      ]),
    ),
    size.value.width,
    size.value.height,
  ),
);
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry)
      size.value = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
  });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="root" class="residence-label-layer">
    <button
      v-for="label in positioned"
      :key="label.id"
      :style="{ left: `${label.x}px`, top: `${label.y}px` }"
      class="resident-house-label"
      :aria-label="`${displayName(label.resident)}의 집 방문, 레벨 ${label.resident.level}`"
      @click="$emit('visit', label.resident)"
    >
      <span class="resident-house-level">{{ label.resident.level }}</span>
      <strong>{{ displayName(label.resident) }}</strong
      ><Icon name="arrow" :size="12" />
      <i
        :style="{
          left: `${label.stemLeft}px`,
          height: `${Math.min(label.stemHeight, 30)}px`,
        }"
      ></i>
    </button>
  </div>
</template>

<style scoped>
.residence-label-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}
.resident-house-label {
  display: flex;
  align-items: center;
  gap: 6px;
  position: absolute;
  transform: translate(-50%, -100%);
  width: 122px;
  height: 39px;
  padding: 6px 8px;
  border: 1px solid var(--theme-border);
  border-radius: 7px;
  background: var(--theme-surface);
  color: var(--theme-text);
  box-shadow: 0 3px 12px #263c3015;
  pointer-events: auto;
}
.resident-house-label:hover {
  background: var(--theme-raised);
}
.resident-house-level {
  display: grid;
  place-items: center;
  width: 22px;
  height: 25px;
  flex-shrink: 0;
  background: var(--theme-raised);
  color: var(--theme-accent);
  border-radius: 4px;
  font-weight: 650;
  font-size: 12px;
}
.resident-house-label strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 550;
}
.resident-house-label svg {
  margin-left: auto;
  color: var(--theme-muted);
}
.resident-house-label i {
  position: absolute;
  width: 1px;
  top: 100%;
  background: var(--theme-border);
  pointer-events: none;
}
@media (max-width: 649px) {
  .resident-house-label {
    width: 70px;
    height: 20px;
    padding: 2px 4px;
    gap: 3px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--theme-surface) 88%, transparent);
    box-shadow: none;
  }
  .resident-house-label::before {
    content: "";
    position: absolute;
    inset: -3px;
  }
  .resident-house-label strong {
    font-size: var(--city-mobile-label-font-size);
  }
  .resident-house-level {
    width: 11px;
    height: 13px;
    font-size: 7px;
    border-radius: 2px;
  }
  .resident-house-label svg {
    display: none;
  }
}
</style>
