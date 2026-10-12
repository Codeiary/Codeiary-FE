import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from "vue";
import { auth } from "@/store/auth";
import { fetchMyPostCount } from "@/services/blog-api";
import { fetchNeighborhoodResidents, residenceDirectory } from "@/services/neighborhood";
import type { BlogPost } from "@/utils/blog/posts";
import type { Residence } from "@/utils/city/residences";

export function useResidenceDirectory(
  posts: Ref<BlogPost[]> = shallowRef([]),
  enabled: Ref<boolean> = ref(true),
) {
  const { user } = auth;
  const ownPostCount = ref<number>();
  const apiResidents = shallowRef<Residence[]>([]);
  const loaded = ref(false);
  let disposed = false;
  let countRequest = 0;
  let residentsRequest: Promise<void> | undefined;

  const directory = computed(() => {
    const residents = new Map(residenceDirectory(user.value, posts.value, ownPostCount.value)
      .map((resident) => [resident.id, resident]));
    for (const resident of apiResidents.value) {
      const current = residents.get(resident.id);
      residents.set(resident.id, current && resident.id === user.value?.id
        ? current : { ...current, ...resident });
    }
    return [...residents.values()];
  });
  const ownResidence = computed(() => directory.value.find((resident) => resident.id === user.value?.id));
  const ownHouseLevel = computed(() => ownResidence.value?.level ?? 0);

  function loadResidents() {
    return residentsRequest ??= fetchNeighborhoodResidents()
      .then((residents) => { if (!disposed) apiResidents.value = residents; })
      .catch(() => { /* Available authors remain visible when the directory is unavailable. */ })
      .finally(() => { if (!disposed) loaded.value = true; });
  }
  watch([() => user.value?.id, enabled], async ([id, active]) => {
    const request = ++countRequest;
    ownPostCount.value = undefined;
    if (!id || !active || import.meta.env.SSR) return;
    try {
      const count = await fetchMyPostCount();
      if (!disposed && request === countRequest) ownPostCount.value = count;
    } catch {
      // Fall back to the loaded posts when the count request fails.
    }
  }, { immediate: true });
  watch(enabled, (active) => {
    if (active && !import.meta.env.SSR) void loadResidents();
  }, { immediate: true });
  onBeforeUnmount(() => { disposed = true; });
  return { directory, ownResidence, ownHouseLevel, loadResidents, loaded };
}
