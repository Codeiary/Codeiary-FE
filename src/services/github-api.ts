import { auth } from "@/store/auth";

export interface GitHubConnection { connected: boolean; login: string | null }
export function fetchGitHubConnection() {
  return auth.authorizedRequest<GitHubConnection>("/github/connection");
}

export function disconnectGitHub() {
  return auth.authorizedRequest<void>("/github/connection", { method: "DELETE" });
}
