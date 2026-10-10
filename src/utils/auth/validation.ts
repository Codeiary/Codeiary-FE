export function nicknameError(value: string) {
  const nickname = value.trim();
  if (!nickname) return "닉네임을 입력해 주세요.";
  if (!/^[가-힣A-Za-z0-9_]{2,20}$/.test(nickname))
    return "한글, 영문, 숫자, 밑줄로 2~20자를 입력해 주세요.";
  return "";
}
