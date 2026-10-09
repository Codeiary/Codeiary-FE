<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { auth } from "@/store/auth";

const route = useRoute();
const router = useRouter();
let lastSessionCheck = Date.now();

function checkSession() {
  if (document.visibilityState !== "visible" || Date.now() - lastSessionCheck < 60_000) return;
  lastSessionCheck = Date.now();
  void auth.revalidate();
}

onMounted(() => document.addEventListener("visibilitychange", checkSession));
onBeforeUnmount(() =>
  document.removeEventListener("visibilitychange", checkSession),
);

watch(auth.user, (user) => {
  if (
    !user &&
    (route.meta.requiresAdmin || route.meta.requiresAuth) &&
    !auth.signingOut.value
  ) {
    void router.replace({ name: "login", query: { redirect: route.path } });
  }
});
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <div v-else class="route-loading" role="status">
      페이지를 준비하고 있어요.
    </div>
  </RouterView>
</template>

<style scoped>
.route-loading {
  min-height: 100svh;
  display: grid;
  place-items: center;
  color: var(--theme-muted);
  background: var(--theme-surface);
  font-size: var(--font-size-min);
}
</style>
