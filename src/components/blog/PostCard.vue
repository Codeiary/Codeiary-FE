<script setup lang="ts">
import { displayName } from "@/utils/profile/display-name";
import Icon from "@/components/Icon.vue";
import CoverImage from "@/components/blog/CoverImage.vue";
import DefaultPostCover from "@/components/blog/DefaultPostCover.vue";
import type { BlogAuthor, BlogPost } from "@/utils/blog/posts";

defineProps<{ post: BlogPost; compact?: boolean }>();
defineEmits<{ open: [id: number]; author: [author: BlogAuthor] }>();
</script>

<template>
  <article class="post-card" :class="{ 'post-card-compact': compact }">
    <button
      class="post-open"
      :aria-label="`${post.title} 글 보기`"
      @click="$emit('open', post.id)"
    >
      <div class="post-art">
        <CoverImage :src="post.coverImage" :author-id="post.author?.id">
          <DefaultPostCover />
        </CoverImage>
      </div>
      <div class="post-content">
        <div v-if="!compact" class="post-labels">
          <span v-if="post.visibility === 'PRIVATE'" class="post-visibility"
            ><Icon name="lock" :size="12" />비공개</span
          >
          <span class="post-category">{{ post.category }}</span>
        </div>
        <h3>{{ post.title }}</h3>
        <div v-if="post.tags.length" class="post-card-tags">
          <span v-for="tag in post.tags.slice(0, 3)" :key="tag">#{{ tag }}</span
          ><span v-if="post.tags.length > 3">+{{ post.tags.length - 3 }}</span>
        </div>
        <p>{{ post.description }}</p>
        <div v-if="compact" class="post-row-meta">
          <span>{{ post.category }}</span>
          <time :datetime="post.createdAt">{{ post.date }}</time>
          <span class="post-row-views" :aria-label="`조회 ${post.viewCount}회`">
            <Icon name="eye" :size="12" />{{
              post.viewCount.toLocaleString("ko-KR")
            }}
          </span>
          <span v-if="post.visibility === 'PRIVATE'" class="post-visibility">
            <Icon name="lock" :size="11" />비공개
          </span>
        </div>
      </div>
    </button>
    <div v-if="!compact" class="post-card-details">
      <div class="post-author-line">
        <button
          v-if="post.author"
          class="blog-author-link"
          :aria-label="`${displayName(post.author)}의 블로그 보기`"
          @click="$emit('author', post.author)"
        >
          <span class="author-avatar" aria-hidden="true">{{
            displayName(post.author).slice(0, 1)
          }}</span>
          {{ displayName(post.author) }}<Icon name="arrow-right" :size="13" />
        </button>
        <span v-else class="post-author-unknown">작성자 정보 없음</span>
      </div>
      <div class="post-footer">
        <span>{{ post.date }}</span
        ><span
          ><span class="post-views" :aria-label="`조회 ${post.viewCount}회`"
            ><Icon name="eye" :size="13" />{{
              post.viewCount.toLocaleString("ko-KR")
            }}</span
          ><Icon name="arrow" :size="15"
        /></span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.post-card.post-card-compact {
  border: 0;
  border-bottom: 1px solid var(--theme-border);
  border-radius: 0;
  background: transparent;
  overflow: visible;
  transition: none;
}
.post-card-compact:hover {
  transform: none;
  box-shadow: none;
}
.post-card-compact .post-open {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 128px;
  align-items: center;
  gap: 28px;
  padding: 20px 0;
  border-radius: 8px;
}
.post-card-compact .post-art {
  grid-column: 2;
  grid-row: 1;
  width: 128px;
  height: 88px;
  border-radius: 10px;
}
.post-card-compact .post-content {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  padding: 0;
}
.post-card-compact .post-content h3 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 0;
  margin: 0 0 6px;
  color: var(--theme-text);
  font-size: 17px;
  font-weight: 650;
  line-height: 1.45;
  letter-spacing: -0.4px;
}
.post-card-compact .post-open:hover h3 {
  color: var(--theme-accent);
}
.post-card-compact .post-card-tags {
  gap: 8px;
  margin-bottom: 6px;
  font-size: var(--font-size-min);
}
.post-card-compact .post-content p {
  -webkit-line-clamp: 1;
  min-height: 0;
  margin: 0 0 10px;
  font-size: var(--font-size-min);
  line-height: 1.6;
}
.post-row-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
}
.post-row-views {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.post-row-meta .post-visibility {
  padding: 0;
  background: transparent;
}
@media (max-width: 600px) {
  .post-card-compact .post-open {
    grid-template-columns: minmax(0, 1fr) 76px;
    gap: 16px;
    padding: 18px 0;
  }
  .post-card-compact .post-art {
    width: 76px;
    height: 76px;
    border-radius: 9px;
  }
  .post-card-compact .post-content h3 {
    font-size: var(--mobile-item-title-size, 16px);
  }
  .post-card-compact .post-content p {
    font-size: var(--font-size-min);
  }
  .post-row-meta {
    gap: 5px 10px;
    font-size: var(--font-size-min);
  }
}
</style>
