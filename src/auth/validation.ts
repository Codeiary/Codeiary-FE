export function emailError(email: string) {
  if (!email) return "이메일을 입력해 주세요.";
  if (/[\p{Lu}\p{Lt}]/u.test(email)) return "이메일은 소문자로 입력해 주세요.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "올바른 이메일 주소를 입력해 주세요.";
  return "";
}

export function passwordError(password: string) {
  if (!password) return "비밀번호를 입력해 주세요.";
  if (password.length < 8 || password.length > 20)
    return "비밀번호는 8~20자로 입력해 주세요.";
  if (
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    (password.match(/[!-/:-@[-`{-~]/g)?.length ?? 0) < 3
  ) {
    return "영문·숫자와 특수문자 3개 이상을 포함해 주세요.";
  }
  return "";
}
