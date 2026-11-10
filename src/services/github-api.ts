import { auth } from "@/store/auth";

export interface GitHubRepository { installationId: number | null; id: number; owner: string; name: string; branch: string }
export interface GitHubConnection {
  connected: boolean;
  login: string | null;
  repository?: GitHubRepository | null;
}
export function fetchGitHubConnection() {
  return auth.authorizedRequest<GitHubConnection>("/github/connection");
}
export function disconnectGitHub() {
  return auth.authorizedRequest<void>("/github/connection", { method: "DELETE" });
}
