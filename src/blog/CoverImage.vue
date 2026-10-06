<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { resolveImages } from "./storage";

const props = withDefaults(
  defineProps<{
    src?: string;
    authorId?: number | string;
    alt?: string;
    loading?: "lazy" | "eager";
  }>(),
  { alt: "", loading: "lazy" },
);
const imageUrl = ref("");
const root = ref<HTMLElement>();
const visible = ref(props.loading === "eager");
let observer: IntersectionObserver | undefined;
onMounted(() => {
  if (visible.value) return;
  if (typeof IntersectionObserver === "undefined") {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        visible.value = true;
        observer?.disconnect();
      }
    },
    {
      root: root.value?.closest(".blog-body, .article-body") ?? null,
      rootMargin: "350px 0px",
    },
  );
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

watch(
  () =>
    [
      props.src,
      props.authorId,
      visible.value || props.loading === "eager",
    ] as const,
  async ([src, authorId, shouldLoad], _previous, onCleanup) => {
    let stale = false;
    onCleanup(() => {
      stale = true;
    });
    imageUrl.value = "";
    if (!src || authorId === undefined || !shouldLoad) return;
    try {
      const images = await resolveImages(src, authorId);
      if (!stale) imageUrl.value = images[src] ?? "";
    } catch {
      // Keep the placeholder visible if browser storage is unavailable.
    }
  },
  { immediate: true },
);
</script>

<template>
  <div ref="root" class="blog-cover-frame">
    <img
      v-if="imageUrl"
      class="blog-cover-image"
      :src="imageUrl"
      :alt="alt"
      :loading="loading"
      decoding="async"
      @error="imageUrl = ''"
    />
    <slot v-else />
  </div>
</template>

<style scoped>
.blog-cover-frame {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.blog-cover-image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: cover;
}
</style>
