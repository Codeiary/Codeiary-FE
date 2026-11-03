import { auth } from "@/store/auth";
import type { PortfolioFont, PortfolioInput } from "@/utils/portfolio/api-payload";

export function fetchPortfolioFonts() {
  return auth.authorizedRequest<PortfolioFont[]>("/portfolios/fonts");
}

export function createPortfolio(input: PortfolioInput) {
  return auth.authorizedRequest<{ id: number }>("/portfolios", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}
