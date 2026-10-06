import { expect, it } from "vitest";
import { emailError, passwordError } from "@/utils/auth/validation";

it("소문자 이메일과 올바른 주소 형식을 검증할 수 있다.", () => {
  expect(emailError("writer@example.com")).toBe("");
  for (const value of [
    "Writer@example.com",
    "writer",
    "writer @example.com",
    "",
  ])
    expect(emailError(value)).not.toBe("");
});
it("비밀번호 길이와 영문·숫자·특수문자 개수를 검증할 수 있다.", () => {
  for (const value of ["abc12!@#", "abcdefghijklmn123!@#"])
    expect(passwordError(value)).toBe("");
  for (const value of [
    "ab1!@#",
    "abcdefghijklmnop123!@#",
    "abc123!@",
    "abcd!@#$",
    "12345!@#",
    "abc12♥★☆",
  ])
    expect(passwordError(value)).not.toBe("");
});
