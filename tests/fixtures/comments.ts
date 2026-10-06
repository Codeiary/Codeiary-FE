import type { CommentAuthor } from "@/utils/blog/comments";
import { userFixture } from "./auth";
export function commentAuthorFixture(
  overrides: Partial<CommentAuthor> = {},
): CommentAuthor {
  return { ...userFixture("USER"), nickname: "커밋여행자", ...overrides };
}
