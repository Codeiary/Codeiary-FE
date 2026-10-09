<script setup lang="ts">
import { computed } from "vue";
import Icon from "@/components/Icon.vue";
import EditorIcon from "@/components/blog/EditorIcon.vue";
import BlogCategories from "@/components/blog/BlogCategories.vue";
import BlogSearch from "@/components/blog/BlogSearch.vue";
import BlogPagination from "@/components/blog/BlogPagination.vue";
import PostCard from "@/components/blog/PostCard.vue";
import { categoryCounts, filterPosts } from "@/utils/blog/post-collection";
import type { BlogAuthor, BlogPost } from "@/utils/blog/posts";

const props = defineProps<{
  posts: readonly BlogPost[];
  personal: boolean;
  own: boolean;
  search: string;
  category: string;
  tag: string;
  sort: "latest" | "views";
  page: number;
  totalPages?: number;
  loading?: boolean;
  error?: string;
}>();
defineEmits<{
  "update:search": [value: string];
  "update:category": [value: string];
  "update:tag": [value: string];
  "update:sort": [value: "latest" | "views"];
  "update:page": [value: number];
  open: [id: number];
  author: [author: BlogAuthor];
  write: [];
}>();
// Counts use the visible collection before search/category filtering.
// The caller supplies only posts this visitor is allowed to see.
const categories = computed(() => categoryCounts(props.posts));
const filteredPosts = computed(() =>
  props.totalPages !== undefined ? props.posts : filterPosts(props.posts, {
    search: props.search,
    category: props.personal ? props.category : "",
    tag: props.personal ? "" : props.tag,
    sort: props.personal ? "latest" : props.sort,
  }),
);
const pageSize = 12;
const pageCount = computed(() =>
  Math.max(1, props.totalPages ?? Math.ceil(filteredPosts.value.length / pageSize)),
);
const currentPage = computed(() =>
  props.totalPages !== undefined ? props.page : Math.min(Math.max(1, props.page), pageCount.value),
);
const visiblePosts = computed(() => {
  if (props.totalPages !== undefined) return filteredPosts.value;
  const start = (currentPage.value - 1) * pageSize;
  return filteredPosts.value.slice(start, start + pageSize);
});
</script>

<template>
  <section
    id="blog-posts-panel"
    class="blog-collection"
    :class="{ 'blog-collection-personal': personal }"
    aria-labelledby="content-panel-title"
    :aria-busy="loading"
  >
    <BlogCategories
      v-if="personal"
      :categories="categories"
      :total="posts.length"
      :selected="category"
      @select="$emit('update:category', $event)"
    />
    <div class="blog-collection-main">
      <div class="blog-filter">
        <div class="blog-search-controls">
          <BlogSearch
            :model-value="search"
            @update:model-value="$emit('update:search', $event)"
          />
          <div
            v-if="!personal"
            class="post-sort"
            role="group"
            aria-label="글 정렬"
          >
            <button
              :aria-pressed="sort === 'latest'"
              @click="$emit('update:sort', 'latest')"
            >
              최신순
            </button>
            <button
              :aria-pressed="sort === 'views'"
              @click="$emit('update:sort', 'views')"
            >
              조회순
            </button>
          </div>
        </div>
        <slot name="actions" />
      </div>
      <div class="post-grid">
        <PostCard
          v-for="post in visiblePosts"
          :key="post.id"
          :post="post"
          :compact="personal"
          @open="$emit('open', $event)"
          @author="$emit('author', $event)"
        />
      </div>
      <BlogPagination
        v-if="filteredPosts.length"
        :page="currentPage"
        :page-count="pageCount"
        @select="$emit('update:page', $event)"
      />
      <p v-if="loading && !filteredPosts.length" role="status">게시글을 불러오고 있어요.</p>
      <div v-else-if="!filteredPosts.length && !error" class="empty-state blog-empty-state">
        <span class="blog-empty-icon"><Icon name="book" :size="32" /></span>
        <template v-if="search.trim() || tag || category">
          <h3>찾는 이야기가 아직 없어요</h3>
          <p>
            {{
              tag
                ? `${tag} 태그의 글이 없어요.`
                : search.trim()
                  ? "다른 검색어로 찾아보세요."
                  : "다른 카테고리를 선택해 보세요."
            }}
          </p>
          <button v-if="search" @click="$emit('update:search', '')">
            검색어 초기화 <Icon name="reset" :size="15" />
          </button>
          <button v-else-if="tag" @click="$emit('update:tag', '')">
            태그 초기화 <Icon name="reset" :size="15" />
          </button>
          <button v-else @click="$emit('update:category', '')">
            전체 글 보기
          </button>
        </template>
        <template v-else-if="!personal && page > 1">
          <h3>이 페이지에는 글이 없어요</h3>
          <button @click="$emit('update:page', 1)">첫 페이지로</button>
        </template>
        <template v-else-if="own">
          <h3>아직 작성한 글이 없어요</h3>
          <p>첫 번째 글을 작성해 보세요.</p>
          <button @click="$emit('write')">
            첫 글 작성하기 <EditorIcon name="pen" />
          </button>
        </template>
        <template v-else>
          <h3>아직 공개된 글이 없어요</h3>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.blog-collection {
  min-width: 0;
}
.blog-collection-personal {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  align-items: start;
  gap: clamp(24px, 3.5vw, 52px);
}
.blog-collection-main {
  min-width: 0;
}
.blog-collection-personal .blog-filter {
  margin-bottom: 4px;
}
.blog-collection-personal :deep(.search-input) {
  width: 100%;
  min-height: 44px;
  background: var(--theme-raised);
  border-color: transparent;
  border-radius: 12px;
}
.blog-collection-personal :deep(.search-input input) {
  padding: 12px 0;
  font-size: var(--font-size-min);
}
.blog-collection-personal :deep([role="search"]) {
  flex: 1;
}
.blog-collection-personal .post-grid {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}
@media (max-width: 1000px) and (min-width: 761px) {
  .blog-collection-personal {
    grid-template-columns: 160px minmax(0, 1fr);
    gap: 24px;
  }
  .blog-collection-personal .post-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 760px) {
  .blog-collection-personal {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
  .blog-collection-personal :deep(.search-input) {
    width: 100%;
  }
}
@media (max-width: 600px) {
  .blog-collection-personal .post-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
