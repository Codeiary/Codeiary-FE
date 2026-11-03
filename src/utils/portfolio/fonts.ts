export const portfolioFonts = [
  { id: "sans", label: "기본 고딕", family: '"Pretendard", -apple-system, BlinkMacSystemFont, sans-serif' },
  { id: "serif", label: "노토 명조", family: '"Noto Serif KR", "AppleMyungjo", Georgia, serif', google: "Noto Serif KR:wght@400;700" },
  { id: "mono", label: "코드 고정폭", family: '"SFMono-Regular", Consolas, "Liberation Mono", monospace' },
  { id: "noto-sans", label: "노토 고딕", family: '"Noto Sans KR", sans-serif', google: "Noto Sans KR:wght@400;700" },
  { id: "nanum-gothic", label: "나눔고딕", family: '"Nanum Gothic", sans-serif', google: "Nanum Gothic:wght@400;700" },
  { id: "nanum-myeongjo", label: "나눔명조", family: '"Nanum Myeongjo", serif', google: "Nanum Myeongjo:wght@400;700" },
  { id: "gowun-dodum", label: "고운돋움", family: '"Gowun Dodum", sans-serif', google: "Gowun Dodum" },
  { id: "gowun-batang", label: "고운바탕", family: '"Gowun Batang", serif', google: "Gowun Batang:wght@400;700" },
  { id: "jua", label: "주아", family: '"Jua", sans-serif', google: "Jua" },
  { id: "do-hyeon", label: "도현", family: '"Do Hyeon", sans-serif', google: "Do Hyeon" },
  { id: "black-han", label: "검은고딕", family: '"Black Han Sans", sans-serif', google: "Black Han Sans" },
  { id: "nanum-pen", label: "나눔손글씨 펜", family: '"Nanum Pen Script", cursive', google: "Nanum Pen Script" },
] as const;

export type PortfolioFontId = typeof portfolioFonts[number]["id"];

export function portfolioFontFamily(id?: string): string {
  return (portfolioFonts.find((font) => font.id === id) ?? portfolioFonts[0]).family;
}

/** Load only fonts actually used in the document; never send authored text to the font service. */
export function loadPortfolioFont(id?: string): void {
  if (typeof document === "undefined") return;
  const font = portfolioFonts.find((entry) => entry.id === id);
  if (!font || !("google" in font)) return;
  if (document.head.querySelector(`link[data-portfolio-font="${font.id}"]`)) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.dataset.portfolioFont = font.id;
  stylesheet.href = `https://fonts.googleapis.com/css2?${new URLSearchParams({ family: font.google, display: "swap" })}`;
  stylesheet.onerror = () => stylesheet.remove();
  document.head.append(stylesheet);
}
