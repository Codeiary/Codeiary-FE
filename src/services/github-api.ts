import { auth } from "@/store/auth";

export interface GitHubRepository { installationId: number | null; id: number; owner: string; name: string; branch: string }
export interface GitHubConnection {
  connected: boolean;
  login: string | null;
  repository?: GitHubRepository | null;
}
export type GitHubSyncStatus = "PENDING" | "ENQUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
export interface GitHubPostSync { connected: boolean; status: GitHubSyncStatus | null }
export function fetchGitHubPostSync(postId: number) {
  return auth.authorizedRequest<GitHubPostSync>(`/github/posts/${postId}/sync`);
}
export function fetchGitHubConnection() {
  return auth.authorizedRequest<GitHubConnection>("/github/connection");
}
export function disconnectGitHub() {
  return auth.authorizedRequest<void>("/github/connection", { method: "DELETE" });
}
