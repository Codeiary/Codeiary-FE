<script setup lang="ts">
import { displayName } from "@/utils/profile/display-name";
import { computed, nextTick, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";
import EditorIcon from "@/components/blog/EditorIcon.vue";
import PostCard from "@/components/blog/PostCard.vue";
import BlogSearch from "@/components/blog/BlogSearch.vue";
import BlogPagination from "@/components/blog/BlogPagination.vue";
import BlogCategories from "@/components/blog/BlogCategories.vue";
import PortfolioList from "@/components/portfolio/PortfolioList.vue";
import ProfileEditor from "@/components/profile/ProfileEditor.vue";
import { auth } from "@/store/auth";
import type { PortfolioItem } from "@/store/portfolio";
import type { BlogPost } from "@/utils/blog/posts";
import { categoryCounts } from "@/utils/blog/post-collection";
import type { HomeProfile } from "@/utils/profile/home-profile";
import { residenceTier, type HouseLevel } from "@/utils/city/residence-tiers";

const props = withDefaults(defineProps<{
  profile: HomeProfile;
  posts: BlogPost[];
  portfolioItems?: PortfolioItem[];
  portfolioCount?: number | null;
  portfolioCountLoading?: boolean;
  portfolioTotal?: number;
  portfolioPageCount?: number;
  portfolioLoading?: boolean;
  portfolioError?: string;
  own?: boolean;
  postCount?: number;
  level?: HouseLevel;
  activityPoints?: number | null;
}>(), { portfolioItems: () => [], own: true, level: 0, activityPoints: null });
const emit = defineEmits<{
  post: [post: BlogPost];
  portfolio: [item: PortfolioItem];
  write: [kind: "blog" | "portfolio"];
  prefetch: [id: number];
}>();
type Section = "blog" | "portfolio";
const section = defineModel<Section>("tab", { default: "blog" });
const search = defineModel<string>("search", { default: "" });
const page = defineModel<number>("page", { default: 1 });
const category = defineModel<string>("category", { default: "" });
const tabButtons = ref<HTMLButtonElement[]>([]);
const editButton = ref<HTMLButtonElement>();
const editing = ref(false);
const profileDialog = ref<HTMLDialogElement>();
watch(editing, async (open) => {
  if (!open) return profileDialog.value?.close();
  await nextTick();
  profileDialog.value?.showModal();
});
const profileNotice = ref("");
const imageFailed = ref(false);
const editableUser = computed(() => {
  const user = auth.user.value;
  return props.own && user && user.id === props.profile.owner.id && user.role !== "PENDING" ? user : null;
});
const tabs = computed(() => [
  { id: "blog" as const, label: props.own ? "내 블로그" : "블로그", count: props.posts.length },
  { id: "portfolio" as const, label: props.own ? "내 포트폴리오" : "포트폴리오", count: props.portfolioCountLoading ? "…" : props.portfolioCount === null ? "—" : props.portfolioCount ?? props.portfolioTotal ?? (props.portfolioLoading ? "…" : props.portfolioItems.length) },
]);
const query = computed(() => search.value.trim().toLocaleLowerCase("ko-KR"));
const categories = computed(() => categoryCounts(props.posts));
const filteredPosts = computed(() => props.posts.filter((post) =>
  (!category.value || post.category === category.value)
  && [post.title, post.category, ...post.tags].join(" ").toLocaleLowerCase("ko-KR").includes(query.value)));
const filteredPortfolios = computed(() => props.portfolioItems.filter((item) =>
  [item.title, item.summary].join(" ").toLocaleLowerCase("ko-KR").includes(query.value)));
const pageSize = 8;
const total = computed(() => section.value === "blog" ? filteredPosts.value.length : props.portfolioTotal ?? filteredPortfolios.value.length);
const pageCount = computed(() => section.value === "portfolio" && props.portfolioPageCount !== undefined ? Math.max(1, props.portfolioPageCount) : Math.max(1, Math.ceil(total.value / pageSize)));
const visiblePosts = computed(() => filteredPosts.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const visiblePortfolios = computed(() => props.portfolioTotal !== undefined ? props.portfolioItems : filteredPortfolios.value.slice((page.value - 1) * pageSize, page.value * pageSize));
watch(pageCount, (count) => { if (!props.portfolioLoading && page.value > count) page.value = count; });
watch([section, search, category], () => { page.value = 1; });
function selectSection(value: Section) { section.value = value; }
function editProfile() { profileNotice.value = ""; editing.value = true; }
function closeEditor(saved = false) {
  editing.value = false;
  profileNotice.value = saved ? "프로필을 저장했어요." : "";
  nextTick(() => editButton.value?.focus());
}
function navigateTabs(event: KeyboardEvent, index: number) {
  const key = event.key;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
  event.preventDefault();
  const next = key === "Home" ? 0 : key === "End" ? tabs.value.length - 1
    : (index + (key === "ArrowRight" ? 1 : -1) + tabs.value.length) % tabs.value.length;
  selectSection(tabs.value[next]!.id);
  nextTick(() => tabButtons.value[next]?.focus());
}
watch(() => props.profile.owner.id, () => { selectSection("blog"); closeEditor(); });
watch(() => props.profile.profileImageUrl, () => { imageFailed.value = false; });
watch(editableUser, (user) => { if (!user) closeEditor(); });
</script>

<template>
  <div class="window-body user-home">
    <header class="home-heading"><span class="section-kicker">{{ own ? "MY PAGE" : "NEIGHBOR" }}</span></header>
    <div class="home-layout">
      <aside v-if="!own" class="home-profile" aria-label="프로필과 연락처">
        <div class="home-avatar" aria-hidden="true">
          <img v-if="profile.profileImageUrl && !imageFailed" :src="profile.profileImageUrl" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="imageFailed = true" />
          <template v-else>{{ displayName(profile.owner).slice(0, 1) }}</template>
        </div>
        <div class="home-identity">
          <h3>{{ displayName(profile.owner) }}</h3>
          <div v-if="postCount !== undefined" class="home-growth">
            <span>Lv. {{ level }}</span><span>{{ residenceTier(level).name }}</span>
            <span v-if="activityPoints !== null">활동 {{ activityPoints.toLocaleString() }} P</span>
          </div>
        </div>
        <div class="home-profile-actions">
          <div class="home-contacts">
            <a v-if="profile.github" :href="profile.github" target="_blank" rel="noopener noreferrer" class="home-contact" aria-label="GitHub 열기" :title="profile.github"><Icon name="github" :size="18" /></a>
            <a v-if="profile.email" :href="`mailto:${profile.email}`" class="home-contact" aria-label="공개 이메일로 메일 보내기" :title="profile.email"><Icon name="mail" :size="18" /></a>
          </div>
        </div>
      </aside>
      <div class="home-main">
        <header class="home-content-header">
          <div class="home-tabs" role="tablist" :aria-label="`${displayName(profile.owner)}의 콘텐츠`">
          <button v-for="(tab, index) in tabs" :id="`home-tab-${tab.id}`" :key="tab.id" ref="tabButtons" role="tab" :aria-selected="section === tab.id" aria-controls="home-content" :tabindex="section === tab.id ? 0 : -1" @click="selectSection(tab.id)" @keydown="navigateTabs($event, index)">
            {{ tab.label }}<span>{{ tab.count }}</span>
          </button>
          </div>
          <aside v-if="own" class="home-profile home-profile-compact" aria-label="건물과 프로필 설정">
            <span class="home-building-info" :title="`작성한 글 ${postCount ?? posts.length}개`">
              <Icon name="home" :size="16" /><span>Lv. {{ level }}</span><span class="home-building-name">{{ residenceTier(level).name }}</span>
            </span>
            <button v-if="editableUser" ref="editButton" type="button" class="home-edit-profile" aria-controls="home-profile-editor" :aria-label="editing ? '프로필 수정 닫기' : '프로필 수정'" :aria-expanded="editing" @click="editing ? closeEditor() : editProfile()">
              <EditorIcon name="pen" /><span>{{ editing ? "수정 닫기" : "프로필 수정" }}</span>
            </button>
          </aside>
        </header>
        <p v-if="own && profileNotice" class="home-profile-notice" role="status">{{ profileNotice }}</p>
        <dialog v-if="editing && editableUser" ref="profileDialog" class="home-profile-dialog" aria-labelledby="profile-editor-title" @cancel.prevent="closeEditor()">
          <ProfileEditor :user="editableUser" @cancel="closeEditor()" @saved="closeEditor(true)" />
        </dialog>
        <section id="home-content" class="home-content" role="tabpanel" :aria-labelledby="`home-tab-${section}`" tabindex="0">
            <div class="home-content-layout" :class="{ 'home-content-with-categories': section === 'blog' }">
              <BlogCategories v-if="section === 'blog'" :categories="categories" :total="posts.length" :selected="category" @select="category = $event" />
              <div class="home-content-main">
            <div class="home-content-toolbar">
              <BlogSearch v-model="search" :label="section === 'blog' ? '마이페이지 블로그 검색' : '마이페이지 포트폴리오 검색'" :placeholder="section === 'blog' ? '제목, 카테고리, 태그 검색' : '제목 검색'" />
              <button v-if="editableUser" class="home-write" @click="emit('write', section)"><EditorIcon name="pen" />{{ section === 'blog' ? "글쓰기" : "포폴 쓰기" }}</button>
            </div>
            <div v-if="section === 'portfolio' && portfolioLoading" aria-busy="true"></div>
            <p v-else-if="section === 'portfolio' && portfolioError" role="alert">{{ portfolioError }}</p>
            <div v-else-if="section === 'blog' && visiblePosts.length" class="home-posts blog">
              <PostCard v-for="post in visiblePosts" :key="post.id" :post="post" compact @open="emit('post', post)" @prefetch="emit('prefetch', $event)" />
            </div>
            <PortfolioList v-else-if="section === 'portfolio' && visiblePortfolios.length" :items="visiblePortfolios" @select="emit('portfolio', $event)" />
            <div v-else class="home-empty">
              <Icon :name="section === 'blog' ? 'book' : 'case'" :size="26" />
              <p>{{ search ? "검색 결과가 없어요." : section === 'blog' ? "아직 작성한 글이 없어요." : "아직 작성한 포트폴리오가 없어요." }}</p>
            </div>
            <BlogPagination v-if="total" :label="section === 'blog' ? '마이페이지 블로그 페이지' : '마이페이지 포트폴리오 페이지'" :page="page" :page-count="pageCount" @select="page = $event" />
              </div>
            </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-home { color: var(--theme-text); }
.home-heading { margin-bottom: 20px; }
.home-heading .section-kicker { margin: 0; }
.home-layout { display: grid; gap: 28px; margin-bottom: 40px; }
.home-profile { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 16px 20px; border: 1px solid var(--theme-border); border-radius: 12px; }
.home-avatar { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; overflow: hidden; border-radius: 14px; background: var(--theme-raised); color: var(--theme-text); font-size: 20px; font-weight: 600; }
.home-avatar img { width: 100%; height: 100%; object-fit: cover; }
.home-identity { flex: 1; min-width: 0; }
.home-profile h3 { margin: 0; font-size: 18px; line-height: 1.4; overflow-wrap: anywhere; }
.home-growth { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; margin-top: 4px; color: var(--theme-muted); font-size: 12px; }
.home-profile-actions, .home-contacts { display: flex; align-items: center; gap: 6px; }
.home-contact { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 7px; color: var(--theme-muted); text-decoration: none; }
.home-contact:hover, .home-edit-profile:hover { background: var(--theme-raised); color: var(--theme-text); }
.home-edit-profile { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 6px 8px; border-radius: 7px; color: var(--theme-muted); font-size: 13px; white-space: nowrap; }
.home-edit-profile > svg { width: 15px; height: 15px; }
.home-edit-profile:focus-visible, .home-contact:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 2px; }
.home-profile-notice { width: 100%; margin: 0; color: var(--theme-muted); font-size: 13px; }
.home-main { min-width: 0; }
.home-content-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 1px solid var(--theme-border); }
.home-profile-compact { flex-shrink: 0; flex-wrap: nowrap; gap: 14px; padding: 0 0 12px; border: 0; border-radius: 0; }
.home-building-info { display: inline-flex; align-items: center; gap: 7px; color: var(--theme-muted); font-size: 12px; white-space: nowrap; }
.home-profile-notice { margin-top: 12px; }
.home-profile-dialog { position: fixed; inset: 0; width: min(480px, calc(100% - 32px)); max-width: none; max-height: calc(100dvh - 40px); margin: auto; padding: 0; overflow: auto; border: 1px solid var(--theme-border); border-radius: 18px; background: var(--theme-surface); color: var(--theme-text); box-shadow: 0 24px 80px #0003; }
.home-profile-dialog::backdrop { background: #14221b66; }
.home-tabs { display: flex; min-width: 0; gap: 24px; }
.home-tabs button { position: relative; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 2px 12px; color: var(--theme-muted); font-size: 16px; white-space: nowrap; }
.home-tabs button[aria-selected="true"] { color: var(--theme-text); font-weight: 650; }
.home-tabs button[aria-selected="true"]::after { content: ""; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: var(--theme-text); }
.home-tabs button > span { color: var(--theme-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.home-tabs button:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 2px; }
.home-content { margin-top: 20px; outline-offset: 6px; }
.home-content-toolbar { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
.home-content-toolbar > [role="search"] { flex: 1; min-width: 0; }
.home-content-main { min-width: 0; }
.home-content-with-categories { display: grid; grid-template-columns: 176px minmax(0, 1fr); align-items: start; gap: clamp(24px, 3.5vw, 52px); }
.home-write { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; gap: 6px; min-height: 48px; padding: 8px 12px; border-radius: 9px; background: var(--theme-accent); color: #fff; font-size: 14px; font-weight: 600; white-space: nowrap; }
.home-write > svg { width: 16px; height: 16px; }
.home-empty { display: grid; justify-items: center; gap: 16px; padding: 64px 20px; color: var(--theme-muted); text-align: center; }
.home-empty p { margin: 0; font-size: 15px; }
@media (max-width: 760px) {
  .home-content-with-categories { grid-template-columns: minmax(0, 1fr); gap: 20px; }
}
@media (max-width: 600px) {
  .home-profile { gap: 12px; padding: 14px; }
  .home-profile h3 { font-size: 16px; }
  .home-profile-actions { margin-left: auto; }
  .home-layout { gap: 22px; }
  .home-tabs { gap: 18px; overflow-x: auto; }
  .home-tabs button { font-size: 15px; }
  .home-content-header { flex-wrap: wrap; gap: 12px; }
  .home-tabs { flex: 1 0 200px; }
  .home-profile-compact { margin-left: auto; padding: 0 0 12px; gap: 8px; }
  .home-building-name, .home-profile-compact .home-edit-profile > span { display: none; }
  .home-content-toolbar { gap: 8px; }
}
</style>
