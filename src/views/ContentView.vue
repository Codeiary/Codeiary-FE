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
import { onBeforeRouteLeave, useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import Icon from "@/components/Icon.vue";
import SiteHeader from "@/components/SiteHeader.vue";
import ContentActions from "@/components/ContentActions.vue";
import { auth } from "@/store/auth";
import { takeSavedPost } from "@/store/saved-post";
import { loadMarkdownContent } from "@/utils/blog/markdown-loader";
import type { BlogAuthor, BlogPost } from "@/utils/blog/posts";
import { authorSlug, postSlug } from "@/utils/blog/slug";
import BlogPostList from "@/components/blog/BlogPostList.vue";
import DefaultPostCover from "@/components/blog/DefaultPostCover.vue";
import PostArticle from "@/components/blog/PostArticle.vue";
import PostComments from "@/components/blog/comments/PostComments.vue";
import PostLikeButton from "@/components/blog/PostLikeButton.vue";
import { commentPostKey } from "@/utils/blog/comments";
import { editPost } from "@/services/blog-storage";
import { fetchPost, fetchPosts, fetchPostPage, removePost, type PostLikeState } from "@/services/blog-api";
import { AuthError } from "@/services/auth-api";
import { blogBootstrapKey, blogPageNumber, type BlogPage } from "@/utils/blog/page";
import UserHome from "@/components/profile/UserHome.vue";
import {
  createHomeProfile,
  homeBlogPosts,
  type HomeProfile,
} from "@/utils/profile/home-profile";
import "@/assets/styles/blog.css";
import "@/assets/styles/content-window.css";
import { places, type Destination } from "@/utils/city/places";
import { useResidenceDirectory } from "@/composables/useResidenceDirectory";
const route = useRoute();
const router = useRouter();
const { user } = auth;
function navigationPostId() {
  const id = router.options.history.state.postId;
  return route.name === "blog-post" && typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? id : undefined;
}
function matchesArticle(post: BlogPost) {
  return post.author &&
    (authorSlug(post.author.name) === route.params.authorSlug || String(post.author.id) === route.params.authorSlug) &&
    (post.slug || postSlug(post.title)) === route.params.postSlug;
}
let savedArticle = import.meta.env.SSR ? undefined : takeSavedPost(navigationPostId(), user.value?.id);
if (savedArticle && !matchesArticle(savedArticle)) savedArticle = undefined;
const article = shallowRef<BlogPost | null>(null);
const articleLoading = ref(false);
// Keep only the intended next public article, scoped to the current account.
let prefetchedArticle: {
  id: number;
  userId: number | undefined;
  at: number;
  result: Promise<BlogPost>;
} | undefined;
function prefetchArticle(id: number) {
  void loadMarkdownContent().catch(() => {});
  const post = posts.value.find((post) => post.id === id);
  if (!post?.author || post.visibility === "PRIVATE") return;
  if (prefetchedArticle?.id === id && prefetchedArticle.userId === user.value?.id
    && Date.now() - prefetchedArticle.at < 30_000) return;
  const result = fetchPost(id);
  prefetchedArticle = { id, userId: user.value?.id, at: Date.now(), result };
  // Ignore speculative failures so opening the article can try again.
  void result.catch(() => {
    if (prefetchedArticle?.result === result) prefetchedArticle = undefined;
  });
}
const bootstrap = inject(blogBootstrapKey, undefined);
const initialPage = bootstrap?.url === route.fullPath.split("#")[0] ? bootstrap.page : undefined;
const publicPage = shallowRef<BlogPage | undefined>(initialPage);
const posts = shallowRef<BlogPost[]>(savedArticle ? [savedArticle] : initialPage?.content ?? []);
const discoveredPosts = shallowRef<BlogPost[]>(initialPage?.content ?? []);
const section = computed(() => route.meta.section as Destination);
const { directory, ownResidence, ownHouseLevel, loaded: residentsLoaded } = useResidenceDirectory(
  discoveredPosts,
  computed(() => section.value === "home" || route.name === "user-blog"),
);
const pageElement = ref<HTMLElement>();
const selectedProject = ref<number | null>(null);
const newsSelection = ref<number | null>(null);
const deleteConfirmationOpen = ref(false);
const deleteError = ref("");
const visitingResident = computed(() =>
  directory.value.find(
    (resident) => String(resident.id) === route.query.resident,
  ),
);
const homeProfile = computed<HomeProfile>(() => {
  const resident = visitingResident.value;
  if (!resident || resident.id === user.value?.id)
    return createHomeProfile(user.value);
  return {
    owner: resident,
    email: resident.email ?? "",
    github: resident.github ?? "",
    profileImageUrl: resident.profileImageUrl,
    projects: [],
    issues: [],
  };
});
const homePosts = computed(() =>
  homeBlogPosts(posts.value, homeProfile.value.owner, user.value?.id),
);
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
  const needsCatalog = route.name === "user-blog" || section.value === "home"
    || (isArticle && !navigationPostId() && !posts.value.some(matchesArticle));
  storageError.value = "";
  if (!isPublicList && !needsCatalog) {
    postsLoading.value = false;
    return;
  }
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
      search: section.value === "home" ? "" : search.value,
      category: section.value === "home" ? "" : selectedCategory.value,
      tag: section.value === "home" ? "" : selectedTag.value,
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
    (article.value && matchesArticle(article.value) ? article.value.author : null) ??
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
let articleRequest = 0;
watch(
  () => [
    route.params.authorSlug,
    route.params.postSlug,
    posts.value,
    user.value?.id,
  ],
  async () => {
    const request = ++articleRequest;
    articleLoading.value = false;
    article.value = null;
    if (!route.params.postSlug) return;
    // Fetch the renderer alongside the API, not after the body has arrived.
    void loadMarkdownContent().catch(() => {});
    const candidate = scopedPosts.value.find(matchesArticle);
    const id = navigationPostId() ?? candidate?.id;
    if (!id) return;
    if (savedArticle?.id === id && matchesArticle(savedArticle)) {
      article.value = savedArticle;
      savedArticle = undefined;
      return;
    }
    articleLoading.value = true;
    try {
      const pending = prefetchedArticle;
      prefetchedArticle = undefined;
      const completePost = await (pending?.id === id && pending.userId === user.value?.id
        && Date.now() - pending.at < 30_000 ? pending.result : fetchPost(id));
      if (request === articleRequest && matchesArticle(completePost)) article.value = completePost;
    } catch (error) {
      if (request === articleRequest && !(error instanceof AuthError && error.status === 404)) {
        storageError.value = error instanceof Error ? error.message : "게시글을 불러오지 못했어요.";
      }
    } finally {
      if (request === articleRequest) articleLoading.value = false;
    }
  },
  { immediate: true },
);
const canDeleteArticle = computed(() => Boolean(user.value && isOwnBlog.value && article.value?.author?.id === user.value.id));
function refreshLikeSort(likes?: PostLikeState) {
  if (article.value && likes) article.value = { ...article.value, ...likes };
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
let scrollRestoreFrame = 0;
function restoreBlogScroll(top = 0, path = route.fullPath) {
  cancelAnimationFrame(scrollRestoreFrame);
  if (top > 0) pendingBlogRestores.add(path);
  nextTick(() => {
    const scroller = pageElement.value?.querySelector<HTMLElement>(
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
      scrollRestoreFrame = requestAnimationFrame(() => restoreWhenScrollable(frame + 1));
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
      ...target.state,
      blogPrevious:
        isBlogRoute.value || section.value === "home" ? route.fullPath : null,
    },
  });
}

function openArticle(id: number) {
  const post = scopedPosts.value.find((post) => post.id === id);
  if (!post?.author) {
    storageError.value = "작성자 정보를 찾을 수 없어요.";
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
    state: { postId: post.id },
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
  if (section.value !== "blog" || !user.value) return undefined;
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
    prefetchedArticle = undefined;
    postPageCache.clear();
    catalogCache.clear();
    blogLocations.clear();
    if (!user.value && section.value === "home" && !visitingResident.value)
      void router.replace({ name: "city" });
    if (isBlogRoute.value && previousUserId !== undefined)
      void router.replace({ name: "blog", state: { blogPrevious: null } });
  },
);
function saveCurrentScroll(path: string) {
  if (!router.resolve(path).meta.blog) return;
  const scroller = pageElement.value?.querySelector<HTMLElement>(".window-body, .article-body");
  if (scroller && !(pendingBlogRestores.has(path) && scroller.scrollTop === 0))
    saveBlogScroll(path, scroller.scrollTop);
}
watch(() => route.fullPath, (path, previous) => {
  if (previous) saveCurrentScroll(previous);
  deleteConfirmationOpen.value = false;
  deleteError.value = "";
  selectedProject.value = null;
  newsSelection.value = null;
  if (!import.meta.env.SSR) restoreBlogScroll(readBlogScroll(path), path);
}, { immediate: true });
onBeforeRouteLeave((_to, from) => { saveCurrentScroll(from.fullPath); });
onBeforeUnmount(() => {
  cancelAnimationFrame(scrollRestoreFrame);
  prefetchedArticle = undefined;
  postsRequest++;
  articleRequest++;
});
onMounted(() => {
  if (bootstrap) bootstrap.url = "";
  restoreBlogScroll(readBlogScroll(route.fullPath));
});
const project = computed(() => projects.find((p) => p.id === selectedProject.value));
</script>

<template>
  <div class="app-shell content-page" :class="section">
    <SiteHeader :active="section" />
    <main ref="pageElement" class="content-window" :class="section" aria-labelledby="content-panel-title">
      <ContentActions
        v-if="section !== 'blog' || article || blogNotFound"
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
          section === "blog"
            ? blogTitle
            : section === "home"
              ? `${displayName(homeProfile.owner)}의 집`
              : places[section].name
        }}
      </h2>
      <p
        v-if="section === 'blog' && storageError"
        class="blog-storage-error"
        role="alert"
      >
        {{ storageError }}
      </p>
      <UserHome
        v-if="section === 'home' && (route.query.resident ? visitingResident : user)"
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
        @prefetch="prefetchArticle"
      />
      <div v-else-if="section === 'home' && residentsLoaded" class="window-body">
        <div class="empty-state">
          <h3>집을 찾을 수 없어요</h3>
          <p>주소를 확인해 주세요.</p>
        </div>
      </div>
      <template v-else-if="section === 'blog'">
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
          <div v-if="article.visibility !== 'PRIVATE'" class="article-like-actions">
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
            @prefetch="prefetchArticle"
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
      <template v-else-if="section === 'portfolio'">
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
      <template v-else-if="section === 'news'">
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
    </main>
  </div>
</template>
