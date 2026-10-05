<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import Icon from "./components/Icon.vue";
import BrandLogo from "./components/BrandLogo.vue";
import ThemeToggle from "./components/ThemeToggle.vue";
import { useTheme } from "./theme";
import { places, type Destination } from "./city/places";
import type { CityController } from "./city/world";
import type { Point } from "./city/navigation";

const route = useRoute();
const { isDark: night } = useTheme();
const canvas = ref<HTMLCanvasElement>();
const ready = ref(false),
  error = ref(false);
const panel = ref<Destination | null>(null);
const selectedArticle = ref<number | null>(null),
  selectedProject = ref<number | null>(null),
  newsSelection = ref<number | null>(null);
const category = ref("전체"),
  search = ref(""),
  toast = ref("");
const position = shallowRef<Point>({ x: 8, z: 20.5 });
const near = ref<Destination | null>(null);
const labels = shallowRef<
  { id: Destination; x: number; y: number; visible: boolean }[]
>([]);
const dialog = ref<HTMLElement>();
let city: CityController | undefined;
let unmounted = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let previousFocus: HTMLElement | null = null;

const posts = [
  {
    id: 1,
    category: "개발 기록",
    title: "화면이 아닌, 하나의 세계를 만든다는 것",
    description:
      "Three.js와 Vue로 작은 도시를 만들며 배운 것들. 인터랙션은 어떻게 경험이 되는 걸까?",
    date: "2026.10.04",
    read: "8분",
    art: "city",
    tags: ["Three.js", "Vue"],
  },
  {
    id: 2,
    category: "프론트엔드",
    title: "좋은 인터랙션은 0.1초에서 시작된다",
    description: "작은 피드백과 자연스러운 움직임이 사용자 경험에 미치는 영향.",
    date: "2026.09.28",
    read: "5분",
    art: "motion",
    tags: ["UX", "Animation"],
  },
  {
    id: 3,
    category: "개발 기록",
    title: "코드에 나만의 취향을 담는 방법",
    description: "읽기 좋은 코드와 오래 쓰고 싶은 제품에 대한 개인적인 생각.",
    date: "2026.09.21",
    read: "6분",
    art: "code",
    tags: ["Design", "Devlog"],
  },
  {
    id: 4,
    category: "프론트엔드",
    title: "Vue의 반응성을 조금 더 깊이 들여다보기",
    description: "ref, computed, watch를 상황에 맞게 사용하기 위한 기록.",
    date: "2026.09.15",
    read: "7분",
    art: "vue",
    tags: ["Vue", "TypeScript"],
  },
];
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
const filteredPosts = computed(() =>
  posts.filter(
    (p) =>
      (category.value === "전체" || p.category === category.value) &&
      `${p.title} ${p.description} ${p.tags.join(" ")}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
);
const article = computed(() =>
  posts.find((p) => p.id === selectedArticle.value),
);
const project = computed(() =>
  projects.find((p) => p.id === selectedProject.value),
);
const navItems: {
  id: Destination;
  name: string;
  icon: string;
  number: string;
}[] = [
  { id: "blog", name: "블로그", icon: "book", number: "01" },
  { id: "portfolio", name: "포트폴리오", icon: "case", number: "02" },
  { id: "news", name: "최근 IT 이슈", icon: "news", number: "03" },
];
function notify(message: string) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 3500);
}
function startExplore() {
  if (!ready.value && !error.value)
    notify("동네를 준비하고 있어요. 잠시만 기다려 주세요.");
  else if (error.value) notify("상단 메뉴에서 모든 콘텐츠를 둘러볼 수 있어요.");
  else {
    canvas.value?.focus();
    notify("방향키로 이동해 보세요. 건물을 클릭해도 좋아요.");
  }
}
function visit(id: Destination) {
  if (error.value) {
    openPanel(id);
    return;
  }
  if (!city) return;
  if (!city.visit(id)) notify("방향키로 입구에 가까이 이동해 주세요.");
}
async function openPanel(id: Destination) {
  if (!panel.value) previousFocus = document.activeElement as HTMLElement;
  panel.value = id;
  selectedArticle.value = null;
  selectedProject.value = null;
  newsSelection.value = null;
  category.value = "전체";
  search.value = "";
  await nextTick();
  dialog.value?.focus();
}
function closePanel() {
  panel.value = null;
  selectedArticle.value = null;
  selectedProject.value = null;
  newsSelection.value = null;
  previousFocus?.focus();
}
function home() {
  closePanel();
  city?.resetCamera();
}
function keyDown(event: KeyboardEvent) {
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
      ].filter((el) => el.offsetParent !== null);
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
  )
    city?.interact();
}
function keyUp(event: KeyboardEvent) {
  city?.setInput(event.key, false);
}
function releaseKeys() {
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
watch(panel, (value) => city?.setPaused(Boolean(value)));
onMounted(async () => {
  const view = route.query.view;
  if (view === "blog" || view === "portfolio" || view === "news")
    openPanel(view);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", releaseKeys);
  try {
    const { createCity } = await import("./city/world");
    if (unmounted) return;
    city = createCity(canvas.value!, {
      position: (p) => {
        position.value = p;
      },
      labels: (p) => {
        labels.value = p;
      },
      enter: openPanel,
      travelling: (id) => notify(`${places[id].name}로 이동하는 중이에요`),
      ready: () => {
        ready.value = true;
      },
      near: (id) => {
        near.value = id;
      },
    });
    city.setPaused(Boolean(panel.value));
    city.setNight(night.value);
  } catch (reason) {
    if (unmounted) return;
    error.value = true;
    console.error("3D city initialization failed:", reason);
  }
});
onBeforeUnmount(() => {
  unmounted = true;
  city?.dispose();
  clearTimeout(toastTimer);
  window.removeEventListener("keydown", keyDown);
  window.removeEventListener("keyup", keyUp);
  window.removeEventListener("blur", releaseKeys);
});
</script>

<template>
  <div class="app-shell" :class="{ 'is-night': night }">
    <header class="site-header">
      <button class="brand" aria-label="Codeiary 홈으로" @click="home">
        <BrandLogo />
      </button>
      <nav aria-label="메인 메뉴">
        <button
          v-for="item in navItems"
          :key="item.id"
          :class="{ active: panel === item.id }"
          @click="openPanel(item.id)"
        >
          {{ item.name }}<span v-if="item.id === 'news'" class="nav-new"></span>
        </button>
      </nav>
      <div class="header-right">
        <span class="live-indicator"><i></i> OPEN FOR EXPLORATION</span>
      </div>
    </header>
    <main class="city-board" aria-label="Codeiary 3D 도시">
      <div class="sky-haze"></div>
      <canvas
        ref="canvas"
        class="city-canvas"
        tabindex="0"
        aria-label="3D 동네. 방향키 또는 WASD로 이동하고, 건물을 클릭하거나 입구로 걸어가면 콘텐츠가 열립니다."
      ></canvas>
      <div class="board-grain"></div>
      <section class="hero-copy">
        <div class="eyebrow">
          <span class="tiny-cross">✳</span> LEARN. BUILD. DOCUMENT.
        </div>
        <h1>Code <br /><span>Diary</span></h1>
        <p class="hero-subtitle">Wonseok’s Dev Story</p>
      </section>
      <div v-if="ready" class="building-labels">
        <button
          v-for="label in labels"
          :key="label.id"
          class="building-label"
          :class="[label.id, { nearby: near === label.id }]"
          :style="{
            left: `${label.x}px`,
            top: `${label.y}px`,
            visibility: label.visible ? 'visible' : 'hidden',
            '--place-color': places[label.id].color,
          }"
          @click="visit(label.id)"
        >
          <span class="label-icon"
            ><Icon
              :name="navItems.find((i) => i.id === label.id)!.icon"
              :size="18" /></span
          ><span class="label-content"
            ><small>{{ places[label.id].english }}</small
            ><strong>{{ places[label.id].name }}</strong></span
          ><Icon name="arrow" :size="14" /><span class="label-stem"></span>
        </button>
      </div>
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
      <aside class="minimap" aria-label="동네 지도">
        <div class="map-content">
          <svg
            class="map-svg"
            viewBox="0 0 220 130"
            aria-label="플레이어 위치와 세 건물"
          >
            <rect width="220" height="130" rx="5" fill="#e9e9dc" />
            <path d="M202 0h18v130h-18z" fill="#a8c6bf" />
            <path d="M0 86h202M139 0v130" stroke="#bbc4b8" stroke-width="13" />
            <path
              d="M0 86h202M139 0v130"
              stroke="#f8f4e5"
              stroke-width="1"
              stroke-dasharray="4 4"
            />
            <path
              d="M12 8h25v21H12zM49 8h28v25H49zM99 7h24v21H99zM159 7h32v19h-32zM10 108h28v19H10zM52 105h24v22H52zM88 111h27v17H88zM161 108h28v20h-28zM14 41h24v23H14z"
              fill="#d1d4c1"
            />
            <rect x="90" y="46" width="24" height="23" rx="3" fill="#c5d0ad" />
            <circle cx="103" cy="58" r="5" fill="#a9c7bd" />
            <g
              class="map-place"
              role="button"
              tabindex="0"
              aria-label="블로그 하우스 방문"
              @click="visit('blog')"
              @keydown.enter.prevent="visit('blog')"
            >
              <rect
                x="54"
                y="45"
                width="29"
                height="23"
                rx="3"
                fill="#d68a72"
              />
              <circle cx="68" cy="57" r="5" fill="#f7ead7" />
            </g>
            <g
              class="map-place"
              role="button"
              tabindex="0"
              aria-label="포트폴리오 갤러리 방문"
              @click="visit('portfolio')"
              @keydown.enter.prevent="visit('portfolio')"
            >
              <rect
                x="101"
                y="15"
                width="28"
                height="26"
                rx="3"
                fill="#6d9c8c"
              />
              <circle cx="115" cy="28" r="5" fill="#f7ead7" />
            </g>
            <g
              class="map-place"
              role="button"
              tabindex="0"
              aria-label="IT 뉴스 타워 방문"
              @click="visit('news')"
              @keydown.enter.prevent="visit('news')"
            >
              <rect
                x="158"
                y="41"
                width="27"
                height="28"
                rx="3"
                fill="#d1b36d"
              />
              <circle cx="171" cy="55" r="5" fill="#f7ead7" />
            </g>
            <circle
              :cx="(position.x + 50) * 2 + 10"
              :cy="(position.z + 48) * 1.3"
              r="7"
              fill="#f5f0df"
              opacity=".9"
            />
            <circle
              :cx="(position.x + 50) * 2 + 10"
              :cy="(position.z + 48) * 1.3"
              r="3.5"
              fill="#db7853"
            />
          </svg>
        </div>
      </aside>
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
      <div class="world-signature">
        <strong>기여</strong>
        <a
          class="contributor-link"
          href="https://github.com/dnjstjt1297"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="기여자 김원석의 GitHub 프로필 (새 탭)"
        >
          <Icon name="github" :size="17" /><span>김원석</span
          ><Icon name="arrow" :size="12" />
        </a>
      </div>
      <div class="mobile-controls" aria-label="터치 이동 버튼">
        <button
          class="touch-up"
          aria-label="위로 이동"
          @pointerdown.prevent="city?.setInput('ArrowUp', true)"
          @pointerup="city?.setInput('ArrowUp', false)"
          @pointerleave="city?.setInput('ArrowUp', false)"
          @pointercancel="releaseKeys"
        >
          ↑</button
        ><button
          class="touch-left"
          aria-label="왼쪽으로 이동"
          @pointerdown.prevent="city?.setInput('ArrowLeft', true)"
          @pointerup="city?.setInput('ArrowLeft', false)"
          @pointerleave="city?.setInput('ArrowLeft', false)"
          @pointercancel="releaseKeys"
        >
          ←</button
        ><button
          class="touch-down"
          aria-label="아래로 이동"
          @pointerdown.prevent="city?.setInput('ArrowDown', true)"
          @pointerup="city?.setInput('ArrowDown', false)"
          @pointerleave="city?.setInput('ArrowDown', false)"
          @pointercancel="releaseKeys"
        >
          ↓</button
        ><button
          class="touch-right"
          aria-label="오른쪽으로 이동"
          @pointerdown.prevent="city?.setInput('ArrowRight', true)"
          @pointerup="city?.setInput('ArrowRight', false)"
          @pointerleave="city?.setInput('ArrowRight', false)"
          @pointercancel="releaseKeys"
        >
          →
        </button>
      </div>
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
      ><div v-if="panel" class="modal-backdrop" @click.self="closePanel">
        <section
          ref="dialog"
          class="content-window"
          :class="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="places[panel].name"
          tabindex="-1"
        >
          <div class="window-topbar">
            <span class="window-dots"><i></i><i></i><i></i></span
            ><span
              ><Icon
                :name="navItems.find((i) => i.id === panel)?.icon || 'book'"
                :size="14"
              />{{ places[panel].english }}</span
            ><button
              class="close-button"
              aria-label="창 닫기"
              @click="closePanel"
            >
              <Icon name="close" :size="20" />
            </button>
          </div>
          <template v-if="panel === 'blog'">
            <div v-if="article" class="article-body">
              <button class="text-back" @click="selectedArticle = null">
                ← 모든 글로 돌아가기</button
              ><span class="section-kicker"
                >{{ article.category }} · SAMPLE ARTICLE</span
              >
              <h2>{{ article.title }}</h2>
              <div class="article-meta">
                CODEIARY <span>·</span>{{ article.date }}<span>·</span
                >{{ article.read }} 읽기
              </div>
              <div class="article-illustration" :class="article.art">
                <span v-if="article.art === 'city'" class="art-city"
                  ><i></i><i></i><i></i><i></i></span
                ><span v-else class="art-letter">{{
                  article.art === "vue"
                    ? "V"
                    : article.art === "code"
                      ? "{ }"
                      : "↗"
                }}</span>
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
            </div>
            <div v-else class="window-body">
              <div class="window-heading">
                <div>
                  <span class="section-kicker">01 / THE BLOG HOUSE</span>
                  <h2>생각을 짓는 곳<span>.</span></h2>
                  <p>배운 것, 만든 것, 그리고 그 사이의 이야기.</p>
                </div>
                <span class="heading-icon blog-icon"
                  ><Icon name="book" :size="32"
                /></span>
              </div>
              <div class="blog-filter">
                <div class="filter-tabs">
                  <button
                    v-for="tab in ['전체', '개발 기록', '프론트엔드']"
                    :key="tab"
                    :class="{ selected: category === tab }"
                    @click="category = tab"
                  >
                    {{ tab }}
                  </button>
                </div>
                <label class="search-input"
                  ><svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                  >
                    <circle cx="10" cy="10" r="6" />
                    <path d="m15 15 5 5" /></svg
                  ><input
                    v-model="search"
                    placeholder="이야기 찾기"
                    aria-label="블로그 글 검색"
                /></label>
              </div>
              <div class="post-grid">
                <button
                  v-for="post in filteredPosts"
                  :key="post.id"
                  class="post-card"
                  @click="selectedArticle = post.id"
                >
                  <div class="post-art" :class="post.art">
                    <span v-if="post.art === 'city'" class="art-city"
                      ><i></i><i></i><i></i><i></i></span
                    ><span v-else class="art-letter">{{
                      post.art === "vue"
                        ? "V"
                        : post.art === "code"
                          ? "{ }"
                          : "↗"
                    }}</span
                    ><span class="art-caption">{{
                      post.art === "city"
                        ? "A LITTLE WORLD OF IDEAS"
                        : post.art === "motion"
                          ? "MAKE IT FEEL ALIVE"
                          : post.art === "code"
                            ? "CODE WITH CHARACTER"
                            : "BEHIND THE REACTIVITY"
                    }}</span>
                  </div>
                  <div class="post-content">
                    <span class="post-category">{{ post.category }}</span>
                    <h3>{{ post.title }}</h3>
                    <p>{{ post.description }}</p>
                    <div class="post-footer">
                      <span>{{ post.date }}</span
                      ><span
                        ><Icon name="clock" :size="12" />{{ post.read
                        }}<Icon name="arrow" :size="15"
                      /></span>
                    </div>
                  </div>
                </button>
              </div>
              <div v-if="!filteredPosts.length" class="empty-state">
                아직 그 이야기는 없네요.<br /><span
                  >다른 검색어로 찾아보세요.</span
                >
              </div>
              <div class="window-footer">
                <span class="demo-label">DEMO CONTENT</span
                ><span>앞으로 더 많은 이야기가 이곳에 쌓일 거예요.</span
                ><Icon name="spark" :size="14" />
              </div>
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
              <button
                v-if="project.id === 1"
                class="explore-button"
                @click="
                  closePanel();
                  startExplore();
                "
              >
                동네로 돌아가기 <span><Icon name="arrow" :size="18" /></span>
              </button>
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
          <div class="window-bottom-nav">
            <button
              v-for="item in navItems"
              :key="item.id"
              :class="{ current: panel === item.id }"
              @click="openPanel(item.id)"
            >
              <Icon :name="item.icon" :size="16" />{{ item.name }}</button
            ><button class="return-city" @click="closePanel">
              <Icon name="walk" :size="16" />동네로 돌아가기
            </button>
          </div>
        </section>
      </div></Transition
    >
  </div>
</template>
