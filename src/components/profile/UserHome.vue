<script setup lang="ts">
import { displayName } from "@/utils/profile/display-name";
import { computed, nextTick, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";
import PostCard from "@/components/blog/PostCard.vue";
import type { BlogPost } from "@/utils/blog/posts";
import type { HomeEntry, HomeProfile } from "@/utils/profile/mock-home";
import { residenceTier, type HouseLevel } from "@/utils/city/residence-tiers";

const props = withDefaults(
  defineProps<{
    profile: HomeProfile;
    posts: BlogPost[];
    own?: boolean;
    postCount?: number;
    level?: HouseLevel;
    activityPoints?: number | null;
  }>(),
  { own: true, level: 0, activityPoints: null },
);
defineEmits<{ blog: []; post: [post: BlogPost] }>();
type Section = "blog" | "portfolio" | "issues";
const section = ref<Section>("blog");
const selected = ref<HomeEntry>();
const tabButtons = ref<HTMLButtonElement[]>([]);
const tabs = computed(() => [
  {
    id: "blog" as const,
    label: props.own ? "내 블로그" : "블로그",
    count: props.posts.length,
  },
  {
    id: "portfolio" as const,
    label: props.own ? "내 포트폴리오" : "포트폴리오",
    count: props.profile.projects.length,
  },
  {
    id: "issues" as const,
    label: "작성한 IT 이슈",
    count: props.profile.issues.length,
  },
]);
const entries = computed(() =>
  section.value === "portfolio" ? props.profile.projects : props.profile.issues,
);
function selectSection(value: Section) {
  section.value = value;
  selected.value = undefined;
}
function navigateTabs(event: KeyboardEvent, index: number) {
  const key = event.key;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
  event.preventDefault();
  const next =
    key === "Home"
      ? 0
      : key === "End"
        ? tabs.value.length - 1
        : (index + (key === "ArrowRight" ? 1 : -1) + tabs.value.length) %
          tabs.value.length;
  selectSection(tabs.value[next]!.id);
  nextTick(() => tabButtons.value[next]?.focus());
}
watch(
  () => props.profile.owner.id,
  () => selectSection("blog"),
);
</script>

<template>
  <div class="window-body user-home">
    <div class="home-layout">
      <aside class="home-profile" aria-label="프로필과 연락처">
        <div class="home-avatar" aria-hidden="true">
          {{ displayName(profile.owner).slice(0, 1) }}
          <span><Icon name="home" :size="16" /></span>
        </div>
        <h3>{{ displayName(profile.owner) }}</h3>
        <div v-if="postCount !== undefined" class="home-growth">
          <span
            >Lv. {{ level }}<i>{{ residenceTier(level).name }}</i></span
          >
          <small v-if="activityPoints !== null"
            >활동 {{ activityPoints.toLocaleString() }} P</small
          >
        </div>
        <div class="home-contacts">
          <a
            v-if="profile.github"
            :href="profile.github"
            target="_blank"
            rel="noopener noreferrer"
            class="home-contact"
          >
            <Icon name="github" :size="18" />
            <span
              ><small>GitHub</small
              ><span>{{
                profile.github.replace("https://github.com/", "@")
              }}</span></span
            >
            <Icon name="arrow" :size="13" />
          </a>
          <a
            v-if="profile.email"
            :href="`mailto:${profile.email}`"
            class="home-contact"
          >
            <Icon name="mail" :size="18" />
            <span
              ><small>이메일</small><span>{{ profile.email }}</span></span
            >
          </a>
        </div>
      </aside>
      <div class="home-main">
        <div
          class="home-tabs"
          role="tablist"
          :aria-label="`${displayName(profile.owner)}의 콘텐츠`"
        >
          <button
            v-for="(tab, index) in tabs"
            :id="`home-tab-${tab.id}`"
            :key="tab.id"
            ref="tabButtons"
            role="tab"
            :aria-selected="section === tab.id"
            aria-controls="home-content"
            :tabindex="section === tab.id ? 0 : -1"
            @click="selectSection(tab.id)"
            @keydown="navigateTabs($event, index)"
          >
            {{ tab.label }}<span>{{ tab.count }}</span>
          </button>
        </div>
        <section
          id="home-content"
          class="home-content"
          role="tabpanel"
          :aria-labelledby="`home-tab-${section}`"
          tabindex="0"
        >
          <template v-if="section === 'blog'">
            <div class="home-section-action">
              <button @click="$emit('blog')">
                블로그 열기 <Icon name="arrow-right" :size="15" />
              </button>
            </div>
            <div v-if="posts.length" class="home-posts blog">
              <PostCard
                v-for="post in posts.slice(0, 5)"
                :key="post.id"
                :post="post"
                compact
                @open="$emit('post', post)"
              />
            </div>
            <div v-else class="home-empty">
              <Icon name="book" :size="28" />
              <p>아직 작성한 글이 없어요.</p>
              <button @click="$emit('blog')">
                {{ own ? "내 블로그로 이동" : "블로그로 이동" }}
                <Icon name="arrow-right" :size="15" />
              </button>
            </div>
          </template>
          <article v-else-if="selected" class="home-entry-detail">
            <button class="home-detail-back" @click="selected = undefined">
              <Icon name="arrow-left" :size="16" />목록으로
            </button>
            <span class="home-entry-category">{{ selected.category }}</span>
            <h3>{{ selected.title }}</h3>
            <div class="home-entry-tags">
              <span v-for="tag in selected.tags" :key="tag">{{ tag }}</span>
            </div>
            <p v-for="paragraph in selected.paragraphs" :key="paragraph">
              {{ paragraph }}
            </p>
          </article>
          <div v-else class="home-entry-list">
            <button
              v-for="entry in entries"
              :key="entry.id"
              class="home-entry"
              @click="selected = entry"
            >
              <span class="home-entry-icon"
                ><Icon
                  :name="section === 'portfolio' ? 'case' : 'news'"
                  :size="22"
              /></span>
              <span class="home-entry-copy">
                <strong>{{ entry.title }}</strong>
                <span class="home-entry-description">{{
                  entry.description
                }}</span>
                <span class="home-entry-meta"
                  >{{ entry.date
                  }}<span>{{ entry.tags.join(" · ") }}</span></span
                >
              </span>
              <Icon name="chevron" :size="16" />
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-growth {
  margin: 0 0 24px;
}
.home-growth > span {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--font-size-min);
  font-weight: 600;
}
.home-growth i {
  font-size: var(--mobile-item-title-size, 14px);
  font-weight: 400;
  color: var(--theme-muted);
  font-style: normal;
}
.home-growth small {
  font-size: var(--mobile-item-title-size, 13px);
  color: var(--theme-muted);
}
</style>

<style scoped>
.user-home {
  color: var(--theme-text);
}
.home-layout {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  gap: 64px;
  margin: 12px 0 40px;
}
.home-profile {
  align-self: start;
  padding-top: 8px;
}
.home-avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border: 1px solid var(--theme-border);
  border-radius: 24px;
  background: var(--theme-raised);
  color: var(--theme-text);
  font-size: 28px;
  font-weight: 600;
}
.home-avatar > span {
  position: absolute;
  display: grid;
  place-items: center;
  right: -5px;
  bottom: -4px;
  width: 28px;
  height: 28px;
  border: 3px solid var(--theme-surface);
  border-radius: 11px;
  background: var(--theme-accent);
  color: var(--theme-surface);
}
.home-profile h3 {
  margin: 24px 0;
  font-size: 22px;
  line-height: 1.35;
  letter-spacing: -0.6px;
  overflow-wrap: anywhere;
}
.home-contacts {
  display: grid;
  gap: 8px;
}
.home-contact {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  color: var(--theme-muted);
  text-decoration: none;
  border-radius: 8px;
}
.home-contact > svg {
  flex-shrink: 0;
}
.home-contact > span {
  display: grid;
  gap: 4px;
  min-width: 0;
  font-size: var(--font-size-min);
  overflow-wrap: anywhere;
  color: var(--theme-text);
}
.home-contact small {
  font-size: var(--font-size-min);
  color: var(--theme-muted);
}
.home-contact:hover > span {
  color: var(--theme-accent);
}
.home-main {
  min-width: 0;
}
.home-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--theme-raised);
}
.home-tabs button {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-height: 40px;
  padding: 10px 12px;
  border-radius: 9px;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
  white-space: nowrap;
}
.home-tabs button[aria-selected="true"] {
  background: var(--theme-surface);
  color: var(--theme-text);
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
  font-weight: 650;
}
.home-tabs button > span {
  font-size: var(--font-size-min);
  color: var(--theme-muted);
  font-variant-numeric: tabular-nums;
}
.home-content {
  margin-top: 24px;
  outline-offset: 6px;
}
.home-section-action {
  display: flex;
  justify-content: flex-end;
}
.home-section-action button,
.home-empty button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 6px 0;
  color: var(--theme-accent);
  font-size: var(--font-size-min);
}
.home-empty {
  display: grid;
  justify-items: center;
  padding: 64px 20px;
  color: var(--theme-muted);
  text-align: center;
}
.home-empty p {
  margin: 18px 0 10px;
  font-size: var(--font-size-min);
}
.home-entry {
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  padding: 24px 0;
  text-align: left;
  color: var(--theme-text);
  border-bottom: 1px solid var(--theme-border);
}
.home-entry:first-child {
  padding-top: 8px;
}
.home-entry > svg {
  flex-shrink: 0;
  color: var(--theme-muted);
}
.home-entry-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border: 1px solid var(--theme-border);
  border-radius: 14px;
  background: var(--theme-raised);
  color: var(--theme-muted);
}
.home-entry-copy {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 8px;
}
.home-entry-copy strong {
  font-size: var(--mobile-item-title-size, 16px);
  font-weight: 650;
  line-height: 1.5;
  letter-spacing: -0.3px;
}
.home-entry:hover strong {
  color: var(--theme-accent);
}
.home-entry-description {
  color: var(--theme-muted);
  font-size: var(--font-size-min);
  line-height: 1.6;
}
.home-entry-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
  line-height: 1.6;
}
.home-entry-detail {
  padding: 4px 0 32px;
}
.home-detail-back {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 30px;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
}
.home-entry-category {
  color: var(--theme-accent);
  font-size: var(--font-size-min);
}
.home-entry-detail h3 {
  margin: 14px 0 18px;
  font-size: 26px;
  line-height: 1.5;
  letter-spacing: -0.6px;
  overflow-wrap: anywhere;
}
.home-entry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 28px;
}
.home-entry-tags span {
  padding: 5px 10px;
  background: var(--theme-raised);
  border-radius: 6px;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
}
.home-entry-detail p {
  font-size: var(--font-size-min);
  line-height: 1.9;
  margin-bottom: 18px;
}
@media (max-width: 1000px) {
  .home-layout {
    grid-template-columns: 192px minmax(0, 1fr);
    gap: 32px;
  }
}
@media (max-width: 760px) {
  .home-growth {
    grid-column: 1 / -1;
    margin-top: 16px;
  }
  .home-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
    margin-top: 0;
  }
  .home-profile {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    column-gap: 18px;
  }
  .home-avatar {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    font-size: 24px;
  }
  .home-profile h3 {
    margin: 0;
    align-self: center;
    font-size: var(--mobile-section-title-size, 20px);
  }
  .home-contacts {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
    margin-top: 20px;
  }
  .home-contact {
    min-height: 44px;
  }
  .home-tabs {
    gap: 0;
  }
  .home-tabs button {
    padding: 9px 7px;
    gap: 5px;
    font-size: var(--font-size-min);
  }
  .home-entry {
    gap: 12px;
    padding: 20px 0;
  }
  .home-entry-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
  }
  .home-entry-copy strong {
    font-size: var(--font-size-min);
  }
  .home-entry-description {
    font-size: var(--font-size-min);
  }
  .home-entry-detail h3 {
    font-size: var(--mobile-page-title-size, 23px);
  }
}
</style>
