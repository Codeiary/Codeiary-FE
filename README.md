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
목업 데이터를 사용하며, 실시간 뉴스 피드는 포함하지 않습니다. Google 로그인은 백엔드 OAuth2·쿠키 인증을 사용합니다.

도시 모델과 간판은 코드로 생성합니다. 외부 3D 모델을 내려받을 필요가 없습니다.
`src/city/world.ts`는 3D 장면과 조작, `src/city/navigation.ts`는 충돌과 경로 탐색,
`src/CityApp.vue`는 화면과 샘플 콘텐츠를 담당합니다.

WebGL을 사용할 수 없는 환경에서는 상단 메뉴로 콘텐츠를 볼 수 있습니다.

API 요청은 운영 환경에서 같은 오리진의 `/api`를 사용합니다. 개발 서버에서는
`server/index.mjs`가 `/api`, `/oauth2`, `/login/oauth2` 요청을 `http://localhost:8080`으로 프록시합니다.
운영 Nginx도 같은 OAuth 시작·콜백 경로를 백엔드에 전달합니다.

## Google 로그인 / 온보딩

- `/login`: Google 로그인만 표시하며 기존 이메일·비밀번호 로그인은 제거했습니다.
- `/auth/callback`: 백엔드가 로그인 쿠키를 설정한 뒤 복귀하는 화면입니다. `GET /api/users/me`로 현재 사용자를 확인하고 온보딩 또는 원래 화면으로 이동합니다.
- `/onboarding`: 필수 닉네임만 설정합니다. 닉네임은 한글·영문·숫자·밑줄 2~20자이며, 입력 중 중복 확인과 저장 시 중복 거절을 처리합니다. 신규 사용자는 `PENDING`이고 저장 후 `USER`로 전환됩니다.
- 내 집의 프로필 수정에서 닉네임·선택 프로필 사진·GitHub 주소·공개 연락 이메일을 설정합니다. 닉네임 입력 중 중복 여부를 표시하며, 중복 또는 확인 실패 상태에서는 저장할 수 없습니다. 본인의 집에서만 편집할 수 있으며, 로그인 이메일은 공개 연락처에 자동으로 넣지 않습니다. 사진 선택 후 미리보기·변경·삭제가 가능하며, 저장을 누르면 사진 업로드 후 프로필을 갱신합니다.
- 인증 요청은 `credentials: "include"`로 쿠키를 전송합니다. 프론트는 JWT를 읽거나 저장하지 않으며 Authorization 헤더를 만들지 않습니다. 로그인 시작 시 `sessionStorage`에는 안전한 복귀 주소와 시작 시각만 저장합니다. 실제 로그인은 저장소가 차단되어도 진행하고, 복귀 정보가 없으면 홈으로 이동합니다.

### 백엔드 연결

Google 로그인 시작 주소는 기본적으로 `/oauth2/authorization/google`이며 필요하면
`VITE_GOOGLE_AUTH_URL`로 지정합니다.
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

온보딩과 내 집 프로필 설정은 다음 API를 사용합니다. 백엔드 [사용자 온보딩 이슈 #17](https://github.com/Codeiary/Codeiary-BE/issues/17) 구현을 함께 적용해야 합니다.

- `GET /api/users/nickname-availability?nickname=...` → `{ available: boolean }`.
- `POST /api/users/me/onboarding` → `multipart/form-data`의 `nickname`만 받고 온보딩이 완료된 사용자 프로필을 반환합니다. 중복은 `409 / NICKNAME_TAKEN`으로 응답합니다.
- 선택한 원본은 브라우저에서 256×256 JPEG로 변환하며, 프로필 업로드는 1MiB 이하로 제한합니다.
- `POST /api/images/presigned-url`에 `{ contentType, contentLength }`를 인증 쿠키와 함께 보내고 `{ uploadUrl, imageUrl, headers, expiresAt }`를 받습니다. 서버의 공통 이미지 계약은 JPG·PNG 10MiB 이하입니다.
- 로컬 업로드는 백엔드 폴더에서 `docker compose -f compose.local.yaml up -d`로 S3Mock을 실행합니다. 개발 서버에서만 `http://localhost:9090/codeiary-local/` 이미지 주소를 허용하며, 운영 빌드는 HTTPS만 허용합니다.
- 파일은 발급받은 HTTPS `uploadUrl`에 `PUT`으로 직접 전송합니다. 서버가 지정한 `Content-Type` 등 업로드 헤더만 사용하고 쿠키·Authorization 헤더를 보내지 않습니다. 파일 전송 제한 시간은 60초이며, 실패해도 토큰 재발급이나 자동 재전송을 하지 않습니다.
- S3 전송 성공 후 CloudFront `imageUrl`을 기존 프로필 수정 요청에 포함합니다. 주소 발급이나 파일 전송만으로 사용자 프로필을 바꾸지 않습니다. S3 CORS에는 프론트 오리진의 `PUT`과 업로드 헤더가 허용되어야 합니다.
- `PUT /api/users/me/profile` → JSON의 `nickname`, `profileImageUrl`, `githubUrl`, `contactEmail`을 저장하고 갱신된 본인 프로필을 반환합니다. 비워 둔 선택 항목은 `null`로 보내 삭제합니다. `PENDING` 계정은 사용할 수 없습니다.

프로필은 `id`, `email`, `name`, `nickname`, `profileImageUrl`, `githubUrl`, `contactEmail`, `onboardingCompleted`, `role`을 포함합니다.
온보딩을 완료하지 않고 나가도 다시 로그인하면 `onboardingCompleted: false`를 확인해 온보딩 화면으로 이동합니다.

## 검증

```sh
npm test
npm run build
```

OAuth 복귀·쿠키 세션 복원 및 재발급·로그아웃 실패·온보딩·관리자 라우트 보호를 검증합니다.
CI에서도 테스트 통과 후 타입 검사와 프로덕션 빌드를 실행합니다.

## Lightsail 배포

`main` 브랜치에 push하면 GitHub Actions가 클라이언트·SSR 번들을 Docker 이미지로 패키징해
Amazon ECR Public에 게시합니다. SSM Run Command로 정적 파일은 `/var/www/codeiary`에 복사하고,
Node 서버는 `codeiary-fe` 컨테이너로 실행합니다. Nginx는 `/blog` 요청만 내부 `127.0.0.1:3000`으로 전달합니다.
API·OAuth는 기존 백엔드로, 나머지 화면과 정적 자산은 기존 Nginx 경로로 제공합니다.
정적 파일만 교체하면 SSR은 동작하지 않으므로 Docker·Nginx 설정도 함께 배포해야 합니다.

### 블로그 SSR

- `/blog`: 공개 글 12개와 페이지 링크를 서버에서 렌더링하고 브라우저에서 hydrate합니다.
- `/blog?page=2` 이후: CSR이며 최초 응답의 robots 메타 태그와 `X-Robots-Tag`에 `noindex, nofollow`를 설정합니다.
- `/blog?page=1`은 `/blog`로 리다이렉트합니다. 각 페이지의 canonical은 해당 페이지 주소입니다.
- 검색·정렬 결과도 색인에서 제외합니다. SPA 이동 시 메타 태그를 갱신하고 다른 화면으로 나가면 제거합니다.
- 서버는 인증 쿠키를 전달하지 않고 공개 목록만 조회합니다. 로그인 상태와 테마는 hydration 후 브라우저에서 복구합니다.
- 공개 API 장애 시 빈 목록을 200으로 색인시키지 않도록 503을 반환합니다.
- robots.txt는 페이지네이션을 차단하지 않습니다. 검색엔진이 응답의 `noindex`를 읽을 수 있어야 합니다.
- 현재 sitemap.xml은 홈과 블로그 목록만 포함합니다. 후속 페이지의 `nofollow`로 제한되는 글 탐색은 공개 게시글 사이트맵을 추가해 보완할 수 있습니다.

로컬 개발은 `npm run dev`(5173), 빌드 결과 확인은 `npm run build && npm run preview`(3000)를 사용합니다.
`API_ORIGIN`은 백엔드 주소(기본 `http://localhost:8080`), `PORT`와 `HOST`는 프론트 서버 바인딩 설정입니다.
Google OAuth 로컬 콜백은 5173에 등록되어 있으므로 인증을 확인할 때는 개발 서버를 사용합니다.

GitHub Actions repository variables:

- `AWS_ROLE_ARN`, `AWS_REGION`, `SSM_INSTANCE_ID`

Access Key는 저장하지 않고 GitHub OIDC로 프론트 전용 IAM 역할을 사용합니다.
Cloudflare의 루트 및 `www` 레코드는 Lightsail 고정 IP를 가리키고 프록시를 켭니다.
서버는 Certbot의 Let’s Encrypt 인증서를 `/etc/letsencrypt/live/codeiary.com`에서 사용하며,
SSL/TLS 모드는 `Full (strict)`로 설정합니다.
