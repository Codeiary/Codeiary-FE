import { onMounted, ref } from "vue";

const STORAGE_KEY = "codeiary.portfolio.recent-colors";
const LIMIT = 8;
const colors = ref<string[]>([]);
const valid = (color: unknown): color is string => typeof color === "string" && /^#[\da-f]{6}$/i.test(color);

export function useRecentPortfolioColors() {
  onMounted(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      colors.value = Array.isArray(saved) ? [...new Set(saved.filter(valid).map((color) => color.toLowerCase()))].slice(0, LIMIT) : [];
    } catch { colors.value = []; }
  });
  function remember(color: string) {
    if (!valid(color)) return;
    const normalized = color.toLowerCase();
    colors.value = [normalized, ...colors.value.filter((value) => value !== normalized)].slice(0, LIMIT);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colors.value)); } catch { /* Editing remains available without storage. */ }
  }
  return { colors, remember };
}
