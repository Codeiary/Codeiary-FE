interface PublicIdentity {
  nickname?: string | null;
  name?: string | null;
}

export function displayName(user?: PublicIdentity | null): string {
  return user?.nickname?.trim() || user?.name?.trim() || "사용자";
}
