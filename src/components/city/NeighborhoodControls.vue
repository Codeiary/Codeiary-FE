<script setup lang="ts">
import { displayName } from "@/utils/profile/display-name";
import { computed, nextTick, ref } from "vue";
import Icon from "@/components/Icon.vue";
import { searchResidences } from "@/services/mock-neighborhood";
import { type Residence } from "@/utils/city/residences";

const props = defineProps<{
  directory: Residence[];
  viewerId?: number;
  page: number;
  pageCount: number;
  loading: boolean;
  error: string;
}>();
const emit = defineEmits<{
  visit: [resident: Residence];
  district: [page: number];
  pause: [value: boolean];
}>();
const dialog = ref<HTMLDialogElement>();
const input = ref<HTMLInputElement>();
const query = ref("");
const results = computed(() => searchResidences(props.directory, query.value));
function open() {
  query.value = "";
  emit("pause", true);
  dialog.value?.showModal();
  nextTick(() => input.value?.focus());
}
function close() {
  dialog.value?.close();
  emit("pause", false);
}
function choose(resident: Residence) {
  close();
  emit("visit", resident);
}
</script>

<template>
  <div class="city-neighborhood-tools">
    <button class="city-house-search" @click="open">
      <Icon name="search" :size="17" />집 찾기
    </button>
    <button
      v-if="page < 0"
      class="city-neighborhood-link"
      :disabled="loading"
      @click="emit('district', 0)"
    >
      이웃집 <Icon name="arrow-right" :size="17" />
    </button>
    <template v-else>
      <button class="city-neighborhood-link" @click="emit('district', -1)">
        <Icon name="map" :size="17" />메인 동네
      </button>
    </template>
  </div>
  <div v-if="page >= 0" class="city-district-pager" aria-label="이웃 구역 이동">
    <button
      :disabled="loading"
      :aria-label="page === 0 ? '메인 동네로' : '이전 구역'"
      @click="emit('district', page - 1)"
    >
      <Icon name="arrow-left" :size="17" />
    </button>
    <span
      >{{ String(page + 1).padStart(2, "0")
      }}<small> / {{ String(pageCount).padStart(2, "0") }}</small></span
    >
    <button
      :disabled="loading || page >= pageCount - 1"
      aria-label="다음 구역"
      @click="emit('district', page + 1)"
    >
      <Icon name="arrow-right" :size="17" />
    </button>
  </div>
  <p v-if="loading" class="city-district-status" role="status">
    동네를 불러오고 있어요
  </p>
  <p v-else-if="error" class="city-district-status" role="alert">
    {{ error }}<button @click="emit('district', page + 1)">다시 시도</button>
  </p>
  <dialog
    ref="dialog"
    class="city-house-dialog"
    aria-labelledby="house-search-title"
    @close="emit('pause', false)"
    @click="$event.target === dialog && close()"
  >
    <header>
      <h2 id="house-search-title">어느 집을 찾으세요?</h2>
      <button aria-label="집 검색 닫기" @click="close">
        <Icon name="close" :size="20" />
      </button>
    </header>
    <label class="city-house-field"
      ><Icon name="search" :size="20" /><input
        ref="input"
        v-model="query"
        aria-label="사용자 닉네임"
        placeholder="사용자 닉네임으로 검색"
        autocomplete="off"
    /></label>
    <div class="city-house-results">
      <p v-if="!query.trim()">닉네임으로 이웃의 집을 찾아보세요.</p>
      <p v-else-if="!results.length" role="status">찾는 이웃이 없어요.</p>
      <button
        v-for="resident in results"
        :key="resident.id"
        @click="choose(resident)"
      >
        <span class="city-house-avatar">{{
          displayName(resident).slice(0, 1)
        }}</span>
        <span
          ><strong>{{ displayName(resident) }}</strong
          ><small>{{
            resident.id === viewerId
              ? "메인 동네의 내 집"
              : `글 ${resident.postCount}개 · Lv. ${resident.level}`
          }}</small></span
        >
        <Icon name="arrow-right" :size="17" />
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.city-neighborhood-tools {
  position: absolute;
  top: 24px;
  right: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 8;
}
.city-house-search,
.city-neighborhood-link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 13px;
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
  border-radius: 7px;
  color: var(--theme-text);
  font-size: 14px;
}
.city-neighborhood-link {
  background: transparent;
  border-color: transparent;
}
.city-house-search:hover,
.city-neighborhood-link:hover {
  background: var(--theme-raised);
}
.city-district-pager {
  position: absolute;
  left: 36px;
  bottom: 28px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 6px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: var(--theme-surface);
  z-index: 7;
}
.city-district-pager button {
  width: 36px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 5px;
}
.city-district-pager button:hover:not(:disabled) {
  background: var(--theme-raised);
}
.city-district-pager button:disabled {
  opacity: 0.3;
  cursor: default;
}
.city-district-pager > span {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.city-district-pager small {
  font-size: 13px;
  font-weight: 400;
  color: var(--theme-muted);
}
.city-district-status {
  position: absolute;
  top: 74px;
  right: 28px;
  padding: 11px 16px;
  border-radius: 7px;
  background: var(--theme-surface);
  font-size: 14px;
  z-index: 9;
}
.city-district-status button {
  text-decoration: underline;
}
.city-house-dialog {
  width: min(460px, calc(100% - 32px));
  max-height: 80dvh;
  padding: 24px;
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  color: var(--theme-text);
  background: var(--theme-surface);
  box-shadow: 0 24px 80px #152b2838;
}
.city-house-dialog::backdrop {
  background: #172c2d70;
  backdrop-filter: blur(5px);
}
.city-house-dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.city-house-dialog h2 {
  margin: 0;
  font-size: 21px;
  letter-spacing: -0.5px;
}
.city-house-dialog header button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--theme-raised);
}
.city-house-field {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--theme-raised);
  border-radius: 9px;
  padding: 0 14px;
  height: 48px;
  color: var(--theme-muted);
}
.city-house-field input {
  border: 0;
  width: 100%;
  background: transparent;
  color: var(--theme-text);
  font-size: 15px;
}
.city-house-results {
  overflow: auto;
  max-height: 360px;
  margin-top: 15px;
}
.city-house-results > p {
  color: var(--theme-muted);
  text-align: center;
  font-size: 15px;
  padding: 15px 0;
}
.city-house-results button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  width: 100%;
  text-align: left;
  border-radius: 10px;
}
.city-house-results button:hover {
  background: var(--theme-raised);
}
.city-house-avatar {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  background: var(--theme-raised);
  color: var(--theme-accent);
  border-radius: 11px;
  font-size: 16px;
}
.city-house-results strong {
  display: block;
  font-size: 15px;
  font-weight: 550;
}
.city-house-results small {
  display: block;
  margin-top: 4px;
  color: var(--theme-muted);
  font-size: 14px;
}
.city-house-results button > svg {
  margin-left: auto;
  color: var(--theme-muted);
}
@media (max-width: 650px) {
  .city-neighborhood-tools {
    top: 14px;
    right: 12px;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: 240px;
    gap: 4px;
  }
  .city-house-search,
  .city-neighborhood-link {
    font-size: 12px;
  }
  .city-house-search,
  .city-neighborhood-link {
    min-height: 34px;
    padding: 0 9px;
  }
  .city-district-pager {
    left: max(16px, env(safe-area-inset-left));
    bottom: calc(34px + env(safe-area-inset-bottom));
    gap: 12px;
  }
  .city-district-status {
    top: 92px;
    right: 12px;
    max-width: calc(100% - 24px);
  }
}
</style>
