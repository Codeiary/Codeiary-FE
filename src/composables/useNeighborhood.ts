import { computed, ref, shallowRef, watch, type ComputedRef } from "vue";
import {
  fetchNeighborhoodBlock,
  type NeighborhoodBlock,
} from "@/services/mock-neighborhood";
import {
  HOMES_PER_BLOCK,
  orderedResidences,
  type Residence,
} from "@/utils/city/residences";

export function useNeighborhood(directory: ComputedRef<Residence[]>) {
  const page = ref(-1);
  const cache = shallowRef(new Map<number, NeighborhoodBlock>());
  const pending = ref(0);
  const error = ref("");
  let generation = 0;
  const requests = new Map<number, Promise<NeighborhoodBlock | undefined>>();
  const residents = computed(() => orderedResidences(directory.value));
  const pageCount = computed(() =>
    Math.ceil(residents.value.length / HOMES_PER_BLOCK),
  );
  // Only the current and adjacent blocks own GPU objects.
  const visibleBlocks = computed(() =>
    [...cache.value.values()].filter(
      (block) => Math.abs(block.page - page.value) <= 1,
    ),
  );

  function ensureBlock(index: number): Promise<NeighborhoodBlock | undefined> {
    if (index < 0 || index >= pageCount.value)
      return Promise.resolve(undefined);
    if (cache.value.has(index)) return Promise.resolve(cache.value.get(index));
    if (requests.has(index)) return requests.get(index)!;
    const version = generation;
    pending.value++;
    const request = fetchNeighborhoodBlock(directory.value, index)
      .then((block) => {
        if (version !== generation) return undefined;
        cache.value = new Map(cache.value).set(index, block);
        error.value = "";
        return block;
      })
      .catch(() => {
        if (version === generation)
          error.value = "다음 동네를 불러오지 못했어요. 다시 시도해 주세요.";
        return undefined;
      })
      .finally(() => {
        if (version === generation) {
          pending.value--;
          requests.delete(index);
        }
      });
    requests.set(index, request);
    return request;
  }
  async function goToPage(index: number) {
    if (!(await ensureBlock(index))) return false;
    page.value = index;
    return true;
  }
  watch(
    directory,
    () => {
      generation++;
      requests.clear();
      pending.value = 0;
      cache.value = new Map();
      page.value = -1;
      error.value = "";
    },
    { immediate: true },
  );
  return {
    page,
    residents,
    pageCount,
    visibleBlocks,
    pending,
    error,
    ensureBlock,
    goToPage,
  };
}
