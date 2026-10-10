import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index";
import { mapPostPage, type ApiPostPage } from "@/services/blog-api";
import { BLOG_PAGE_SIZE, blogBootstrapKey, blogSeo, type BlogBootstrap } from "@/utils/blog/page";

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function render(url: string, apiBaseUrl: string, requestFetch = fetch) {
  const location = new URL(url, "https://codeiary.com");
  const seo = blogSeo(location);
  const head = `<meta name="robots" content="${seo.robots}"><link rel="canonical" href="${escapeAttribute(seo.canonical)}">`;
  const result = { head, title: seo.title, robots: seo.robots, html: "", state: "", modules: [] as string[] };
  if (seo.page > 1) return result;

  const endpoint = new URL(`${apiBaseUrl.replace(/\/$/, "")}/posts`);
  endpoint.search = new URLSearchParams({
    page: "0",
    size: String(BLOG_PAGE_SIZE),
    sort: location.searchParams.get("sort") === "likes" ? "LIKES" : "LATEST",
    ...(location.searchParams.get("q") ? { search: location.searchParams.get("q")! } : {}),
    ...(location.searchParams.get("tag") ? { tag: location.searchParams.get("tag")! } : {}),
  }).toString();
  // Public HTML never forwards session cookies or requests private posts.
  const response = await requestFetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Blog API returned ${response.status}`);
  const bootstrap: BlogBootstrap = {
    url: location.pathname + location.search,
    page: mapPostPage(await response.json() as ApiPostPage),
  };
  const router = createAppRouter();
  const app = createSSRApp(App).provide(blogBootstrapKey, bootstrap).use(router);
  await router.push(bootstrap.url);
  await router.isReady();
  const context: { modules?: Set<string> } = {};
  result.html = await renderToString(app, context);
  // Escape '<' so a post title cannot close the JSON script element.
  result.state = `<script id="blog-bootstrap" type="application/json">${JSON.stringify(bootstrap).replace(/</g, "\\u003c")}</script>`;
  result.modules = [...(context.modules ?? [])];
  return result;
}
