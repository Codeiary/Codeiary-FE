<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "@/components/Icon.vue";
import SiteHeader from "@/components/SiteHeader.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import CityLabels from "@/components/city/CityLabels.vue";
import NeighborhoodControls from "@/components/city/NeighborhoodControls.vue";
import ResidenceLabels from "@/components/city/ResidenceLabels.vue";
import VirtualJoystick from "@/components/city/VirtualJoystick.vue";
import MobileRunButton from "@/components/city/MobileRunButton.vue";
import { auth } from "@/store/auth";
import { readCityState, saveCityState } from "@/store/city";
import { displayName } from "@/utils/profile/display-name";
import { places, type Destination } from "@/utils/city/places";
import type { CityController, ResidenceAnchor } from "@/utils/city/world";
import { HOMES_PER_BLOCK, type Residence } from "@/utils/city/residences";
import { useTheme } from "@/composables/useTheme";
import { useNeighborhood } from "@/composables/useNeighborhood";
import { useResidenceDirectory } from "@/composables/useResidenceDirectory";

const route = useRoute();
const router = useRouter();
const { user } = auth;
const { isDark: night } = useTheme();
const { directory, ownHouseLevel, loadResidents } = useResidenceDirectory();
const neighborhood = useNeighborhood(directory);
const { page: district, pageCount: districtCount, visibleBlocks, pending: districtLoading, error: districtError } = neighborhood;
const residenceLabels = shallowRef<ResidenceAnchor[]>([]);
const searchOpen = ref(false);
const canvas = ref<HTMLCanvasElement>();
const ready = ref(false);
const error = ref(false);
const near = ref<Destination | null>(null);
const labels = shallowRef<{ id: Destination; x: number; y: number; visible: boolean }[]>([]);
const toast = ref("");
let city: CityController | undefined;
let unmounted = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function placeName(id: Destination) {
  return id === "home" ? `${displayName(user.value)}의 집` : places[id].name;
}
function savePosition() {
  if (city) saveCityState(city.getState());
}
function cityVisibilityChanged() {
  if (document.visibilityState === "hidden") releaseKeys();
  city?.setPaused(searchOpen.value || document.visibilityState === "hidden");
}
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
  city?.returnFromVisit();
  return router.push({ name: "user-home", query: { resident: String(resident.id) } });
}
async function visitResidence(resident: Residence) {
  await nextTick();
  if (resident.id === user.value?.id && district.value < 0) {
    await moveDistrict(-1);
    if (error.value) void openPage("home");
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
watch(directory, () => {
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
    openPage(id);
    return;
  }
  if (!city) return;
  savePosition();
  if (!city.visit(id)) notify("방향키로 입구에 가까이 이동해 주세요.");
}
function openPage(id: Destination) {
  if (id === "home" && !user.value) return;
  return router.push({ name: id === "home" ? "user-home" : id });
}
function enterBuilding(id: Destination) {
  city?.returnFromVisit();
  return openPage(id);
}
function home() {
  city?.reset();
  district.value = -1;
  syncNeighborhood();
}
function keyDown(event: KeyboardEvent) {
  if (searchOpen.value) return;
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
    savePosition();
    city?.interact();
  }
}
function keyUp(event: KeyboardEvent) {
  city?.setInput(event.key, false);
}
function releaseKeys() {
  savePosition();
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
watch(searchOpen, (value) => city?.setPaused(value || document.visibilityState === "hidden"));
async function initializeCity() {
  const saved = readCityState();
  try {
    const { createCity } = await import("@/utils/city/world");
    if (saved && saved.district >= 0) {
      await loadResidents();
      await neighborhood.goToPage(saved.district);
    }
    if (unmounted || !canvas.value) return;
    city = createCity(canvas.value, {
      labels: (value) => { labels.value = value; },
      enter: enterBuilding,
      travelling: (id) => notify(`${placeName(id)}으로 이동하는 중이에요`),
      ready: () => { ready.value = true; },
      near: (id) => { near.value = id; },
      residenceLabels: (value) => { residenceLabels.value = value; },
      enterResidence,
      travellingResidence: (resident) => notify(`${displayName(resident)}의 집으로 이동하는 중이에요`),
      requestDistrict,
      districtChanged: (value) => { district.value = value; },
    });
    city.setPaused(searchOpen.value || document.visibilityState === "hidden");
    city.setNight(night.value);
    city.setHome(user.value ? ownHouseLevel.value : null);
    syncNeighborhood();
    if (saved && (saved.district < 0 || district.value === saved.district))
      city.restoreState(saved);
  } catch (reason) {
    if (unmounted) return;
    error.value = true;
    console.error("3D city initialization failed:", reason);
  }
}
onMounted(() => {
  if (route.query.access === "denied") notify("관리자만 접근할 수 있어요.");
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", releaseKeys);
  window.addEventListener("pagehide", releaseKeys);
  document.addEventListener("visibilitychange", cityVisibilityChanged);
  void initializeCity();
});
onBeforeUnmount(() => {
  unmounted = true;
  savePosition();
  city?.dispose();
  city = undefined;
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
    <SiteHeader @home="home" />
    <main
      class="city-board"
      aria-label="Codeiary 3D 도시"
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
        <button @click="openPage('blog')">
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
        :disabled="!ready || error || searchOpen"
        @change="city?.setRunning($event)"
      />
      <VirtualJoystick
        :disabled="!ready || error || searchOpen"
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
  </div>
</template>
