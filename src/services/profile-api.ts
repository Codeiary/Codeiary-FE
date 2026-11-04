import { createAuthApi } from "@/services/auth-api";
import type { HomeProfile } from "@/utils/profile/home-profile";
const api = createAuthApi();
interface PublicProfile { id: number; nickname: string; profileImageUrl: string | null; githubUrl: string | null; contactEmail: string | null }
export async function fetchHomeProfile(value: string | number): Promise<HomeProfile> {
  const path = typeof value === "number" ? `/users/${value}` : `/users/by-nickname/${encodeURIComponent(value)}`;
  const profile = await api.request<PublicProfile>(path);
  return { owner: { id: profile.id, name: profile.nickname, nickname: profile.nickname },
    profileImageUrl: profile.profileImageUrl, email: profile.contactEmail ?? "", github: profile.githubUrl ?? "" };
}
