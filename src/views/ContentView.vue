<script setup lang="ts">
import { portfolioRoute } from "@/utils/portfolio/routes";
import { homeRoute } from "@/utils/profile/home-route";
import { fetchHomeProfile } from "@/services/profile-api";
import { displayName } from "@/utils/profile/display-name";
import {
  computed,
  defineAsyncComponent,
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
import BlogSearch from "@/components/blog/BlogSearch.vue";
import BlogPagination from "@/components/blog/BlogPagination.vue";
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
import { portfolios, type PortfolioItem } from "@/store/portfolio";
import { fetchPortfolio, fetchPortfolioPage, removePortfolio } from "@/services/portfolio-api";
import PortfolioList from "@/components/portfolio/PortfolioList.vue";
const PortfolioDocument = defineAsyncComponent(() => import("@/components/portfolio/PortfolioDocument.vue"));
const PortfolioPdfButton = defineAsyncComponent(() => import("@/components/portfolio/PortfolioPdfButton.vue"));
const route = useRoute();
const router = useRouter();
const { user } = auth;
function navigationPostId() {
  if (route.name !== "blog-post" && route.name !== "blog-post-legacy") return undefined;
  const routeId = Number(route.params.postId);
  if (Number.isSafeInteger(routeId) && routeId > 0) return routeId;
  const id = router.options.history.state.postId;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? id : undefined;
}
function matchesArticle(post: BlogPost) {
  const id = Number(route.params.postId);
  if (Number.isSafeInteger(id) && id > 0) return post.id === id;
  if (!post.author || (authorSlug(post.author.name) !== route.params.authorSlug && String(post.author.id) !== route.params.authorSlug))
    return false;
  return (post.slug || postSlug(post.title)) === route.params.postSlug;
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
const selectedPortfolio = computed(() => {
  const id = Number(route.params.portfolioId ?? route.query.portfolioId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
});
const portfolioSearch = ref("");
const portfolioPage = ref(1);
const portfolioLoading = ref(false);
const portfolioError = ref("");
const portfolioDetail = shallowRef<PortfolioItem>();
const portfolioListing = shallowRef<Awaited<ReturnType<typeof fetchPortfolioPage>>>();
const homePortfolioListing = shallowRef<Awaited<ReturnType<typeof fetchPortfolioPage>>>();
const homePortfolioLoading = ref(false);
const homePortfolioError = ref("");
function openPortfolio(item: (typeof portfolios.value)[number]) {
  void router.push(portfolioRoute(item));
}
const deleteConfirmationOpen = ref(false);
const deleteDialog = ref<HTMLDialogElement>();
const deleteConfirmationText = ref("");
const deleteError = ref("");
const deletePending = ref(false);
watch(deleteConfirmationOpen, async (open) => {
  if (!open) return deleteDialog.value?.close();
  await nextTick();
  deleteDialog.value?.showModal();
});
const namedHomeProfile = shallowRef<HomeProfile>();
const homeProfileLoading = ref(false);
const homeProfileError = ref("");
const ownNickname = computed(() => typeof route.params.nickname === "string" && route.params.nickname.toLowerCase() === user.value?.nickname?.toLowerCase());
const visitingResident = computed(() => directory.value.find((resident) =>
  route.params.nickname ? resident.id === (ownNickname.value ? user.value?.id : namedHomeProfile.value?.owner.id)
    : String(resident.id) === route.query.resident));
const homeProfile = computed<HomeProfile>(() => {
  if (route.params.nickname) return ownNickname.value ? createHomeProfile(user.value) : namedHomeProfile.value ?? createHomeProfile(null);
  const resident = visitingResident.value;
  if (!resident || resident.id === user.value?.id) return createHomeProfile(user.value);
  return { owner: resident, email: resident.email ?? "", github: resident.github ?? "", profileImageUrl: resident.profileImageUrl };
});
let homeProfileRequest = 0;
watch([() => route.params.nickname, () => user.value?.id, () => user.value?.nickname], async ([nickname, id, ownName], previous) => {
  if (previous?.[2] && previous[1] === id && ownName && ownName !== previous[2]
    && typeof nickname === "string" && nickname.toLowerCase() === String(previous[2]).toLowerCase() && user.value) {
    await router.replace({ ...homeRoute(user.value), query: route.query });
    return;
  }
  const revision = ++homeProfileRequest;
  namedHomeProfile.value = undefined;
  homeProfileError.value = "";
  homeProfileLoading.value = false;
  if (!route.params.nickname || import.meta.env.SSR) return;
  homeProfileLoading.value = true;
  try {
    await auth.restore();
    if (revision !== homeProfileRequest) return;
    const profile = ownNickname.value ? createHomeProfile(user.value) : await fetchHomeProfile(String(route.params.nickname));
    if (revision === homeProfileRequest) namedHomeProfile.value = profile;
  } catch (error) {
    if (revision === homeProfileRequest) homeProfileError.value = error instanceof Error ? error.message : "사용자를 찾을 수 없어요.";
  } finally { if (revision === homeProfileRequest) homeProfileLoading.value = false; }
}, { immediate: true });
const homePosts = computed(() =>
  homeBlogPosts(posts.value, homeProfile.value.owner, user.value?.id),
);
const homePortfolios = computed(() => homePortfolioListing.value?.content ?? []);
const homeTab = computed<"blog" | "portfolio">({
  get: () => route.query.tab === "portfolio" ? "portfolio" : "blog",
  set: (tab) => { void router.replace({ query: { ...route.query, tab: tab === "blog" ? undefined : tab, q: undefined, category: undefined, page: undefined } }); },
});
const homeSearch = computed({
  get: () => typeof route.query.q === "string" ? route.query.q : "",
  set: (q: string) => { void router.replace({ query: { ...route.query, q: q || undefined, page: undefined } }); },
});
const homePage = computed({
  get: () => blogPageNumber(route.query.page),
  set: (page: number) => { void router.replace({ query: { ...route.query, page: page > 1 ? String(page) : undefined } }); },
});
const homeCategory = computed({
  get: () => typeof route.query.category === "string" ? route.query.category : "",
  set: (category: string) => { void router.replace({ query: { ...route.query, category: category || undefined, page: undefined } }); },
});
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
  const isArticle = route.name === "blog-post" || route.name === "blog-post-legacy";
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
    const selectedPost = posts.value.find(matchesArticle);
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
const portfolioPageCount = computed(() => Math.max(1, portfolioListing.value?.totalPages ?? 1));
const visiblePortfolios = computed(() => portfolioListing.value?.content ?? []);
watch(portfolioSearch, () => { portfolioPage.value = 1; });
const portfolio = computed(() => portfolioDetail.value);
let portfolioRequest = 0;
let homePortfolioRequest = 0;
const portfolioMounted = ref(false);
watch([portfolioMounted, section, selectedPortfolio, portfolioPage, portfolioSearch, () => selectedPortfolio.value ? user.value?.id : undefined],
  async () => {
    const revision = ++portfolioRequest;
    portfolioDetail.value = undefined;
    portfolioError.value = "";
    portfolioLoading.value = false;
    if (!portfolioMounted.value || section.value !== "portfolio") return;
    portfolioLoading.value = true;
    try {
      if (selectedPortfolio.value) {
        await auth.restore();
        if (revision !== portfolioRequest) return;
        const item = await fetchPortfolio(selectedPortfolio.value);
        if (revision === portfolioRequest) {
          portfolioDetail.value = item;
          const canonical = portfolioRoute(item);
          if ((route.name === "portfolio" || route.name === "portfolio-detail")
            && (route.name !== "portfolio-detail" || route.params.portfolioSlug !== canonical.params.portfolioSlug)) await router.replace(canonical);
          portfolios.value = [...portfolios.value.filter((cached) => cached.id !== item.id), item];
        }
      } else {
        const page = await fetchPortfolioPage({ page: portfolioPage.value - 1, search: portfolioSearch.value });
        if (revision === portfolioRequest) portfolioListing.value = page;
      }
    } catch (error) {
      if (revision === portfolioRequest) portfolioError.value = error instanceof Error ? error.message : "포트폴리오를 불러오지 못했어요.";
    } finally { if (revision === portfolioRequest) portfolioLoading.value = false; }
  }, { immediate: true });
const homePortfolioCount = ref<number>();
const homePortfolioCountLoading = ref(false);
let homeCountRequest = 0;
watch([portfolioMounted, section, () => homeProfile.value.owner.id, () => user.value?.id], async () => {
  const revision = ++homeCountRequest;
  homePortfolioCount.value = undefined;
  homePortfolioCountLoading.value = false;
  const authorId = homeProfile.value.owner.id;
  if (!portfolioMounted.value || section.value !== "home" || typeof authorId !== "number") return;
  homePortfolioCountLoading.value = true;
  try {
    const page = await fetchPortfolioPage({ mine: authorId === user.value?.id, authorId, size: 1 });
    if (revision === homeCountRequest) homePortfolioCount.value = page.totalElements;
  } catch { /* Keep an unknown count rather than presenting a failed request as zero. */ }
  finally { if (revision === homeCountRequest) homePortfolioCountLoading.value = false; }
}, { immediate: true });
watch([portfolioMounted, section, homeTab, homeSearch, homePage, () => homeProfile.value.owner.id, () => user.value?.id],
  async () => {
    const revision = ++homePortfolioRequest;
    homePortfolioListing.value = undefined;
    homePortfolioError.value = "";
    homePortfolioLoading.value = false;
    if (!portfolioMounted.value || section.value !== "home" || homeTab.value !== "portfolio" || typeof homeProfile.value.owner.id !== "number") return;
    homePortfolioLoading.value = true;
    try {
      const page = await fetchPortfolioPage({ mine: homeProfile.value.owner.id === user.value?.id,
        authorId: Number(homeProfile.value.owner.id), search: homeSearch.value, page: homePage.value - 1, size: 8 });
      if (revision === homePortfolioRequest) homePortfolioListing.value = page;
    } catch (error) {
      if (revision === homePortfolioRequest) homePortfolioError.value = error instanceof Error ? error.message : "포트폴리오를 불러오지 못했어요.";
    } finally { if (revision === homePortfolioRequest) homePortfolioLoading.value = false; }
  }, { immediate: true });
const canManagePortfolio = computed(() => !!user.value && portfolio.value?.author.id === user.value.id);
const publishedPortfolio = computed(() => portfolio.value ? ({
  title: portfolio.value.title,
  category: "",
  tags: [],
  author: portfolio.value.author,
  date: "",
  visibility: portfolio.value.visibility,
  coverImage: portfolio.value.coverImage,
  content: portfolio.value.content,
  imageLayouts: {},
}) : undefined);
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
    route.params.postId,
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
      postId: String(post.id),
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
  if (!isOwnBlog.value) return undefined;
  if (!article.value) return "write";
  return article.value.author?.id === user.value.id && article.value.content !== undefined ? "edit" : undefined;
});
function handleContentAction(action: "write" | "edit" | "delete") {
  if (action === "delete") {
    deleteError.value = "";
    deleteConfirmationText.value = "";
    deleteConfirmationOpen.value = true;
    return;
  }
  if (action === "write") return startWriting();
  if (action === "edit") return continueEditing();
}
async function deleteCurrentPost() {
  const post = article.value;
  const owner = user.value;
  if (!post || !owner || !canDeleteArticle.value) {
    deleteConfirmationOpen.value = false;
    return;
  }
  if (deleteConfirmationText.value !== "삭제") return;
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
    if (!user.value && route.name === "user-home" && !visitingResident.value)
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
  if (!import.meta.env.SSR) restoreBlogScroll(readBlogScroll(path), path);
}, { immediate: true });
onBeforeRouteLeave((_to, from) => { saveCurrentScroll(from.fullPath); });
onBeforeUnmount(() => {
  cancelAnimationFrame(scrollRestoreFrame);
  prefetchedArticle = undefined;
  postsRequest++;
  articleRequest++;
  portfolioRequest++;
  homePortfolioRequest++;
  homeProfileRequest++;
  homeCountRequest++;
});
onMounted(() => {
  portfolioMounted.value = true;
  if (bootstrap) bootstrap.url = "";
  restoreBlogScroll(readBlogScroll(route.fullPath));
});
function writePortfolio(item?: (typeof portfolios.value)[number]) {
  return router.push({ name: "portfolio-write", query: item ? { id: String(item.id) } : {} });
}
function managePortfolio(action: "write" | "edit" | "delete") {
  const item = portfolio.value;
  if (!canManagePortfolio.value || !item) return;
  if (action === "edit") return writePortfolio(item);
  if (action !== "delete") return;
  deleteConfirmationText.value = "";
  deleteError.value = "";
  deleteConfirmationOpen.value = true;
}
async function deleteCurrentPortfolio() {
  const item = portfolio.value;
  if (!item || !canManagePortfolio.value || deleteConfirmationText.value !== "삭제" || deletePending.value) return;
  deletePending.value = true;
  deleteError.value = "";
  try {
    await removePortfolio(item.id);
    portfolios.value = portfolios.value.filter((portfolioItem) => portfolioItem.id !== item.id);
    deleteConfirmationOpen.value = false;
    await router.replace({ name: "portfolio" });
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : "포트폴리오를 삭제하지 못했어요. 다시 시도해 주세요.";
  } finally {
    deletePending.value = false;
  }
}

</script>

<template>
  <div class="app-shell content-page" :class="section">
    <SiteHeader :active="section" />
    <main ref="pageElement" class="content-window" :class="section" aria-labelledby="content-panel-title">
      <ContentActions
        v-if="section !== 'blog' || blogNotFound"
        :action="contentAction"
        :deletable="canDeleteArticle"
        @action="handleContentAction"
      />
      <dialog
        v-if="deleteConfirmationOpen && (section === 'portfolio' ? canManagePortfolio : canDeleteArticle)"
        ref="deleteDialog"
        class="post-delete-confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="post-delete-title"
        aria-describedby="post-delete-description"
        @cancel.prevent="!deletePending && (deleteConfirmationOpen = false)"
      >
        <div>
          <h2 id="post-delete-title">{{ section === 'portfolio' ? '포트폴리오를 삭제할까요?' : '게시글을 삭제할까요?' }}</h2>
          <p id="post-delete-description">
            삭제한 내용은 복구할 수 없습니다.
          </p>
          <p v-if="deleteError" class="post-delete-error" role="alert">
            {{ deleteError }}
          </p>
        </div>
        <label class="post-delete-label" for="post-delete-input">
          확인을 위해 <strong>삭제</strong>를 입력해 주세요.
        </label>
        <input
          id="post-delete-input"
          v-model="deleteConfirmationText"
          :disabled="deletePending"
          class="post-delete-input"
          autocomplete="off"
          spellcheck="false"
          placeholder="삭제"
          autofocus
        />
        <div class="post-delete-confirmation-actions">
          <button
            class="post-delete-cancel"
            :disabled="deletePending"
            @click="deleteConfirmationOpen = false"
          >
            취소
          </button>
          <button class="post-delete-submit" :disabled="deletePending || deleteConfirmationText !== '삭제'" @click="section === 'portfolio' ? deleteCurrentPortfolio() : deleteCurrentPost()">
            삭제
          </button>
        </div>
      </dialog>
      <h2 id="content-panel-title" class="visually-hidden">
        {{
          section === "blog"
            ? blogTitle
            : section === "home"
              ? homeProfile.owner.id === user?.id ? "마이페이지" : `${displayName(homeProfile.owner)}의 집`
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
        v-if="section === 'home' && (route.params.nickname ? (ownNickname || namedHomeProfile) : route.query.resident ? visitingResident : user)"
        :profile="homeProfile"
        :posts="homePosts"
        :portfolio-items="homePortfolios"
        :portfolio-count="homePortfolioCount ?? null"
        :portfolio-count-loading="homePortfolioCountLoading"
        :portfolio-total="homePortfolioListing?.totalElements"
        :portfolio-page-count="homePortfolioListing?.totalPages"
        :portfolio-loading="homePortfolioLoading"
        :portfolio-error="homePortfolioError"
        v-model:tab="homeTab"
        v-model:search="homeSearch"
        v-model:page="homePage"
        v-model:category="homeCategory"
        :own="homeProfile.owner.id === user?.id"
        :post-count="
          visitingResident?.postCount ?? (homeProfile.owner.id === user?.id ? ownResidence?.postCount ?? 0 : 0)
        "
        :level="visitingResident?.level ?? (homeProfile.owner.id === user?.id ? ownHouseLevel : 0)"
        :activity-points="
          visitingResident
            ? visitingResident.activityPoints
            : (homeProfile.owner.id === user?.id ? ownResidence?.activityPoints ?? null : null)
        "
        @portfolio="item => router.push(portfolioRoute(item))"
        @write="kind => kind === 'blog' ? startWriting() : writePortfolio()"
        @post="openPost"
        @prefetch="prefetchArticle"
      />
      <div v-else-if="section === 'home' && homeProfileLoading" class="window-body" aria-busy="true"></div>
      <div v-else-if="section === 'home' && homeProfileError" class="window-body" role="alert">{{ homeProfileError }}</div>
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
            <template #actions>
              <ContentActions
                v-if="contentAction === 'edit'"
                action="edit"
                :deletable="canDeleteArticle"
                @action="handleContentAction"
              />
            </template>
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
          <header class="blog-list-heading">
            <span class="section-kicker">01 / BLOG HOUSE</span>
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
                :action="contentAction"
                @action="handleContentAction"
              />
            </template>
          </BlogPostList>
        </div>
      </template>
      <template v-else-if="section === 'portfolio'">
        <div v-if="portfolioLoading && selectedPortfolio" class="window-body portfolio-view" aria-busy="true"></div>
        <div v-else-if="portfolioError && selectedPortfolio" class="window-body portfolio-view" role="alert">{{ portfolioError }}</div>
        <div v-else-if="selectedPortfolio && portfolio" class="window-body portfolio-view">
              <PortfolioDocument
                v-if="publishedPortfolio"
                :key="portfolio.id"
                :post="publishedPortfolio"
                :default-font="portfolio.defaultFont"
                :title-runs="portfolio.titleRuns"
                :title-align="portfolio.titleAlign"
                :blocks="portfolio.blocks"
              >
                <template #actions>
                  <RouterLink :to="portfolioRoute(portfolio, true)" class="portfolio-fullscreen-link" aria-label="전체 화면 보기" title="전체 화면 보기"><Icon name="eye" :size="18" /></RouterLink>
                  <ContentActions v-if="canManagePortfolio" action="edit" subject="포트폴리오" deletable @action="managePortfolio" />
                  <PortfolioPdfButton v-if="canManagePortfolio" icon-only :post="publishedPortfolio" :default-font="portfolio.defaultFont" :title-runs="portfolio.titleRuns" :title-align="portfolio.titleAlign" :blocks="portfolio.blocks" />
                </template>
              </PortfolioDocument>
        </div>
        <div v-else-if="!selectedPortfolio" class="window-body portfolio-view">
          <header class="blog-list-heading portfolio-list-heading">
            <span class="section-kicker">01 / PORTFOLIO</span>
          </header>

          <div class="portfolio-toolbar">
            <BlogSearch
              :model-value="portfolioSearch"
              placeholder="제목 검색"
              label="포트폴리오 검색"
              @update:model-value="portfolioSearch = $event"
            />
          </div>

          <div v-if="portfolioLoading" aria-busy="true"></div>
          <p v-else-if="portfolioError" role="alert">{{ portfolioError }}</p>
          <PortfolioList v-else-if="visiblePortfolios.length" :items="visiblePortfolios" @select="openPortfolio" />
          <BlogPagination v-if="!portfolioLoading && !portfolioError && portfolioListing?.totalElements" label="포트폴리오 페이지" :page="portfolioPage" :page-count="portfolioPageCount" @select="portfolioPage = $event" />
          <div v-if="!portfolioLoading && !portfolioError && !visiblePortfolios.length" class="content-empty"><Icon name="case" :size="25" /><p>{{ portfolioSearch.trim() ? '검색 결과가 없어요. 다른 검색어로 찾아보세요.' : '아직 공개된 포트폴리오가 없어요.' }}</p></div>
        </div>
      </template>
      <div v-else-if="section === 'news'" class="window-body">
        <header class="blog-list-heading"><span class="section-kicker">03 / IT ISSUE</span></header>
        <div class="content-empty" role="status"><Icon name="news" :size="25" /><p>서비스 준비 중입니다.</p></div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.portfolio-fullscreen-link { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 7px; color: var(--theme-muted); text-decoration: none; }
.portfolio-fullscreen-link:hover { background: var(--theme-raised); color: var(--theme-text); }
</style>
