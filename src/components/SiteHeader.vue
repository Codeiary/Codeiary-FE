<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import BrandLogo from "@/components/BrandLogo.vue";
import AccountActions from "@/components/AccountActions.vue";
import Icon from "@/components/Icon.vue";
import type { Destination } from "@/utils/city/places";
import { auth } from "@/store/auth";
import { clearCityState } from "@/store/city";

const props = defineProps<{
  active?: Destination | null;
}>();
const emit = defineEmits<{
  home: [];
}>();
const route = useRoute();
const router = useRouter();
const items: { id: Destination; name: string }[] = [
  { id: "blog", name: "블로그" },
  { id: "portfolio", name: "포트폴리오" },
  { id: "news", name: "최근 IT 이슈" },
];
const navigationId = `site-navigation-${useId()}`;
const menuOpen = ref(false);
const menuButton = ref<HTMLButtonElement>();
const header = ref<HTMLElement>();
const navigation = ref<HTMLElement>();
async function toggleMenu() {
  menuOpen.value = !menuOpen.value;
  if (menuOpen.value) {
    await nextTick();
    navigation.value?.querySelector("button")?.focus();
  }
}
function closeMenu() {
  menuOpen.value = false;
  menuButton.value?.focus();
}
function navigate(id: Destination) {
  menuOpen.value = false;
  void router.push({ name: id === "home" ? "user-home" : id });
}
function goHome() {
  menuOpen.value = false;
  clearCityState();
  emit("home");
  void router.push({ name: "city" });
}
function handleEscape(event: KeyboardEvent) {
  if (!menuOpen.value) return;
  event.stopPropagation();
  closeMenu();
}
function handleOutside(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (!header.value?.contains(target)) menuOpen.value = false;
}
function handleFocusOut(event: FocusEvent) {
  const target = event.relatedTarget;
  if (!(target instanceof Node)) return;
  if (!header.value?.contains(target)) menuOpen.value = false;
}
onMounted(() => document.addEventListener("pointerdown", handleOutside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", handleOutside));
watch(
  () => route.fullPath,
  () => { menuOpen.value = false; },
);
</script>

<template>
  <header
    ref="header"
    class="site-header"
    @keydown.esc="handleEscape"
    @focusout="handleFocusOut"
  >
    <button class="brand" aria-label="Codeiary 홈으로" @click="goHome">
      <BrandLogo />
    </button>
    <nav class="site-primary-navigation" aria-label="메인 메뉴">
      <button
        v-for="item in items"
        :key="item.id"
        :class="{ active: props.active === item.id }"
        :aria-current="props.active === item.id ? 'page' : undefined"
        @click="navigate(item.id)"
      >{{ item.name }}</button>
    </nav>
    <nav ref="navigation" :id="navigationId" class="site-menu-panel" aria-label="전체 메뉴" :class="{ 'is-open': menuOpen }">
      <button
        v-for="item in items"
        :key="item.id"
        :class="{ active: props.active === item.id }"
        :aria-current="props.active === item.id ? 'page' : undefined"
        @click="navigate(item.id)"
      >
        {{ item.name }}
      </button>
    </nav>
    <div class="site-header-actions">
      <div class="header-right">
        <RouterLink v-if="auth.user.value" :to="{ name: 'user-home' }" class="mypage-link" aria-label="마이페이지" title="마이페이지">
          <Icon name="home" :size="22" />
        </RouterLink>
        <AccountActions compact />
      </div>
      <button
        ref="menuButton"
        class="site-menu-toggle"
        :aria-label="menuOpen ? '메뉴 닫기' : '메뉴 열기'"
        :aria-expanded="menuOpen"
        :aria-controls="navigationId"
        @click="toggleMenu"
      >
        <Icon :name="menuOpen ? 'close' : 'menu'" :size="22" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.header-right { gap: 8px; }
.mypage-link { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border-radius: 8px; color: var(--theme-text); text-decoration: none; }
.mypage-link:hover { background: var(--theme-raised); }
.mypage-link:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 2px; }
</style>
