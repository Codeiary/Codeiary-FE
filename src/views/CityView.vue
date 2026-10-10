<script setup lang="ts">
import { displayName } from "@/utils/profile/display-name";
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import Icon from "@/components/Icon.vue";
import SiteHeader from "@/components/SiteHeader.vue";
import ContentActions from "@/components/ContentActions.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { auth } from "@/store/auth";
import type { BlogAuthor, BlogPost } from "@/utils/blog/posts";
import { authorSlug, postSlug } from "@/utils/blog/slug";
import BlogPostList from "@/components/blog/BlogPostList.vue";
import DefaultPostCover from "@/components/blog/DefaultPostCover.vue";
import PostArticle from "@/components/blog/PostArticle.vue";
import PostComments from "@/components/blog/comments/PostComments.vue";
import PostLikeButton from "@/components/blog/PostLikeButton.vue";
import { commentPostKey } from "@/utils/blog/comments";
import { editPost } from "@/services/blog-storage";
import { fetchPost, fetchPosts, fetchPostPage, removePost } from "@/services/blog-api";
import { blogBootstrapKey, blogPageNumber, type BlogPage } from "@/utils/blog/page";
import UserHome from "@/components/profile/UserHome.vue";
import {
  createMockHome,
  homeBlogPosts,
  type HomeProfile,
} from "@/utils/profile/mock-home";
import "@/assets/styles/blog.css";
import "@/assets/styles/content-window.css";
import { useTheme } from "@/composables/useTheme";
import { places, type Destination } from "@/utils/city/places";
import CityLabels from "@/components/city/CityLabels.vue";
import type { CityController, ResidenceAnchor } from "@/utils/city/world";
import { residenceDirectory } from "@/services/mock-neighborhood";
import { HOMES_PER_BLOCK, type Residence } from "@/utils/city/residences";
import { useNeighborhood } from "@/composables/useNeighborhood";
import NeighborhoodControls from "@/components/city/NeighborhoodControls.vue";
import ResidenceLabels from "@/components/city/ResidenceLabels.vue";
import VirtualJoystick from "@/components/city/VirtualJoystick.vue";
import MobileRunButton from "@/components/city/MobileRunButton.vue";

const route = useRoute();
const router = useRouter();
const { user } = auth;
const bootstrap = inject(blogBootstrapKey, undefined);
const initialPage = bootstrap?.url === route.fullPath.split("#")[0] ? bootstrap.page : undefined;
const publicPage = shallowRef<BlogPage | undefined>(initialPage);
const posts = shallowRef<BlogPost[]>(initialPage?.content ?? []);
const discoveredPosts = shallowRef<BlogPost[]>(initialPage?.content ?? []);
const directory = computed(() => residenceDirectory(user.value, discoveredPosts.value));
const neighbors = computed(() =>
  directory.value.filter((resident) => resident.id !== user.value?.id),
);
const neighborhood = useNeighborhood(neighbors);
const {
  page: district,
  pageCount: districtCount,
  visibleBlocks,
  pending: districtLoading,
  error: districtError,
} = neighborhood;
const residenceLabels = shallowRef<ResidenceAnchor[]>([]);
const searchOpen = ref(false);
const visitingResident = computed(() =>
  directory.value.find(
    (resident) => String(resident.id) === route.query.resident,
  ),
);
const ownResidence = computed(() =>
  directory.value.find((resident) => resident.id === user.value?.id),
);
const ownHouseLevel = computed(() => ownResidence.value?.level ?? 0);
const homeProfile = computed<HomeProfile>(() => {
  const resident = visitingResident.value;
  if (!resident || resident.id === user.value?.id)
    return createMockHome(user.value);
  return {
    owner: resident,
    email: resident.email ?? "",
    github: resident.github ?? "",
    projects: [],
    issues: [],
  };
});
const homePosts = computed(() =>
  homeBlogPosts(posts.value, homeProfile.value.owner, user.value?.id),
);
function placeName(id: Destination) {
  return id === "home" ? `${displayName(user.value)}의 집` : places[id].name;
}
const storageError = ref("");
const postsLoading = ref(false);
const postPageCache = new Map<string, { value: BlogPage; at: number }>();
const catalogCache = new Map<string, { value: BlogPost[]; at: number }>();
const CACHE_AGE = 30_000;
function cached<T>(cache: Map<string, { value: T; at: number }>, key: string) {
  const entry = cache.get(key);
  return entry && Date.now() - entry.at < CACHE_AGE ? entry.value : undefined;
}
function cacheResult<T>(cache: Map<string, { value: T; at: number }>, key: string, value: T) {
  cache.delete(key);
  cache.set(key, { value, at: Date.now() });
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
}
function rememberPosts(items: readonly BlogPost[]) {
  const knownIds = new Set(discoveredPosts.value.map((post) => post.id));
  const unseen = items.filter((post) => !knownIds.has(post.id));
  if (unseen.length) discoveredPosts.value = [...discoveredPosts.value, ...unseen];
}
let postsRequest = 0;
async function loadBlogPosts() {
  const request = ++postsRequest;
  const isPublicList = route.name === "blog";
  const isArticle = route.name === "blog-post";
  const needsCatalog = route.name === "user-blog" || route.query.view === "home"
    || (isArticle && !posts.value.some((post) => post.author &&
      authorSlug(post.author.name) === route.params.authorSlug &&
      (post.slug || postSlug(post.title)) === route.params.postSlug));
  if (!isPublicList && !needsCatalog) {
    postsLoading.value = false;
    return;
  }
  storageError.value = "";
  try {
    if (isPublicList) {
      const params = {
        search: search.value,
        tag: selectedTag.value,
        sort: (postSort.value === "likes" ? "LIKES" : "LATEST") as "LIKES" | "LATEST",
        page: blogPage.value - 1,
      };
      const key = JSON.stringify(params);
      const stored = cached(postPageCache, key);
      postsLoading.value = !stored;
      const result = stored ?? await fetchPostPage(params);
      if (request !== postsRequest) return;
      if (!stored) cacheResult(postPageCache, key, result);
      publicPage.value = result;
      posts.value = result.content;
      rememberPosts(result.content);
      return;
    }
    publicPage.value = undefined;
    const params = {
      search: route.query.view === "home" ? "" : search.value,
      category: route.query.view === "home" ? "" : selectedCategory.value,
      tag: route.query.view === "home" ? "" : selectedTag.value,
      sort: (postSort.value === "likes" ? "LIKES" : "LATEST") as "LIKES" | "LATEST",
    };
    const key = JSON.stringify([user.value?.id, params]);
    const stored = cached(catalogCache, key);
    postsLoading.value = !stored;
    const selectedPost = posts.value.find((post) => post.author &&
      authorSlug(post.author.name) === route.params.authorSlug &&
      (post.slug || postSlug(post.title)) === route.params.postSlug);
    let result = stored;
    if (!result) {
      const [publicPosts, ownPosts] = await Promise.all([
        fetchPosts({ ...params, size: 50 }),
        user.value ? fetchPosts({ ...params, mine: true, sort: undefined, size: 50 }) : [],
      ]);
      result = [
        ...ownPosts,
        ...publicPosts.filter((post) => !ownPosts.some((own) => own.id === post.id)),
      ];
    }
    if (request !== postsRequest) return;
    if (!stored) cacheResult(catalogCache, key, result);
    posts.value = selectedPost && !result.some((post) => post.id === selectedPost.id)
      && (selectedPost.visibility !== "PRIVATE" || selectedPost.author?.id === user.value?.id)
      ? [...result, selectedPost] : result;
    rememberPosts(posts.value);
  } catch (error) {
    if (request !== postsRequest) return;
    storageError.value = error instanceof Error ? error.message : "게시글을 불러오지 못했어요.";
    posts.value = [];
  } finally {
    if (request === postsRequest) postsLoading.value = false;
  }
}
const isBlogRoute = computed(() => route.meta.blog === true);
const postSort = computed(() =>
  !route.params.authorSlug && route.query.sort === "likes" ? "likes" : "latest",
);
const search = computed(() =>
  typeof route.query.q === "string" ? route.query.q : "",
);
const blogPage = computed(() => blogPageNumber(route.query.page));
const selectedCategory = computed(() =>
  route.params.authorSlug && typeof route.query.category === "string"
    ? route.query.category
    : "",
);
const selectedTag = computed(() =>
  !route.params.authorSlug && typeof route.query.tag === "string"
    ? route.query.tag
    : "",
);
if (initialPage) cacheResult(postPageCache, JSON.stringify({
  search: search.value,
  tag: selectedTag.value,
  sort: postSort.value === "likes" ? "LIKES" : "LATEST",
  page: blogPage.value - 1,
}), initialPage);
const blogLocations = new Map<string, number>();
const pendingBlogRestores = new Set<string>();
function blogScrollStorageKey(path: string) {
  return `codeiary.blog.scroll.v1:${path}`;
}
function saveBlogScroll(path: string, top: number) {
  blogLocations.set(path, top);
  try {
    sessionStorage.setItem(blogScrollStorageKey(path), String(top));
  } catch {
    // Scroll restoration still works for this view when storage is unavailable.
  }
}
function readBlogScroll(path: string) {
  const cached = blogLocations.get(path);
  if (cached !== undefined) return cached;
  try {
    const saved = sessionStorage.getItem(blogScrollStorageKey(path));
    const top = saved === null ? 0 : Number(saved);
    return Number.isFinite(top) ? top : 0;
  } catch {
    return 0;
  }
}
function rememberBlogScroll(event: Event) {
  if (!isBlogRoute.value) return;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.matches(".window-body, .article-body")
  ) {
    if (target.scrollTop === 0 && pendingBlogRestores.has(route.fullPath)) return;
    saveBlogScroll(route.fullPath, target.scrollTop);
  }
}
const { isDark: night } = useTheme();
const canvas = ref<HTMLCanvasElement>();
const ready = ref(false),
  error = ref(false);
const panel = ref<Destination | null>(null);
const selectedProject = ref<number | null>(null),
  newsSelection = ref<number | null>(null);
const toast = ref("");
const deleteConfirmationOpen = ref(false);
const deleteError = ref("");
const near = ref<Destination | null>(null);
const labels = shallowRef<
  { id: Destination; x: number; y: number; visible: boolean }[]
>([]);
const dialog = ref<HTMLElement>();
let city: CityController | undefined;
let unmounted = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let previousFocus: HTMLElement | null = null;
const CITY_POSITION_KEY = "codeiary.city.position.v1";

function saveCityPosition() {
  if (!city || district.value !== -1) return;
  try {
    if (panel.value) city.returnFromVisit?.();
    const position = city.getPlayerPosition?.();
    if (!position) return;
    localStorage.setItem(
      CITY_POSITION_KEY,
      JSON.stringify(position),
    );
  } catch {
    // The city remains usable when browser storage is unavailable.
  }
}

function restoreCityPosition() {
  if (!city || district.value !== -1) return;
  try {
    const saved = localStorage.getItem(CITY_POSITION_KEY);
    if (!saved) return;
    const position = JSON.parse(saved) as { x?: number; z?: number };
    if (typeof position.x === "number" && typeof position.z === "number")
      city.setPlayerPosition?.({ x: position.x, z: position.z });
  } catch {
    // Ignore an unavailable or malformed saved position.
  }
}

function cityVisibilityChanged() {
  if (document.visibilityState === "hidden") {
    releaseKeys();
    city?.setPaused(true);
  } else if (!panel.value) {
    city?.setPaused(searchOpen.value);
    requestAnimationFrame(restoreCityPosition);
  }
}

const projects = [
  {
    id: 1,
    number: "01",
    title: "Codeiary",
    type: "INTERACTIVE WEB",
    summary: "개발자의 이야기를 탐험하는 3D 블로그.",
    description:
      "웹페이지를 하나의 동네로 재해석한 인터랙티브 개인 블로그입니다. 방향키 이동, 건물 입장, 자동 경로 탐색을 통해 콘텐츠를 만날 수 있습니다.",
    tags: ["Vue 3", "Three.js", "TypeScript"],
    art: "city",
    year: "2026",
  },
  {
    id: 2,
    number: "02",
    title: "Ordinary",
    type: "PRODUCT CONCEPT",
    summary: "평범한 하루를 특별하게 기록하는 공간.",
    description:
      "일상의 작은 순간을 모으는 기록 서비스의 포트폴리오 예시입니다. 간결한 정보 구조와 편안한 색감에 집중한 디자인 콘셉트입니다.",
    tags: ["Product Design", "Web App"],
    art: "ordinary",
    year: "2026",
  },
  {
    id: 3,
    number: "03",
    title: "Layers",
    type: "DESIGN EXPLORATION",
    summary: "아이디어가 쌓이고 연결되는 새로운 방식.",
    description:
      "생각의 연결을 시각적으로 표현하는 인터페이스 실험의 예시입니다. 카드, 레이어, 타이포그래피를 통해 새로운 탐색 방식을 제안합니다.",
    tags: ["Interface", "Creative Coding"],
    art: "layers",
    year: "2026",
  },
];
const newsItems = [
  {
    category: "AI & DEVELOPMENT",
    title: "AI와 함께 코드를 쓴다는 것",
    description: "개발 도구의 변화와 우리가 생각해 볼 질문들.",
    source: "개발 도구 이야기",
    color: "green",
    body: "AI 개발 도구를 활용할 때에도 문제를 정의하고 결과를 검증하는 과정은 중요합니다. 생산성을 높이는 도구와 좋은 제품을 만드는 판단이 어떻게 연결되는지 살펴보는 샘플 콘텐츠입니다.",
  },
  {
    category: "WEB PLATFORM",
    title: "브라우저 안에서 펼쳐지는 3D의 가능성",
    description: "WebGL부터 WebGPU까지, 웹 그래픽의 새로운 장면.",
    source: "웹 그래픽 이야기",
    color: "orange",
    body: "웹 그래픽은 정보를 공간으로 표현하는 새로운 방식을 제공합니다. 이 사이트는 Three.js의 WebGL 렌더러로 도시를 표현합니다. 성능, 접근성, 모바일 조작을 함께 고려하는 것이 핵심입니다.",
  },
  {
    category: "FRONTEND",
    title: "프레임워크보다 오래 남는 기본기",
    description: "변화가 빠른 프론트엔드에서 놓치지 말아야 할 것.",
    source: "프론트엔드 이야기",
    color: "yellow",
    body: "브라우저의 동작 방식, 의미 있는 HTML, CSS 레이아웃, JavaScript의 실행 모델은 다양한 프레임워크를 이해하는 기반이 됩니다. 특정 기술의 순위를 소개하는 기사 대신 기본기에 대한 질문을 담은 예시입니다.",
  },
];
const blogOwner = computed(() => {
  const slug = route.params.authorSlug;
  if (typeof slug !== "string") return null;
  if (
    user.value &&
    (authorSlug(user.value.name) === slug || String(user.value.id) === slug)
  )
    return user.value;
  return (
    posts.value.find(
      (post) =>
        post.author &&
        (authorSlug(post.author.name) === slug ||
          String(post.author.id) === slug),
    )?.author ??
    directory.value.find(
      (resident) =>
        authorSlug(resident.name) === slug || String(resident.id) === slug,
    ) ??
    null
  );
});
const isOwnBlog = computed(() =>
  Boolean(user.value && blogOwner.value?.id === user.value.id),
);
const blogScope = computed(() =>
  !route.params.authorSlug ? "all" : isOwnBlog.value ? "mine" : "author",
);
let initialLoad = true;
watch(
  [() => user.value?.id, () => route.fullPath],
  () => {
    if (import.meta.env.SSR) return;
    if (initialLoad && initialPage) {
      initialLoad = false;
      return;
    }
    initialLoad = false;
    void loadBlogPosts();
  },
  { immediate: true },
);
const blogTitle = computed(() =>
  blogOwner.value
    ? `${displayName(blogOwner.value)}의 블로그`
    : route.params.authorSlug
      ? "블로그"
      : "Blog House",
);
const scopedPosts = computed(() =>
  posts.value.filter((post) => {
    if (blogScope.value === "all")
      return post.status === "PUBLISHED" && post.visibility !== "PRIVATE";
    return (
      blogOwner.value &&
      post.author?.id === blogOwner.value.id &&
      (post.visibility !== "PRIVATE" || isOwnBlog.value) &&
      post.status === "PUBLISHED"
    );
  }),
);
const article = shallowRef<BlogPost | null>(null);
const articleLoading = ref(false);
let articleRequest = 0;
watch(
  () => [
    route.params.authorSlug,
    route.params.postSlug,
    posts.value,
  ],
  async () => {
    const request = ++articleRequest;
    articleLoading.value = false;
    article.value = null;
    if (!route.params.postSlug) return;
    const candidate = scopedPosts.value.find(
      (post) =>
        post.author &&
        (authorSlug(post.author.name) === route.params.authorSlug ||
          String(post.author.id) === route.params.authorSlug) &&
        (post.slug || postSlug(post.title)) === route.params.postSlug,
    );
    if (!candidate) return;
    articleLoading.value = true;
    try {
      const completePost = await fetchPost(candidate.id);
      if (request === articleRequest) article.value = completePost;
    } catch {
      if (request === articleRequest) article.value = candidate;
    } finally {
      if (request === articleRequest) articleLoading.value = false;
    }
  },
  { immediate: true },
);
const canDeleteArticle = computed(() => Boolean(user.value && isOwnBlog.value && article.value?.author?.id === user.value.id));
function refreshLikeSort() {
  postPageCache.clear();
  catalogCache.clear();
  if (route.name === "blog" && postSort.value === "likes") {
    void loadBlogPosts();
  }
}
const blogNotFound = computed(
  () => {
    if (
      !isBlogRoute.value ||
      postsLoading.value ||
      articleLoading.value ||
      storageError.value
    )
      return false;

    return Boolean(route.params.authorSlug) &&
      (!blogOwner.value || (Boolean(route.params.postSlug) && !article.value));
  },
);
function restoreBlogScroll(top = 0, path = route.fullPath) {
  if (top > 0) pendingBlogRestores.add(path);
  nextTick(() => {
    const scroller = dialog.value?.querySelector<HTMLElement>(
      ".window-body, .article-body",
    );
    if (!scroller) return;
    const restoreWhenScrollable = (frame = 0) => {
      if (!scroller.isConnected || route.fullPath !== path) return;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (top <= maxScroll || frame >= 120) {
        scroller.scrollTop = Math.min(top, Math.max(0, maxScroll));
        pendingBlogRestores.delete(path);
        return;
      }
      requestAnimationFrame(() => restoreWhenScrollable(frame + 1));
    };
    restoreWhenScrollable();
  });
}
watch(
  article,
  (post) => {
    if (post && route.params.postSlug)
      restoreBlogScroll(readBlogScroll(route.fullPath), route.fullPath);
  },
  { flush: "post" },
);
function blogRouteTarget(target: Exclude<RouteLocationRaw, string>) {
  return router.push({
    ...target,
    state: {
      blogPrevious:
        isBlogRoute.value || panel.value === "home" ? route.fullPath : null,
    },
  });
}

function openArticle(id: number) {
  const post = scopedPosts.value.find((post) => post.id === id);
  if (!post?.author) {
    notify("작성자 정보를 찾을 수 없어요.");
    return;
  }
  return openPost(post);
}
function openPost(post: BlogPost) {
  if (!post.author) return;
  return blogRouteTarget({
    name: "blog-post",
    params: {
      authorSlug: authorSlug(post.author.name),
      postSlug: post.slug || postSlug(post.title),
    },
  });
}
function selectBlogScope(scope: "all" | "mine") {
  return scope === "mine" && user.value
    ? blogRouteTarget({
        name: "user-blog",
        params: { authorSlug: authorSlug(user.value.name) },
      })
    : blogRouteTarget({ name: "blog", query: {} });
}
function openAuthorBlog(author: BlogAuthor) {
  return blogRouteTarget({
    name: "user-blog",
    params: { authorSlug: authorSlug(author.name) },
  });
}
function updateBlogQuery(
  key: "q" | "category" | "sort" | "tag",
  value: string,
) {
  const query = { ...route.query };
  delete query.page;
  if (value) query[key] = value;
  else delete query[key];
  return router.replace({
    query,
    state: { blogPrevious: router.options.history.state.blogPrevious ?? null },
  });
}
function selectBlogPage(page: number) {
  const query = { ...route.query };
  if (page > 1) query.page = String(page);
  else delete query.page;
  return router.push({
    query,
    state: { blogPrevious: router.options.history.state.blogPrevious ?? null },
  });
}
function selectBlogTag(tag: string) {
  if (!route.params.authorSlug) return updateBlogQuery("tag", tag);
  return blogRouteTarget({ name: "blog", query: tag ? { tag } : {} });
}
const contentAction = computed(() => {
  if (panel.value !== "blog" || !user.value) return undefined;
  if (!isOwnBlog.value) return "blog";
  if (!article.value) return "write";
  return article.value.content !== undefined ? "edit" : undefined;
});
function handleContentAction(action: "write" | "edit" | "blog" | "delete") {
  if (action === "delete") {
    deleteError.value = "";
    deleteConfirmationOpen.value = true;
    return;
  }
  if (action === "write") return startWriting();
  if (action === "edit") return continueEditing();
  return selectBlogScope("mine");
}
async function deleteCurrentPost() {
  const post = article.value;
  const owner = user.value;
  if (!post || !owner || !canDeleteArticle.value) {
    deleteConfirmationOpen.value = false;
    return;
  }
  deleteError.value = "";
  try {
    await removePost(post.id);
    postPageCache.clear();
    catalogCache.clear();
    discoveredPosts.value = discoveredPosts.value.filter((known) => known.id !== post.id);
    deleteConfirmationOpen.value = false;
    await selectBlogScope("mine");
  } catch (error) {
    deleteError.value =
      error instanceof Error
        ? error.message
        : "게시글을 삭제하지 못했어요. 다시 시도해 주세요.";
  }
}
function startWriting(draftId?: string) {
  return router.push({ name: "blog-write", params: { draftId } });
}
async function continueEditing() {
  if (!article.value || !user.value) return;
  try {
    const draft = await editPost(article.value, user.value.id);
    await startWriting(draft.id);
  } catch {
    storageError.value = "편집할 글을 불러오지 못했어요. 다시 시도해 주세요.";
  }
}
watch(
  () => user.value?.id,
  (_userId, previousUserId) => {
    postPageCache.clear();
    catalogCache.clear();
    blogLocations.clear();
    if (!user.value && panel.value === "home" && !visitingResident.value)
      void closePanel();
    if (isBlogRoute.value && previousUserId !== undefined)
      void router.replace({ name: "blog", state: { blogPrevious: null } });
  },
);
watch(
  () => route.fullPath,
  (path, previous) => {
    deleteConfirmationOpen.value = false;
    deleteError.value = "";
    if (previous && router.resolve(previous).meta.blog) {
      const scroller = dialog.value?.querySelector<HTMLElement>(
        ".window-body, .article-body",
      );
      if (!(pendingBlogRestores.has(previous) && scroller?.scrollTop === 0))
        saveBlogScroll(previous, scroller?.scrollTop ?? 0);
    }
    const scrollTop = readBlogScroll(path);
    const view = route.query.view;
    const previousPanel = panel.value;
    const nextPanel = isBlogRoute.value
      ? "blog"
      : view === "portfolio" ||
          view === "news" ||
          (view === "home" && (user.value || visitingResident.value))
        ? view
        : null;
    if (previousPanel && !nextPanel) {
      city?.returnFromVisit?.();
      saveCityPosition();
    }
    if (!previousPanel && nextPanel && typeof document !== "undefined")
      previousFocus = document.activeElement as HTMLElement;
    panel.value = nextPanel;
    selectedProject.value = null;
    newsSelection.value = null;
    if (import.meta.env.SSR) return;
    nextTick(() => {
      if (nextPanel) {
        if (nextPanel !== previousPanel)
          dialog.value?.focus({ preventScroll: true });
        restoreBlogScroll(scrollTop, path);
      } else {
        previousFocus?.focus();
      }
    });
  },
  { immediate: true },
);
const project = computed(() =>
  projects.find((p) => p.id === selectedProject.value),
);
const navItems = computed<
  {
    id: Destination;
    name: string;
    icon: string;
    number: string;
  }[]
>(() => [
  { id: "blog", name: "블로그", icon: "book", number: "01" },
  { id: "portfolio", name: "포트폴리오", icon: "case", number: "02" },
  { id: "news", name: "최근 IT 이슈", icon: "news", number: "03" },
  ...(user.value
    ? [{ id: "home" as const, name: "내 집", icon: "home", number: "04" }]
    : []),
]);
function syncNeighborhood() {
  city?.setNeighborhood(
    visibleBlocks.value,
    neighborhood.residents.value.length,
  );
}
async function requestDistrict(index: number) {
  await neighborhood.ensureBlock(index);
  if (!unmounted) syncNeighborhood();
}
async function moveDistrict(index: number) {
  if (index < 0) {
    district.value = -1;
    syncNeighborhood();
    city?.goToDistrict(-1);
    return;
  }
  if (!(await neighborhood.goToPage(index)) || unmounted) return;
  syncNeighborhood();
  city?.goToDistrict(index);
}
function enterResidence(resident: Residence) {
  return router.push({
    name: "city",
    query: { view: "home", resident: String(resident.id) },
  });
}
async function visitResidence(resident: Residence) {
  await nextTick();
  if (resident.id === user.value?.id) {
    await moveDistrict(-1);
    if (error.value) void openPanel("home");
    else visit("home");
    return;
  }
  const index = neighborhood.residents.value.findIndex(
    (entry) => entry.id === resident.id,
  );
  if (index < 0) return;
  const page = Math.floor(index / HOMES_PER_BLOCK);
  if (district.value !== page) await moveDistrict(page);
  if (error.value) void enterResidence(resident);
  else if (!city?.visitResidence(index))
    notify("집으로 이동하지 못했어요. 잠시 후 다시 시도해 주세요.");
}
watch(visibleBlocks, syncNeighborhood);
watch(neighbors, () => {
  if (district.value >= neighborhood.pageCount.value) {
    void moveDistrict(-1);
    return;
  }
  syncNeighborhood();
});
watch([user, ownHouseLevel], () =>
  city?.setHome(user.value ? ownHouseLevel.value : null),
);
function notify(message: string) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 3500);
}
function visit(id: Destination) {
  if (error.value) {
    openPanel(id);
    return;
  }
  if (!city) return;
  saveCityPosition();
  if (!city.visit(id)) notify("방향키로 입구에 가까이 이동해 주세요.");
}
function openPanel(id: Destination) {
  if (id === "home" && !user.value) return;
  return id === "blog"
    ? blogRouteTarget({ name: "blog", query: {} })
    : router.push({ name: "city", query: { view: id } });
}
function closePanel() {
  return router.push({ name: "city" });
}
function home() {
  closePanel();
  city?.returnFromVisit?.();
  void moveDistrict(-1);
  city?.resetCamera();
  try {
    localStorage.removeItem(CITY_POSITION_KEY);
  } catch {
    // Resetting the map does not depend on browser storage.
  }
}
function keyDown(event: KeyboardEvent) {
  if (searchOpen.value) return;
  if (event.key === "Escape") {
    closePanel();
    return;
  }
  if (panel.value) {
    if (event.key === "Tab" && dialog.value) {
      const focusable = [
        ...dialog.value.querySelectorAll<HTMLElement>(
          'button, a, input, [tabindex="0"]',
        ),
      ].filter(
        (el) =>
          el.offsetParent !== null &&
          el.tabIndex >= 0 &&
          !el.matches(":disabled"),
      );
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.value)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    return;
  }
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement
  )
    return;
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "w",
      "a",
      "s",
      "d",
      "Shift",
    ].includes(event.key)
  ) {
    event.preventDefault();
    canvas.value?.focus({ preventScroll: true });
    city?.setInput(event.key, true);
  }
  if (
    (event.key === "Enter" || event.key.toLowerCase() === "e") &&
    event.target === canvas.value
  ) {
    saveCityPosition();
    city?.interact();
  }
}
function keyUp(event: KeyboardEvent) {
  city?.setInput(event.key, false);
}
function releaseKeys() {
  saveCityPosition();
  city?.setJoystick({ x: 0, z: 0 });
  city?.setRunning(false);
  for (const key of [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "w",
    "a",
    "s",
    "d",
    "Shift",
  ])
    city?.setInput(key, false);
}
watch(night, (value) => city?.setNight(value));
watch([panel, searchOpen], ([value, searching]) =>
  city?.setPaused(Boolean(value) || searching || document.visibilityState === "hidden"),
);
let initializingCity = false;
async function initializeCity() {
  if (city || initializingCity || unmounted || panel.value) return;
  initializingCity = true;
  try {
    const { createCity } = await import("@/utils/city/world");
    if (unmounted || panel.value) return;
    city = createCity(canvas.value!, {
      labels: (p) => {
        labels.value = p;
      },
      enter: openPanel,
      travelling: (id) => notify(`${placeName(id)}으로 이동하는 중이에요`),
      ready: () => {
        ready.value = true;
      },
      near: (id) => {
        near.value = id;
      },
      residenceLabels: (value) => {
        residenceLabels.value = value;
      },
      enterResidence,
      travellingResidence: (resident) =>
        notify(`${displayName(resident)}의 집으로 이동하는 중이에요`),
      requestDistrict,
      districtChanged: (value) => {
        district.value = value;
      },
    });
    city.setPaused(Boolean(panel.value) || document.visibilityState === "hidden");
    city.setNight(night.value);
    city.setHome(user.value ? ownHouseLevel.value : null);
    syncNeighborhood();
    restoreCityPosition();
  } catch (reason) {
    if (unmounted) return;
    error.value = true;
    console.error("3D city initialization failed:", reason);
  } finally {
    initializingCity = false;
  }
}
watch(panel, (value) => {
  if (!value) void initializeCity();
});
onMounted(() => {
  if (bootstrap) bootstrap.url = "";
  if (route.query.access === "denied") notify("관리자만 접근할 수 있어요.");
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", releaseKeys);
  window.addEventListener("pagehide", releaseKeys);
  document.addEventListener("visibilitychange", cityVisibilityChanged);
  if (!panel.value) void initializeCity();
});
onBeforeUnmount(() => {
  unmounted = true;
  saveCityPosition();
  city?.dispose();
  clearTimeout(toastTimer);
  window.removeEventListener("keydown", keyDown);
  window.removeEventListener("keyup", keyUp);
  window.removeEventListener("blur", releaseKeys);
  window.removeEventListener("pagehide", releaseKeys);
  document.removeEventListener("visibilitychange", cityVisibilityChanged);
});
</script>

<template>
  <div class="app-shell" :class="{ 'is-night': night }">
    <SiteHeader
      :items="navItems"
      :inactive="Boolean(panel)"
      @home="home"
      @navigate="openPanel"
    />
    <main
      class="city-board"
      aria-label="Codeiary 3D 도시"
      :inert="Boolean(panel)"
    >
      <canvas
        ref="canvas"
        class="city-canvas"
        tabindex="0"
        aria-label="3D 동네. 방향키 또는 WASD로 이동하고, 건물을 클릭하거나 입구로 걸어가면 콘텐츠가 열립니다."
      ></canvas>
      <h1 class="visually-hidden">Code Diary</h1>
      <CityLabels
        v-if="ready && district < 0"
        :labels="labels"
        :near="near"
        :home-name="placeName('home')"
        @visit="visit"
      />
      <ResidenceLabels
        v-if="ready && district >= 0"
        :labels="residenceLabels"
        @visit="visitResidence"
      />
      <NeighborhoodControls
        :directory="directory"
        :viewer-id="user?.id"
        :page="district"
        :page-count="districtCount"
        :loading="districtLoading > 0"
        :error="districtError"
        @visit="visitResidence"
        @district="moveDistrict"
        @pause="searchOpen = $event"
      />
      <div v-if="error" class="fallback-message">
        <Icon name="map" :size="36" /><strong
          >이야기는 계속 열려 있어요.</strong
        >
        <p>
          3D를 지원하는 브라우저에서 동네를 산책할 수 있습니다.<br />상단 메뉴로
          모든 콘텐츠를 만나보세요.
        </p>
        <button @click="openPanel('blog')">
          블로그 둘러보기 <Icon name="arrow" :size="16" />
        </button>
      </div>
      <div class="world-tools" aria-label="화면 모드">
        <ThemeToggle />
      </div>
      <div class="control-dock">
        <div class="control-item">
          <span class="arrow-key-grid"
            ><kbd>↑</kbd><span><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span></span
          ><span>이동</span>
        </div>
        <div class="control-item optional-control">
          <kbd class="wide-key">shift</kbd><span>달리기</span>
        </div>
        <div class="control-item">
          <kbd class="wide-key">↵</kbd><span>입장</span>
        </div>
      </div>
      <MobileRunButton
        :disabled="!ready || error || Boolean(panel) || searchOpen"
        @change="city?.setRunning($event)"
      />
      <VirtualJoystick
        :disabled="!ready || error || Boolean(panel) || searchOpen"
        @move="city?.setJoystick($event)"
      />
      <Transition name="toast"
        ><div v-if="toast" class="toast-message" role="status">
          <span class="player-dot"></span>{{ toast }}
        </div></Transition
      >
      <div v-if="!ready && !error" class="loading-indicator">
        <span></span> 작은 동네를 짓고 있어요
      </div>
    </main>
    <Transition name="modal"
      ><div
        v-if="panel"
        class="modal-backdrop content-backdrop"
        @click.self="closePanel"
      >
        <section
        ref="dialog"
        class="content-window"
        :class="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="
            panel === 'home'
              ? `${displayName(homeProfile.owner)}의 집`
              : placeName(panel)
          "
          tabindex="-1"
        >
          <SiteHeader
            :items="navItems"
            :active="panel"
            @home="home"
            @navigate="openPanel"
          />
          <ContentActions
            v-if="panel !== 'blog' || article || blogNotFound"
            :action="contentAction"
            :deletable="canDeleteArticle"
            @action="handleContentAction"
          />
          <div
            v-if="deleteConfirmationOpen && canDeleteArticle"
            class="post-delete-confirmation"
            role="alertdialog"
            aria-modal="false"
            aria-labelledby="post-delete-title"
            aria-describedby="post-delete-description"
          >
            <div>
              <h2 id="post-delete-title">게시글을 삭제할까요?</h2>
              <p id="post-delete-description">
                삭제한 글은 복구할 수 없습니다.
              </p>
              <p v-if="deleteError" class="post-delete-error" role="alert">
                {{ deleteError }}
              </p>
            </div>
            <div class="post-delete-confirmation-actions">
              <button
                autofocus
                class="post-delete-cancel"
                @click="deleteConfirmationOpen = false"
              >
                취소
              </button>
              <button class="post-delete-submit" @click="deleteCurrentPost">
                게시글 삭제
              </button>
            </div>
          </div>
          <h2 id="content-panel-title" class="visually-hidden">
            {{
              panel === "blog"
                ? blogTitle
                : panel === "home"
                  ? `${displayName(homeProfile.owner)}의 집`
                  : placeName(panel)
            }}
          </h2>
          <p
            v-if="panel === 'blog' && storageError"
            class="blog-storage-error"
            role="alert"
          >
            {{ storageError }}
          </p>
          <UserHome
            v-if="panel === 'home'"
            :profile="homeProfile"
            :posts="homePosts"
            :own="homeProfile.owner.id === user?.id"
            :post-count="
              visitingResident?.postCount ?? ownResidence?.postCount ?? 0
            "
            :level="visitingResident?.level ?? ownHouseLevel"
            :activity-points="
              visitingResident
                ? visitingResident.activityPoints
                : (ownResidence?.activityPoints ?? null)
            "
            @blog="openAuthorBlog(homeProfile.owner)"
            @post="openPost"
          />
          <template v-else-if="panel === 'blog'">
            <div v-if="blogNotFound" class="window-body blog-body">
              <div class="empty-state blog-empty-state">
                <span class="blog-empty-icon"
                  ><Icon name="book" :size="32"
                /></span>
                <h3>
                  {{
                    route.params.postSlug
                      ? "글을 찾을 수 없어요"
                      : "블로그를 찾을 수 없어요"
                  }}
                </h3>
                <p>주소를 확인하거나 Blog House에서 다른 글을 둘러보세요.</p>
                <button @click="selectBlogScope('all')">
                  Blog House 둘러보기 <Icon name="arrow-right" :size="16" />
                </button>
              </div>
            </div>
            <div
              v-else-if="article"
              class="article-body"
              @scroll.passive="rememberBlogScroll"
            >
              <PostArticle
                :key="article.id"
                :post="article"
                @select-tag="selectBlogTag"
                @select-author="openAuthorBlog"
              >
                <div class="article-illustration">
                  <DefaultPostCover />
                </div>
                <p class="article-lead">{{ article.description }}</p>
                <h3>작은 아이디어에서 시작하기</h3>
                <p>
                  좋은 경험은 거창한 기능보다 작은 질문에서 시작됩니다. 무엇을
                  전달하고 싶은지, 어떤 순간이 기억에 남을지 생각하며 하나씩
                  만들어 봅니다.
                </p>
                <blockquote>
                  코드를 쓰는 일은, 누군가가 머물고 싶은 공간을 만드는 일.
                </blockquote>
                <h3>직접 만들어 보며 배우기</h3>
                <p>
                  이 동네도 그런 실험의 하나입니다. 건물은 콘텐츠가 되고, 길은
                  탐색이 됩니다. 기술과 디자인 사이에서 균형을 찾는 과정에
                  앞으로의 개발 이야기를 차곡차곡 쌓아갈 예정입니다.
                </p>
                <div class="demo-note">
                  메인 페이지 동작을 보여주기 위한 샘플 글입니다. 실제 블로그
                  콘텐츠로 교체할 수 있어요.
                </div>
              </PostArticle>
              <div class="article-like-actions">
                <PostLikeButton
                  :key="`post-like-${article.id}`"
                  :post-id="article.id"
                  :like-count="article.likeCount"
                  :liked-by-me="article.likedByMe"
                  @updated="refreshLikeSort"
                />
              </div>
              <PostComments :key="commentPostKey(article)" :post="article" />
            </div>
            <div
              v-else-if="!route.params.postSlug"
              class="window-body blog-body"
              @scroll.passive="rememberBlogScroll"
            >
              <header class="window-heading blog-list-heading">
                <span class="section-kicker">01 / BLOG HOUSE</span>
                <div v-if="isOwnBlog || contentAction === 'blog'" class="blog-list-heading-actions">
                  <button
                    v-if="isOwnBlog"
                    class="blog-home-button"
                    aria-label="블로그 홈으로 이동"
                    @click="selectBlogScope('all')"
                  >
                    <Icon name="arrow-left" :size="15" />
                    <span>블로그 홈</span>
                  </button>
                  <ContentActions
                    v-else
                    action="blog"
                    @action="handleContentAction"
                  />
                </div>
              </header>
              <BlogPostList
                :posts="scopedPosts"
                :personal="blogScope !== 'all'"
                :own="isOwnBlog"
                :search="search"
                :category="selectedCategory"
                :tag="selectedTag"
                :sort="postSort"
                :page="blogPage"
                :total-pages="route.name === 'blog' ? (publicPage?.totalPages ?? 0) : undefined"
                :loading="postsLoading"
                :error="storageError"
                @update:page="selectBlogPage"
                @update:search="updateBlogQuery('q', $event)"
                @update:category="updateBlogQuery('category', $event)"
                @update:tag="selectBlogTag"
                @update:sort="
                  updateBlogQuery('sort', $event === 'latest' ? '' : $event)
                "
                @open="openArticle"
                @author="openAuthorBlog"
                @like="refreshLikeSort"
                @write="startWriting()"
              >
                <template #actions>
                  <ContentActions
                    :action="contentAction === 'blog' ? undefined : contentAction"
                    @action="handleContentAction"
                  />
                </template>
              </BlogPostList>
            </div>
          </template>
          <template v-else-if="panel === 'portfolio'">
            <div v-if="project" class="article-body">
              <button class="text-back" @click="selectedProject = null">
                ← 프로젝트 목록으로</button
              ><span class="section-kicker"
                >{{ project.type }} / {{ project.year }}</span
              >
              <h2>{{ project.title }}<span>.</span></h2>
              <p class="article-lead">{{ project.summary }}</p>
              <div class="project-art detail-art" :class="project.art">
                <span v-if="project.art === 'city'" class="art-city"
                  ><i></i><i></i><i></i><i></i></span
                ><span v-else class="project-art-word"
                  >{{ project.title }}<span>®</span></span
                >
              </div>
              <h3>About this project</h3>
              <p>{{ project.description }}</p>
              <div class="project-tags">
                <span v-for="tag in project.tags" :key="tag">{{ tag }}</span>
              </div>
              <div class="demo-note">
                {{
                  project.id === 1
                    ? "현재 보고 있는 3D 메인 페이지입니다."
                    : "포트폴리오 레이아웃을 보여주기 위한 콘셉트 프로젝트입니다."
                }}
              </div>
            </div>
            <div v-else class="window-body">
              <div class="window-heading">
                <div>
                  <span class="section-kicker">02 / THE GALLERY</span>
                  <h2>아이디어가 현실이 되는 순간<span>.</span></h2>
                  <p>취향을 담아, 쓰임을 생각하며 만든 것들.</p>
                </div>
                <span class="heading-icon portfolio-icon"
                  ><Icon name="case" :size="32"
                /></span>
              </div>
              <div class="project-list">
                <button
                  v-for="item in projects"
                  :key="item.id"
                  class="project-card"
                  @click="selectedProject = item.id"
                >
                  <div class="project-art" :class="item.art">
                    <span v-if="item.art === 'city'" class="art-city"
                      ><i></i><i></i><i></i><i></i></span
                    ><span v-else class="project-art-word"
                      >{{ item.title }}<span>®</span></span
                    ><small>{{ item.type }}</small>
                  </div>
                  <div class="project-information">
                    <span class="project-number"
                      >{{ item.number }} / {{ item.year }}</span
                    >
                    <h3>{{ item.title }}<Icon name="arrow" :size="24" /></h3>
                    <p>{{ item.summary }}</p>
                    <div class="project-tags">
                      <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
                    </div>
                  </div>
                </button>
              </div>
              <div class="window-footer">
                <span class="demo-label">SELECTED WORK & CONCEPTS</span
                ><span>작은 실험이 다음 프로젝트의 시작이 됩니다.</span>
              </div>
            </div>
          </template>
          <template v-else-if="panel === 'news'">
            <div v-if="newsSelection !== null" class="article-body">
              <button class="text-back" @click="newsSelection = null">
                ← 이슈 목록으로</button
              ><span class="section-kicker"
                >{{ newsItems[newsSelection]!.category }} / SAMPLE ISSUE</span
              >
              <h2>{{ newsItems[newsSelection]!.title }}</h2>
              <p class="article-lead">
                {{ newsItems[newsSelection]!.description }}
              </p>
              <div
                class="news-detail-art"
                :class="newsItems[newsSelection]!.color"
              >
                <Icon
                  :name="
                    newsSelection === 0
                      ? 'spark'
                      : newsSelection === 1
                        ? 'compass'
                        : 'book'
                  "
                  :size="96"
                />
              </div>
              <p>{{ newsItems[newsSelection]!.body }}</p>
              <div class="demo-note">
                IT 이슈 창의 동작을 위한 샘플 콘텐츠입니다. 실시간 뉴스 피드와는
                연결되어 있지 않습니다.
              </div>
            </div>
            <div v-else class="window-body">
              <div class="window-heading">
                <div>
                  <span class="section-kicker">03 / DAILY BYTE</span>
                  <h2>세상은 지금, 업데이트 중<span>.</span></h2>
                  <p>빠르게 변하는 기술 속에서, 눈여겨볼 이야기.</p>
                </div>
                <span class="heading-icon news-icon"
                  ><Icon name="news" :size="32"
                /></span>
              </div>
              <div class="news-feature">
                <span class="news-feature-label">THE CURIOSITY EDIT</span>
                <h3>새로운 기술보다,<br /><em>새로운 질문.</em></h3>
                <p>다음에 만들고 싶은 것은 무엇인가요?</p>
                <span class="news-feature-symbol">✳</span>
              </div>
              <div class="news-list">
                <button
                  v-for="(item, index) in newsItems"
                  :key="item.title"
                  class="news-card"
                  @click="newsSelection = index"
                >
                  <span class="news-number">0{{ index + 1 }}</span>
                  <div>
                    <span class="post-category">{{ item.category }}</span>
                    <h3>{{ item.title }}</h3>
                    <p>{{ item.description }}</p>
                    <small>{{ item.source }}<span>·</span>샘플 이슈</small>
                  </div>
                  <span class="news-arrow"
                    ><Icon name="arrow" :size="20"
                  /></span>
                </button>
              </div>
              <div class="window-footer">
                <span class="demo-label">DEMO CONTENT</span
                ><span>실시간 뉴스 연동 전, 콘텐츠 구성 예시입니다.</span>
              </div>
            </div>
          </template>
        </section>
      </div></Transition
    >
  </div>
</template>
