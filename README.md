# Codeiary FE

Vue 3 + TypeScript + Vite로 구성한 프런트엔드 프로젝트입니다.

## 시작하기

```sh
npm install
npm run dev
```

## 빌드

```sh
npm run build
```

## 3D 메인 페이지 목업

Vue 3와 Three.js로 구현한 도시형 개인 블로그입니다. 화면 전체를 채우는 3D 동네에서
블로그 하우스, 포트폴리오 갤러리, IT 뉴스 타워를 방문할 수 있습니다.

- 방향키 또는 WASD: 이동 / Shift: 달리기
- 건물 입구에 가까이 가면 콘텐츠 창이 열립니다. 입구 근처에서 Enter 또는 E로도 입장할 수 있습니다.
- 건물, 건물 이름표, 미니맵의 건물을 클릭하면 충돌을 피해 자동으로 달려갑니다.
- 화면 드래그: 시점 회전 / 마우스 휠: 확대·축소
- 오른쪽 도구: 라이트·다크 모드 전환. 도시의 낮·밤과 헤더, 콘텐츠 창, 관리자 화면이 함께 전환됩니다.
- 첫 방문은 시스템 테마를 따르고, 선택한 모드는 브라우저에 저장됩니다. 사이트는 항상 무음입니다.
- 홈 로고: 시점 초기화. 처음 진입과 시점 초기화는 최소 줌을 사용합니다.
- 모바일: 화면 오른쪽 아래의 방향 버튼으로 이동
- 상단 메뉴에서도 각 콘텐츠 창을 바로 열 수 있으며, Escape로 닫을 수 있습니다.

블로그 검색·분류, 글 상세 보기, 프로젝트 상세 보기, IT 이슈 상세 보기는
목업 데이터를 사용하며, 실시간 뉴스 피드는 포함하지 않습니다. Google 로그인은 개발용 목 인증과
백엔드 OAuth2·쿠키 인증 연결을 지원합니다.

도시 모델과 간판은 코드로 생성합니다. 외부 3D 모델을 내려받을 필요가 없습니다.
`src/city/world.ts`는 3D 장면과 조작, `src/city/navigation.ts`는 충돌과 경로 탐색,
`src/CityApp.vue`는 화면과 샘플 콘텐츠를 담당합니다.

WebGL을 사용할 수 없는 환경에서는 상단 메뉴로 콘텐츠를 볼 수 있습니다.

API 요청은 운영 환경에서 같은 오리진의 `/api`를 사용합니다. 개발 서버에서는
`vite.config.ts`가 `/api`, `/oauth2`, `/login/oauth2` 요청을 `http://localhost:8080`으로 프록시합니다.
운영 Nginx도 같은 OAuth 시작·콜백 경로를 백엔드에 전달합니다.

## Google 로그인 / 온보딩

- `/login`: Google 로그인만 표시하며 기존 이메일·비밀번호 로그인은 제거했습니다.
- `/auth/callback`: 백엔드가 로그인 쿠키를 설정한 뒤 복귀하는 화면입니다. `GET /api/users/me`로 현재 사용자를 확인하고 온보딩 또는 원래 화면으로 이동합니다.
- `/onboarding`: 선택 사진과 필수 닉네임을 설정합니다. 닉네임은 한글·영문·숫자·밑줄 2~20자이며, 입력 중 중복 확인과 저장 시 중복 거절을 처리합니다.
- 프로필 사진은 10MB 이하이며 브라우저에서 256px 정사각형 JPEG로 변환합니다. HEIC/HEIF는 브라우저가 읽을 수 있는 경우에만 처리하고, 지원하지 않으면 JPG/PNG를 안내합니다.
- 인증 요청은 `credentials: "include"`로 쿠키를 전송합니다. 프론트는 JWT를 읽거나 저장하지 않으며 Authorization 헤더를 만들지 않습니다. 로그인 시작 시 `sessionStorage`에는 안전한 복귀 주소와 시작 시각만 저장합니다. 실제 로그인은 저장소가 차단되어도 진행하고, 복귀 정보가 없으면 홈으로 이동합니다.

### 프론트 미리보기

`npm run dev`에서는 기본적으로 목 응답으로 Google 버튼 → 신규 온보딩 → 로그인 상태를 확인할 수 있습니다. 실제 Google 계정에 연결되지 않습니다. `Codeiary`, `관리자`, `커밋여행자`, `프론트노트`는 중복 닉네임 예시입니다. 작성한 프로필은 이 브라우저에 저장되고, 다음 로그인에는 온보딩을 건너뜁니다. 새 사용자를 다시 확인하려면 개발자 도구에서 `codeiary.oauth.mock.profile` 로컬 저장 항목을 삭제하세요.

목 인증은 토큰 대신 개발용 로그인 여부만 `sessionStorage`에 저장하여 쿠키 API의 응답 계약을 재현합니다. 실제 HttpOnly 쿠키를 구현하는 기능은 아니며 운영 빌드에서는 사용하지 않습니다.

### 백엔드 연결

`VITE_AUTH_MOCK=false`로 설정합니다. Google 로그인 시작 주소는 기본적으로
`/oauth2/authorization/google`이며 필요하면 `VITE_GOOGLE_AUTH_URL`로 지정합니다.
OAuth state·Google 인증 코드 교환·ID 토큰 검증·JWT 쿠키 설정은 모두 백엔드가 담당합니다.
프론트에는 Google 비밀 키나 앱 교환 코드가 필요하지 않습니다.

백엔드 `oauth2.redirect-home`을 프론트의 `/auth/callback` 주소로 설정해야 합니다.
로컬에서는 `http://localhost:5173/auth/callback`, 운영에서는
`https://codeiary.com/auth/callback`입니다. Google에 등록할 승인된 리디렉션 URI는
서버 콜백인 `/login/oauth2/code/google` 경로이며, 로컬 프록시를 사용하면
`http://localhost:5173/login/oauth2/code/google`로 설정합니다.
운영은 `https://codeiary.com/login/oauth2/code/google`입니다.
인증 쿠키의 SameSite=Strict 설정에 맞게 프론트와 API는 같은 사이트에서 서비스합니다.

| 요청 | API 경로 | 계약 |
| --- | --- | --- |
| GET | `/api/users/me` | 인증 쿠키로 현재 사용자 프로필 조회 |
| POST | `/api/auth/reissue` | 본문 없이 Refresh Token 쿠키 전송, 204 및 새 인증 쿠키 |
| POST | `/api/auth/logout` | 본문 없이 인증 쿠키 전송, 204 및 쿠키 삭제 |
| GET | `/api/admin/me` | ADMIN 권한 확인 및 사용자 프로필 조회 |

프론트는 401 응답을 받으면 재발급 요청을 한 번 공유하여 처리하고 원래 요청을 재시도합니다.
로그아웃은 서버의 쿠키 삭제·토큰 폐기를 확인한 뒤 사용자 상태를 비웁니다.

온보딩 화면은 다음 API를 사용하도록 준비되어 있으며 **백엔드 구현은 별도로 필요합니다.**

- `GET /api/users/nickname-availability?nickname=...` → `{ available: boolean }`.
- `POST /api/users/me/onboarding` → `multipart/form-data`의 `nickname`, 선택 `profileImage`를 받고 완성된 사용자 프로필을 반환합니다. 중복은 `409 / NICKNAME_TAKEN`으로 응답합니다.

프로필은 `id`, `email`, `name`, `nickname`, `profileImageUrl`, `onboardingCompleted`, `role`을 포함합니다.
현재 백엔드 Google 로그인은 이미 등록된 활성 계정만 허용하며 신규 가입도 별도 구현이 필요합니다.

## 검증

```sh
npm test
npm run build
```

OAuth 복귀·쿠키 세션 복원 및 재발급·로그아웃 실패·온보딩·관리자 라우트 보호를 검증합니다.
CI에서도 테스트 통과 후 타입 검사와 프로덕션 빌드를 실행합니다.

## Lightsail 배포

`main` 브랜치에 push하면 GitHub Actions가 정적 파일을 Docker 이미지로 패키징해
Amazon ECR Public에 게시하고, SSM Run Command로 `/var/www/codeiary`와 Nginx 설정을 배포합니다.

GitHub Actions repository variables:

- `AWS_ROLE_ARN`, `AWS_REGION`, `SSM_INSTANCE_ID`

Access Key는 저장하지 않고 GitHub OIDC로 프론트 전용 IAM 역할을 사용합니다.
Cloudflare의 루트 및 `www` 레코드는 Lightsail 고정 IP를 가리키고 프록시를 켭니다.
서버는 Certbot의 Let’s Encrypt 인증서를 `/etc/letsencrypt/live/codeiary.com`에서 사용하며,
SSL/TLS 모드는 `Full (strict)`로 설정합니다.
