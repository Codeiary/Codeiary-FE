import { createApp, createSSRApp } from "vue";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index";
import { authGuard } from "@/router/auth-guard";
import { auth } from "@/store/auth";
import { blogBootstrapKey, type BlogBootstrap } from "@/utils/blog/page";
import { updatePageSeo } from "@/utils/blog/seo";
import { initializeTheme } from "@/composables/useTheme";
import "@/assets/styles/app.css";
import "@/assets/styles/admin.css";
import "@/assets/styles/theme.css";

async function start() {
  const state = document.getElementById("blog-bootstrap");
  const bootstrap = state?.textContent ? JSON.parse(state.textContent) as BlogBootstrap : undefined;
  const router = createAppRouter();
  // Hydrate the public HTML before restoring browser-only authentication and theme.
  if (!bootstrap) router.beforeEach(authGuard);
  router.afterEach(updatePageSeo);
  const app = (bootstrap ? createSSRApp : createApp)(App);
  app.provide(blogBootstrapKey, bootstrap).use(router);
  await router.isReady();
  app.mount("#app");
  state?.remove();
  initializeTheme();
  if (bootstrap) {
    router.beforeEach(authGuard);
    void auth.restore();
  }
}

void start();
