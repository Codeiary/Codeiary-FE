<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import Icon from "../components/Icon.vue";
import { places, type Destination } from "./places";
import { layoutLabels, type LabelSize } from "./label-layout";

const props = defineProps<{
  labels: { id: Destination; x: number; y: number; visible: boolean }[];
  near: Destination | null;
  homeName: string;
}>();
defineEmits<{ visit: [id: Destination] }>();
const icons: Record<Destination, string> = {
  blog: "book",
  portfolio: "case",
  news: "news",
  home: "home",
};
const root = ref<HTMLElement>();
const sizes = ref(new Map<string, LabelSize>());
const viewport = ref({ width: 0, height: 0 });
let observer: ResizeObserver | undefined;
const positioned = computed(() =>
  layoutLabels(
    props.labels,
    sizes.value,
    viewport.value.width,
    viewport.value.height,
  ),
);
onMounted(() => {
  if (!root.value) return;
  observer = new ResizeObserver((entries) => {
    const next = new Map(sizes.value);
    for (const entry of entries) {
      if (entry.target === root.value)
        viewport.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
      else {
        const element = entry.target as HTMLElement;
        next.set(element.dataset.place!, {
          width: element.offsetWidth,
          height: element.offsetHeight,
        });
      }
    }
    sizes.value = next;
  });
  observer.observe(root.value);
  observeLabels();
});
function observeLabels() {
  root.value
    ?.querySelectorAll(".building-label")
    .forEach((element) => observer?.observe(element));
}
watch(
  () => props.labels.map((label) => label.id).join(","),
  () => nextTick(observeLabels),
);
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="root" class="building-labels">
    <button
      v-for="label in positioned"
      :key="label.id"
      :data-place="label.id"
      class="building-label"
      :class="[label.id, { nearby: near === label.id }]"
      :style="{
        left: `${label.x}px`,
        top: `${label.y}px`,
        visibility: label.visible && viewport.width > 0 ? 'visible' : 'hidden',
        '--place-color': places[label.id].color,
      }"
      @click="$emit('visit', label.id)"
    >
      <span class="label-icon"
        ><Icon :name="icons[label.id]" :size="18"
      /></span>
      <span class="label-content"
        ><small>{{ places[label.id].english }}</small
        ><strong>{{
          label.id === "home" ? homeName : places[label.id].name
        }}</strong></span
      >
      <Icon name="arrow" :size="14" />
      <span
        class="label-stem"
        :style="{
          left: `${label.stemLeft}px`,
          height: `${label.stemHeight}px`,
          bottom: `${-label.stemHeight - 1}px`,
        }"
      ></span>
    </button>
  </div>
</template>

<style scoped>
.label-content strong {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 600px) {
  .label-content strong {
    max-width: 100px;
  }
}
</style>
