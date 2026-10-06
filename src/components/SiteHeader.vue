<script setup lang="ts">
import { ref, useId, watch } from "vue";
import { useRoute } from "vue-router";
import BrandLogo from "./BrandLogo.vue";
import AccountActions from "./AccountActions.vue";
import Icon from "./Icon.vue";
import type { Destination } from "../city/places";

const props = defineProps<{
  items: readonly { id: Destination; name: string }[];
  active?: Destination | null;
  inactive?: boolean;
}>();
const emit = defineEmits<{
  navigate: [id: Destination];
  home: [];
  close: [];
}>();
const route = useRoute();
const navigationId = `site-navigation-${useId()}`;
const menuOpen = ref(false);
const menuButton = ref<HTMLButtonElement>();
function closeMenu() {
  menuOpen.value = false;
  menuButton.value?.focus();
}
function navigate(id: Destination) {
  menuOpen.value = false;
  emit("navigate", id);
}
function goHome() {
  menuOpen.value = false;
  emit("home");
}
function handleEscape(event: KeyboardEvent) {
  if (!menuOpen.value) return;
  event.stopPropagation();
  closeMenu();
}
watch(
  () => route.fullPath,
  () => { menuOpen.value = false; },
);
</script>

<template>
  <header
    class="site-header"
    :class="{ 'site-header-content': Boolean(props.active) }"
    :inert="inactive"
    @keydown.esc="handleEscape"
  >
    <button class="brand" aria-label="Codeiary 홈으로" @click="goHome">
      <BrandLogo />
    </button>
    <nav :id="navigationId" aria-label="메인 메뉴" :class="{ 'is-open': menuOpen }">
      <button
        v-for="item in items"
        :key="item.id"
        :class="{ active: active === item.id }"
        :aria-current="active === item.id ? 'page' : undefined"
        @click="navigate(item.id)"
      >
        {{ item.name }}<span v-if="item.id === 'news'" class="nav-new"></span>
      </button>
    </nav>
    <div class="site-header-actions">
      <button
        v-if="active"
        class="content-exit"
        aria-label="동네로 돌아가기"
        @click="emit('close')"
      >
        동네로 돌아가기
      </button>
      <div class="header-right"><AccountActions compact /></div>
      <button
        ref="menuButton"
        class="site-menu-toggle"
        :aria-label="menuOpen ? '메뉴 닫기' : '메뉴 열기'"
        :aria-expanded="menuOpen"
        :aria-controls="navigationId"
        @click="menuOpen = !menuOpen"
      >
        <Icon :name="menuOpen ? 'close' : 'menu'" :size="22" />
      </button>
    </div>
  </header>
  <button v-if="menuOpen" class="site-menu-backdrop" aria-label="메뉴 닫기" tabindex="-1" @click="closeMenu"></button>
</template>
