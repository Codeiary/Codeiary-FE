import { createAuthApi } from "@/services/auth-api";
import type { ApiPortfolio, ApiPortfolioItem } from "@/utils/portfolio/api-response";
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

interface ApiPortfolioPage { content: ApiPortfolioItem[]; page: number; totalPages: number; totalElements: number }
const api = createAuthApi();
export async function fetchPortfolio(id: number) {
  await auth.restore();
  const response = auth.user.value
    ? await auth.authorizedRequest<ApiPortfolio>(`/portfolios/${id}`)
    : await api.request<ApiPortfolio>(`/portfolios/${id}`);
  const { mapPortfolio } = await import("@/utils/portfolio/api-response");
  return mapPortfolio(response);
}
export async function fetchPortfolioPage(params: { mine?: boolean; authorId?: number; search?: string; page?: number; size?: number } = {}) {
  const query = new URLSearchParams({ page: String(params.page ?? 0), size: String(params.size ?? 6) });
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.authorId != null) query.set("authorId", String(params.authorId));
  const path = `/portfolios${params.mine ? "/mine" : ""}?${query}`;
  const result = params.mine ? await auth.authorizedRequest<ApiPortfolioPage>(path) : await api.request<ApiPortfolioPage>(path);
  const { mapPortfolioItem } = await import("@/utils/portfolio/api-response");
  return { ...result, content: result.content.map(mapPortfolioItem) };
}

export function updatePortfolio(id: number, input: PortfolioInput) {
  return auth.authorizedRequest<void>(`/portfolios/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}
export function removePortfolio(id: number) {
  return auth.authorizedRequest<void>(`/portfolios/${id}`, { method: "DELETE" });
}
