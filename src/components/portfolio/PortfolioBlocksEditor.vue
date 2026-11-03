<script setup lang="ts">
import { computed } from "vue";
import Icon from "@/components/Icon.vue";
import EditorIcon from "@/components/blog/EditorIcon.vue";
import PortfolioTextAlignment from "./PortfolioTextAlignment.vue";
import { createPortfolioBlock, normalizeBlockPosition, safePortfolioImage, type PortfolioBlock } from "@/utils/portfolio/layout";

const props = withDefaults(defineProps<{
  modelValue: PortfolioBlock[];
  selectedId: string;
  disabled?: boolean;
}>(), { disabled: false });
const emit = defineEmits<{
  "update:modelValue": [blocks: PortfolioBlock[]];
  uploadImage: [blockId: string];
  select: [blockId: string];
}>();

const activeBlock = computed(() => props.modelValue.find((block) => block.id === props.selectedId) ?? props.modelValue[0]);
const activeIndex = computed(() => props.modelValue.findIndex((block) => block.id === activeBlock.value?.id));
const canMoveUp = computed(() => activeBlock.value?.position ? activeBlock.value.position.y > 0 : activeIndex.value > 0);
const canMoveDown = computed(() => activeBlock.value?.position ? activeBlock.value.position.y < 20000 : activeIndex.value < props.modelValue.length - 1);
function labelFor(block: PortfolioBlock) { return block.type === "image" ? "이미지" : "본문"; }
function selectBlock(id: string) {
  emit("select", id);
}
function updateBlock(patch: Partial<Omit<PortfolioBlock, "id" | "type">>) {
  if (props.disabled || !activeBlock.value) return;
  const id = activeBlock.value.id;
  emit("update:modelValue", props.modelValue.map((block) => block.id === id ? { ...block, ...patch } : block));
}
function moveBlock(direction: -1 | 1) {
  if (props.disabled || !activeBlock.value) return;
  const position = activeBlock.value.position;
  if (position) {
    const next = normalizeBlockPosition({ ...position, y: position.y + direction * 20 }, activeBlock.value.type === "image" ? .1 : 10);
    if (!next || next.y === position.y) return;
    updateBlock({ position: next });
    return;
  }
  const index = activeIndex.value;
  const target = index + direction;
  if (target < 0 || target >= props.modelValue.length) return;
  const next = [...props.modelValue];
  const block = next.splice(index, 1)[0]!;
  next.splice(target, 0, block);
  emit("update:modelValue", next);
}
function duplicateBlock() {
  if (props.disabled || !activeBlock.value) return;
  const original = activeBlock.value;
  const block = { ...original, id: createPortfolioBlock(original.type).id };
  const position = normalizeBlockPosition(original.position, original.type === "image" ? .1 : 10);
  if (position) {
    block.position = normalizeBlockPosition({
      ...position,
      x: position.x + 2 <= 100 - position.width ? position.x + 2 : Math.max(0, position.x - 2),
      y: position.y + 24 <= 20000 ? position.y + 24 : Math.max(0, position.y - 24),
    }, original.type === "image" ? .1 : 10);
  }
  const next = [...props.modelValue];
  next.splice(activeIndex.value + 1, 0, block);
  emit("update:modelValue", next);
  selectBlock(block.id);
}
function removeBlock() {
  if (props.disabled || !activeBlock.value) return;
  const index = activeIndex.value;
  const block = activeBlock.value;
  const next = props.modelValue.filter((item) => item.id !== block.id);
  emit("update:modelValue", next);
  selectBlock(next[Math.min(index, next.length - 1)]?.id ?? "");
}
</script>

<template>
  <section class="portfolio-block-editor" aria-label="선택한 요소 설정">
    <section v-if="activeBlock" :key="activeBlock.id" class="block-inspector" :aria-label="`${labelFor(activeBlock)} 블록 설정`">
      <header class="block-inspector-header">
        <h4>선택한 요소</h4>
        <div class="block-actions" role="group" aria-label="블록 관리">
          <button type="button" class="icon-button" title="블록 위로 이동" aria-label="블록 위로 이동" :disabled="disabled || !canMoveUp" @click="moveBlock(-1)"><Icon name="arrow-left" :size="16" class="move-up" /></button>
          <button type="button" class="icon-button" title="블록 아래로 이동" aria-label="블록 아래로 이동" :disabled="disabled || !canMoveDown" @click="moveBlock(1)"><Icon name="arrow-right" :size="16" class="move-down" /></button>
          <button type="button" class="icon-button" title="블록 복제" aria-label="블록 복제" :disabled="disabled" @click="duplicateBlock">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></svg>
          </button>
          <button type="button" class="icon-button delete-button" title="블록 삭제" aria-label="블록 삭제" :disabled="disabled" @click="removeBlock"><Icon name="trash" :size="16" /></button>
        </div>
      </header>

      <div class="block-content-fields">
        <template v-if="activeBlock.type === 'image'">
          <div v-if="safePortfolioImage(activeBlock.imageUrl)" class="image-preview"><img :src="safePortfolioImage(activeBlock.imageUrl)" :alt="activeBlock.alt || ''" /></div>
          <button type="button" data-block-input class="image-upload" :class="{ 'has-image': !!activeBlock.imageUrl }" :disabled="disabled" @click="emit('uploadImage', activeBlock.id)">
            <EditorIcon name="image" /><span>{{ activeBlock.imageUrl ? '이미지 교체' : '이미지 업로드' }}</span>
          </button>

        </template>
        <template v-else>
          <p class="field-hint">본문을 클릭해 직접 편집하세요.</p>
        </template>
      </div>

      <div v-if="activeBlock.type !== 'image'" class="block-layout-fields">
        <PortfolioTextAlignment :model-value="activeBlock.align" :disabled="disabled" @update:model-value="updateBlock({ align: $event })" />
      </div>
    </section>

  </section>
</template>

<style scoped>
.portfolio-block-editor { min-width: 0; color: var(--theme-text, #303d35); font-size: 13px; }
.portfolio-block-editor button, .portfolio-block-editor input { font: inherit; }
.portfolio-block-editor button:disabled { cursor: not-allowed; opacity: .4; }
.portfolio-block-editor :is(button, input):focus-visible { outline: 2px solid var(--theme-accent, #d67c57); outline-offset: 2px; }
.block-inspector-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.block-inspector-header h4 { margin: 0; font-size: 13px; font-weight: 700; }
.block-inspector { margin-top: 8px; padding-top: 15px; border-top: 1px solid var(--theme-border, #dedfd5); }
.block-inspector-header { margin-bottom: 15px; }
.block-actions { display: flex; gap: 2px; }
.icon-button { display: grid; width: 30px; height: 32px; padding: 0; place-items: center; border-radius: 5px; color: var(--theme-muted, #747f70); }
.icon-button:hover:enabled { background: var(--theme-raised, #f1f0e8); color: var(--theme-text, #303d35); }
.delete-button:hover:enabled { color: #b65545; }
.move-up, .move-down { transform: rotate(90deg); }
.block-content-fields { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.field-hint { margin: 0; color: var(--theme-muted, #747f70); font-size: 11px; line-height: 1.75; overflow-wrap: anywhere; }
.image-preview { display: grid; place-items: center; min-height: 90px; overflow: hidden; border: 1px solid var(--theme-border, #dedfd5); border-radius: 8px; background: var(--theme-raised, #f1f0e8); }
.image-preview img { display: block; width: 100%; max-height: 190px; object-fit: contain; }
.image-upload { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 105px; padding: 12px; border: 1px dashed var(--theme-border, #dedfd5); border-radius: 8px; color: var(--theme-muted, #747f70); }
.image-upload:hover:enabled { color: var(--theme-accent, #d67c57); border-color: var(--theme-accent, #d67c57); }
.image-upload.has-image { min-height: 35px; padding: 7px; border-style: solid; }
.block-layout-fields { display: grid; gap: 11px; margin-top: 18px; padding-top: 15px; border-top: 1px solid var(--theme-border, #dedfd5); }
@media (max-width: 600px) {
  .icon-button { width: 32px; height: 34px; }
  .block-content-fields input { font-size: 16px; }
}
</style>
