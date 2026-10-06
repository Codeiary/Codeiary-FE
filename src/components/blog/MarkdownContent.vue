<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { markdownHeadings, renderMarkdown } from "@/utils/blog/markdown";
import type { ArticleHeading } from "@/utils/blog/heading-outline";
import { resolveImages, resolveImageSizes, saveImageSize } from "@/services/blog-storage";
import {
  normalizeImageLayout,
  type ImageLayouts,
  type ImageSizes,
  type SelectedImage,
} from "@/utils/blog/image-layout";
import "katex/dist/katex.min.css";
import "@/assets/styles/markdown.css";
import "@/assets/styles/syntax.css";

const props = defineProps<{
  content: string;
  authorId: number | string;
  imageLayouts?: ImageLayouts;
  editableImages?: boolean;
  selectedImage?: string;
}>();
const emit = defineEmits<{
  selectImage: [image: SelectedImage];
  outline: [headings: ArticleHeading[]];
}>();
watch(
  () => props.content,
  (content) => emit("outline", markdownHeadings(content)),
  { immediate: true },
);
const root = ref<HTMLElement>();
const imageSizes = ref<ImageSizes>({});
const imageError = ref(false);
type LoadedImage = { url: string; width: number; height: number };
const loadedImages = new Map<string, Promise<LoadedImage>>();
let observer: IntersectionObserver | undefined;
watch(
  () => [props.content, props.authorId] as const,
  async ([content, authorId], previous, onCleanup) => {
    let stale = false;
    onCleanup(() => {
      stale = true;
    });
    if (previous?.[1] !== authorId) loadedImages.clear();
    try {
      const sizes = await resolveImageSizes(content, authorId);
      if (!stale && JSON.stringify(sizes) !== JSON.stringify(imageSizes.value))
        imageSizes.value = sizes;
    } catch {
      // Images can still load without saved dimensions.
    }
  },
  { immediate: true },
);
const html = computed(() =>
  renderMarkdown(
    props.content,
    {},
    {
      imageLayouts: props.imageLayouts,
      editableImages: props.editableImages,
      selectedImage: props.selectedImage,
      deferAttachments: true,
      imageSizes: imageSizes.value,
    },
  ),
);
async function hydrateImage(element: HTMLImageElement) {
  const src = element.dataset.attachmentSrc;
  const authorId = props.authorId;
  if (!src) return;
  try {
    let pending = loadedImages.get(src);
    if (!pending) {
      pending = (async () => {
        const images = await resolveImages(src, authorId);
        const url = images[src];
        if (!url) throw new Error("Missing image");
        const decoded = new Image();
        decoded.src = url;
        await decoded.decode();
        const size = {
          width: decoded.naturalWidth,
          height: decoded.naturalHeight,
        };
        if (!imageSizes.value[src])
          void saveImageSize(src, authorId, size).catch(() => {});
        return { url, ...size };
      })();
      loadedImages.set(src, pending);
    }
    const image = await pending;
    if (!root.value?.contains(element) || props.authorId !== authorId) return;
    element.width = image.width;
    element.height = image.height;
    element.src = image.url;
    element.classList.remove("markdown-attachment-pending");
  } catch {
    loadedImages.delete(src);
    if (root.value?.contains(element)) imageError.value = true;
  }
}
function observeImages() {
  observer?.disconnect();
  if (!root.value) return;
  const images = root.value.querySelectorAll<HTMLImageElement>(
    "img[data-attachment-src]",
  );
  if (typeof IntersectionObserver === "undefined") {
    images.forEach((image) => {
      void hydrateImage(image);
    });
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        void hydrateImage(entry.target as HTMLImageElement);
      }
    },
    {
      root: root.value.closest(".writer-preview-scroll, .article-body"),
      rootMargin: "350px 0px",
    },
  );
  images.forEach((image) => observer!.observe(image));
}
watch(html, () => nextTick(observeImages), { flush: "post" });
onMounted(observeImages);
onBeforeUnmount(() => observer?.disconnect());
function selectImage(event: MouseEvent | KeyboardEvent) {
  if (!props.editableImages) return;
  if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key))
    return;
  const target =
    event.target instanceof Element
      ? event.target.closest<HTMLImageElement>("img[data-image-key]")
      : null;
  if (!target?.dataset.imageKey) return;
  event.preventDefault();
  emit("selectImage", {
    key: target.dataset.imageKey,
    alt: target.alt,
    rowSize: Number(target.dataset.imageRowSize) || undefined,
    ...normalizeImageLayout({
      ...props.imageLayouts?.[target.dataset.imageKey],
      width: Number(target.dataset.imageWidth),
      original: target.dataset.imageOriginal === "true",
    }),
  });
}
</script>

<template>
  <div
    ref="root"
    class="markdown-content"
    @click="selectImage"
    @keydown="selectImage"
    v-html="html"
  ></div>
  <p v-if="imageError" class="markdown-image-error" role="status">
    저장된 이미지를 불러오지 못했어요. 새로고침 후 다시 확인해 주세요.
  </p>
</template>
