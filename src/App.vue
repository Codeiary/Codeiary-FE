<script setup lang="ts">
import { RouterView } from "vue-router";
import { onMounted, onBeforeUnmount, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { auth } from "./auth/session";

const route = useRoute();
const router = useRouter();
function checkSession() {
  if (document.visibilityState === "visible") void auth.revalidate();
}
onMounted(() => document.addEventListener("visibilitychange", checkSession));
onBeforeUnmount(() =>
  document.removeEventListener("visibilitychange", checkSession),
);
watch(auth.user, (user) => {
  if (!user && route.meta.requiresAdmin && !auth.signingOut.value) {
    void router.replace({ name: "login", query: { redirect: "/admin" } });
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
  font-size: 13px;
}
</style>
