export const portfolioFonts = [
  { id: "sans", label: "기본 고딕", family: '"Noto Sans KR", "DM Sans", sans-serif' },
  { id: "serif", label: "노토 명조", family: '"Noto Serif KR", "AppleMyungjo", Georgia, serif' },
  { id: "mono", label: "코드 고정폭", family: '"Roboto Mono", "Noto Sans KR", monospace' },
  { id: "noto-sans", label: "노토 고딕", family: '"Noto Sans KR", sans-serif' },
  { id: "nanum-gothic", label: "나눔고딕", family: '"Nanum Gothic", sans-serif' },
  { id: "nanum-myeongjo", label: "나눔명조", family: '"Nanum Myeongjo", serif' },
  { id: "gowun-dodum", label: "고운돋움", family: '"Gowun Dodum", sans-serif' },
  { id: "gowun-batang", label: "고운바탕", family: '"Gowun Batang", serif' },
  { id: "jua", label: "주아", family: '"Jua", sans-serif' },
  { id: "do-hyeon", label: "도현", family: '"Do Hyeon", sans-serif' },
  { id: "black-han", label: "검은고딕", family: '"Black Han Sans", sans-serif' },
  { id: "nanum-pen", label: "나눔손글씨 펜", family: '"Nanum Pen Script", cursive' },
] as const;

export type PortfolioFontId = typeof portfolioFonts[number]["id"];

export function portfolioFontFamily(id?: string): string {
  return (portfolioFonts.find((font) => font.id === id) ?? portfolioFonts[0]).family;
}

const loaders: Record<PortfolioFontId, () => Promise<unknown>> = {
  sans: () => Promise.all([import("@fontsource/noto-sans-kr/400.css"), import("@fontsource/noto-sans-kr/700.css")]),
  "noto-sans": () => Promise.all([import("@fontsource/noto-sans-kr/400.css"), import("@fontsource/noto-sans-kr/700.css")]),
  serif: () => Promise.all([import("@fontsource/noto-serif-kr/400.css"), import("@fontsource/noto-serif-kr/700.css")]),
  mono: () => Promise.all([import("@fontsource/roboto-mono/400.css"), import("@fontsource/roboto-mono/700.css")]),
  "nanum-gothic": () => Promise.all([import("@fontsource/nanum-gothic/400.css"), import("@fontsource/nanum-gothic/700.css")]),
  "nanum-myeongjo": () => Promise.all([import("@fontsource/nanum-myeongjo/400.css"), import("@fontsource/nanum-myeongjo/700.css")]),
  "gowun-dodum": () => import("@fontsource/gowun-dodum/400.css"),
  "gowun-batang": () => Promise.all([import("@fontsource/gowun-batang/400.css"), import("@fontsource/gowun-batang/700.css")]),
  jua: () => import("@fontsource/jua/400.css"),
  "do-hyeon": () => import("@fontsource/do-hyeon/400.css"),
  "black-han": () => import("@fontsource/black-han-sans/400.css"),
  "nanum-pen": () => import("@fontsource/nanum-pen-script/400.css"),
};
const loading = new Map<PortfolioFontId, Promise<unknown>>();
function ensureFont(id: PortfolioFontId) {
  let pending = loading.get(id);
  if (!pending) {
    pending = loaders[id]().catch((error) => { loading.delete(id); throw error; });
    loading.set(id, pending);
  }
  return pending;
}

/** Versioned local assets, loaded only when the document uses the font. */
export function loadPortfolioFont(id?: string): void {
  if (typeof document === "undefined") return;
  const font = portfolioFonts.find((font) => font.id === (id ?? "sans"));
  if (font) void ensureFont(font.id).catch(() => {});
}

export async function waitForPortfolioFonts(root: HTMLElement) {
  if (!document.fonts) return;
  const families = new Set([root, ...root.querySelectorAll<HTMLElement>(".portfolio-document, span, p, h1, h2, h3, code")]
    .map((element) => getComputedStyle(element).fontFamily.split(",")[0]?.trim().replace(/["']/g, "")));
  const fonts = portfolioFonts.filter((font) => families.has(font.family.split(",")[0]!.trim().replace(/["']/g, "")));
  try { await Promise.all(fonts.map((font) => ensureFont(font.id))); }
  catch { throw new Error("글꼴을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."); }
  root.getBoundingClientRect();
  await document.fonts.ready;
}
