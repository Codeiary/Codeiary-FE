import type { Point } from "@/utils/city/navigation";
import type { Destination } from "@/utils/city/places";

export interface CityState {
  position: Point;
  rotation: number;
  district: number;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    zoom: number;
  };
  suppressed: Destination | null;
  suppressedResidence: number | null;
}

const STORAGE_KEY = "codeiary.city.state.v1";
let savedState: CityState | null = null;

export function readCityState(): CityState | null {
  if (savedState) return savedState;
  try {
    const state = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as CityState | null;
    if (!state || !Number.isInteger(state.district) || state.district < -1
      || state.camera.position.length !== 3 || state.camera.target.length !== 3
      || ![state.position.x, state.position.z, state.rotation, state.camera.zoom,
        ...state.camera.position, ...state.camera.target].every(Number.isFinite)) return null;
    return savedState = state;
  } catch {
    return null;
  }
}

export function saveCityState(state: CityState) {
  savedState = state;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Navigation still restores the in-memory state when storage is unavailable.
  }
}

export function clearCityState() {
  savedState = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // The current tab can reset without browser storage.
  }
}
