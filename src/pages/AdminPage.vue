<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import Icon from "../components/Icon.vue";
import { adminUser, signOutAdmin } from "../auth/admin";

const router = useRouter();
const busy = ref(false),
  error = ref("");
const destinations = [
  {
    id: "blog",
    icon: "book",
    number: "01",
    title: "블로그",
    subtitle: "THOUGHTS INTO WORDS",
    description: "배운 것과 직접 만들어 본 과정을 기록하는 공간.",
    color: "#df805e",
  },
  {
    id: "portfolio",
    icon: "case",
    number: "02",
    title: "포트폴리오",
    subtitle: "IDEAS INTO REALITY",
    description: "작은 실험에서 시작된 프로젝트와 작업을 모으는 공간.",
    color: "#72988a",
  },
  {
    id: "news",
    icon: "news",
    number: "03",
    title: "최근 IT 이슈",
    subtitle: "CURIOSITY INTO CONTEXT",
    description: "변화하는 기술 속에서 눈여겨볼 이야기를 나누는 공간.",
    color: "#b79a56",
  },
];
async function logout() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await signOutAdmin();
    await router.replace({ name: "admin-login" });
  } catch {
    error.value = "로그아웃하지 못했어요. 다시 시도해 주세요.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="admin-shell">
    <header class="admin-header">
      <RouterLink to="/" class="brand" aria-label="Codeiary 홈으로">
        <span class="brand-mark"><i></i><i></i><i></i></span>
        <span>codeiary<span class="brand-period">.</span></span>
      </RouterLink>
      <span class="admin-header-label">ADMIN STUDIO</span>
      <div class="admin-account">
        <span>{{ adminUser?.name }}</span
        ><button :disabled="busy" @click="logout">
          로그아웃 <Icon name="arrow" :size="14" />
        </button>
      </div>
    </header>
    <div class="admin-content">
      <div class="admin-welcome">
        <span class="admin-kicker">YOUR PERSONAL CORNER OF THE WEB</span>
        <h1>Your words.<br />Your <em>world.</em></h1>
        <p>{{ adminUser?.name }}님, 새로운 이야기를 위한 공간이에요.</p>
      </div>
      <div class="admin-section-top">
        <h2>콘텐츠 둘러보기</h2>
        <span class="admin-demo-badge">관리자 화면 목업</span>
      </div>
      <div class="admin-destinations">
        <RouterLink
          v-for="item in destinations"
          :key="item.id"
          :to="{ name: 'city', query: { view: item.id } }"
          class="admin-destination"
          :style="{ '--admin-accent': item.color }"
        >
          <div class="admin-card-top">
            <span>{{ item.number }}</span
            ><Icon :name="item.icon" :size="28" />
          </div>
          <small>{{ item.subtitle }}</small>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
          <div class="admin-card-bottom">
            공개 페이지 보기 <Icon name="arrow" :size="19" />
          </div>
        </RouterLink>
      </div>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <footer class="admin-footer">
        <span>COMMIT TO BETTER.</span
        ><RouterLink to="/"
          >동네로 돌아가기 <Icon name="arrow" :size="15"
        /></RouterLink>
      </footer>
    </div>
  </main>
</template>
