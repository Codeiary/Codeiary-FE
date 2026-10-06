<script setup lang="ts">
import { displayName } from "@/utils/profile/display-name";
import { defineAsyncComponent, ref } from "vue";
import Icon from "@/components/Icon.vue";
import CoverImage from "@/components/blog/CoverImage.vue";
import ArticleOutline from "@/components/blog/ArticleOutline.vue";
import type { BlogAuthor, BlogPost } from "@/utils/blog/posts";
import type { SelectedImage } from "@/utils/blog/image-layout";
import type { ArticleHeading } from "@/utils/blog/heading-outline";
import "@/assets/styles/blog.css";

const MarkdownContent = defineAsyncComponent(
  () => import("@/components/blog/MarkdownContent.vue"),
);
withDefaults(
  defineProps<{
    post: Pick<
      BlogPost,
      | "title"
      | "category"
      | "tags"
      | "author"
      | "date"
      | "visibility"
      | "coverImage"
      | "content"
      | "imageLayouts"
    >;
    showHeader?: boolean;
    interactive?: boolean;
    editableImages?: boolean;
    selectedImage?: string;
  }>(),
  { showHeader: true, interactive: true },
);
defineEmits<{
  selectTag: [tag: string];
  selectAuthor: [author: BlogAuthor];
  selectImage: [image: SelectedImage];
}>();
const root = ref<HTMLElement>();
const headings = ref<ArticleHeading[]>([]);
function scrollToHeading(id: string) {
  const heading = Array.from(
    root.value?.querySelectorAll<HTMLElement>(".markdown-content [id]") ?? [],
  ).find((element) => element.id === id);
  if (!heading) return;
  heading.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
</script>

<template>
  <div ref="root" class="post-article">
    <header
      v-if="showHeader"
      class="article-header"
      :class="{ 'article-header-with-cover': post.coverImage }"
    >
      <div
        v-if="post.coverImage"
        class="article-header-cover"
        aria-hidden="true"
      >
        <CoverImage
          :src="post.coverImage"
          :author-id="post.author?.id"
          loading="eager"
        />
      </div>
      <span class="section-kicker">{{ post.category }}</span>
      <span v-if="post.visibility === 'PRIVATE'" class="post-visibility">
        <Icon name="lock" :size="12" />비공개
      </span>
      <h2 class="article-title">{{ post.title }}</h2>
      <div
        v-if="post.tags.length"
        class="blog-tags article-tags"
        role="group"
        aria-label="게시글 태그"
      >
        <component
          :is="interactive ? 'button' : 'span'"
          v-for="tag in post.tags"
          :key="tag"
          class="blog-tag"
          :aria-label="interactive ? `${tag} 태그로 글 찾기` : undefined"
          @click="interactive && $emit('selectTag', tag)"
          >{{ tag }}</component
        >
      </div>
      <div class="article-meta">
        <component
          :is="interactive ? 'button' : 'span'"
          v-if="post.author"
          class="blog-author-link"
          :aria-label="
            interactive
              ? `${displayName(post.author)}의 블로그 보기`
              : undefined
          "
          @click="interactive && $emit('selectAuthor', post.author)"
          >{{ displayName(post.author) }}</component
        >
        <span v-else>작성자 정보 없음</span>
        <span>·</span>{{ post.date }}
      </div>
    </header>
    <div class="post-article-body">
      <MarkdownContent
        v-if="post.content !== undefined"
        :content="post.content"
        :image-layouts="post.imageLayouts"
        :author-id="post.author?.id ?? ''"
        :editable-images="editableImages"
        :selected-image="selectedImage"
        @select-image="$emit('selectImage', $event)"
        @outline="headings = $event"
      />
      <slot v-else />
    </div>
    <ArticleOutline
      v-if="showHeader"
      :headings="headings"
      @navigate="scrollToHeading"
    />
  </div>
</template>

<style>
.post-article {
  position: relative;
  color: var(--theme-text);
}
.post-article .markdown-content :is(h1, h2, h3, h4, h5, h6) {
  scroll-margin-top: 24px;
}
.post-article .article-header .article-title {
  margin: 5px 0 13px;
  font-size: 37px;
  font-weight: 650;
  line-height: 1.5;
  letter-spacing: -1.7px;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.post-article .article-header .article-meta {
  flex-wrap: wrap;
  font-size: var(--font-size-min);
  color: var(--theme-muted);
}
.post-article .article-meta .blog-author-link {
  color: var(--theme-text);
}
.post-article .article-tags .blog-tag {
  display: inline-flex;
  align-items: center;
  line-height: normal;
}
.post-article .post-article-body .markdown-content :is(h1, h2, h3) {
  max-width: none;
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: -0.04em;
  margin: 1.7em 0 0.65em;
}
.post-article .post-article-body .markdown-content h2 {
  font-size: 1.6em;
}
.post-article .post-article-body .markdown-content h3 {
  font-size: 1.25em;
}
.post-article .post-article-body .markdown-content p {
  max-width: none;
  margin: 0 0 1.25em;
  color: var(--theme-text);
  font-size: inherit;
  line-height: inherit;
}
.post-article .post-article-body .markdown-content blockquote {
  border-left: 3px solid var(--theme-accent);
  padding: 14px 22px;
  margin: 1.5em 0;
  background: var(--theme-raised);
  border-radius: 0 8px 8px 0;
  color: var(--theme-text);
  font-size: inherit;
}
.post-article .post-article-body .markdown-content > :first-child {
  margin-top: 0;
}
.post-article .post-article-body .markdown-content > :last-child,
.post-article .post-article-body .markdown-content blockquote p:last-child {
  margin-bottom: 0;
}
@media (max-width: 600px) {
  .post-article .article-header .article-title {
    font-size: 29px;
    letter-spacing: -1.4px;
  }
}
</style>
