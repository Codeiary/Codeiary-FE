import { expect, it } from "vitest";
import { nicknameError } from "@/utils/auth/validation";
it("닉네임 길이와 허용 문자를 검증할 수 있다.", () => {
  for (const name of [
    "커밋여행자",
    "code_diary",
    "하루12",
    "ab",
    "a".repeat(20),
  ])
    expect(nicknameError(name)).toBe("");
  for (const name of [
    "",
    " ",
    "a",
    "a".repeat(21),
    "공백 이름",
    "닉네임!",
    "😀😀",
  ])
    expect(nicknameError(name)).not.toBe("");
});
