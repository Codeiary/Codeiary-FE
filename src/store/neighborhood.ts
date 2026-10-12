import { shallowRef } from "vue";
import { fetchNeighborhoodResidents } from "@/services/neighborhood";
import type { Residence } from "@/utils/city/residences";

// Shared across views; this contains only public profiles and public post counts.
export const neighborhoodResidents = shallowRef<Residence[]>([]);
let updatedAt: number | undefined;
let request: Promise<void> | undefined;

export function loadNeighborhoodResidents(): Promise<void> {
  if (import.meta.env.SSR) return Promise.resolve();
  if (updatedAt !== undefined && Date.now() - updatedAt < 30_000)
    return Promise.resolve();

  const refresh = request ??= fetchNeighborhoodResidents()
    .then((residents) => {
      neighborhoodResidents.value = residents;
      updatedAt = Date.now();
    })
    .catch(() => {
      // Keep the previous directory or the view's available authors on failure.
    })
    .finally(() => { request = undefined; });

  // A return visit can restore the map immediately while stale profiles refresh.
  return updatedAt === undefined ? refresh : Promise.resolve();
}
