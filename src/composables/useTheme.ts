import { computed, readonly, ref, watch } from "vue";

type Theme = "light" | "dark";
const storageKey = "codeiary.theme";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // The toggle still works when browser storage is unavailable.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const theme = ref<Theme>(initialTheme());
const isDark = computed(() => theme.value === "dark");
let initialized = false;

export function initializeTheme() {
  if (initialized) return;
  initialized = true;
  watch(
    theme,
    (value) => {
      document.documentElement.dataset.theme = value;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", value === "dark" ? "#1c272d" : "#fafaf6");
    },
    { immediate: true, flush: "sync" },
  );
}

function toggleTheme() {
  theme.value = isDark.value ? "light" : "dark";
  try {
    localStorage.setItem(storageKey, theme.value);
  } catch {
    // Keep the current selection in memory for this visit.
  }
}

export function useTheme() {
  return { theme: readonly(theme), isDark, toggleTheme };
}
