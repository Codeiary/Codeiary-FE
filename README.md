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
목업 데이터를 사용합니다. Google 로그인은 프론트 미리보기 단계이며, 실시간 뉴스 피드는 포함하지 않습니다.

도시 모델과 간판은 코드로 생성합니다. 외부 3D 모델을 내려받을 필요가 없습니다.
`src/city/world.ts`는 3D 장면과 조작, `src/city/navigation.ts`는 충돌과 경로 탐색,
`src/CityApp.vue`는 화면과 샘플 콘텐츠를 담당합니다.

WebGL을 사용할 수 없는 환경에서는 상단 메뉴로 콘텐츠를 볼 수 있습니다.

API 요청은 운영 환경에서 같은 오리진의 `/api`를 사용합니다. 개발 서버에서는
`vite.config.ts`가 `/api` 요청을 `http://localhost:8080`으로 프록시합니다.

## Google 로그인 / 온보딩

- `/login`: Google 로그인만 표시하며 기존 이메일·비밀번호 로그인은 제거했습니다.
- `/auth/callback`: 서버의 일회용 교환 코드와 로그인 상태를 확인한 뒤 JWT 세션을 시작합니다.
- `/onboarding`: 선택 사진과 필수 닉네임을 설정합니다. 닉네임은 한글·영문·숫자·밑줄 2~20자이며, 입력 중 중복 확인과 저장 시 중복 거절을 처리합니다.
- 프로필 사진은 10MB 이하이며 브라우저에서 256px 정사각형 JPEG로 변환합니다. HEIC/HEIF는 브라우저가 읽을 수 있는 경우에만 처리하고, 지원하지 않으면 JPG/PNG를 안내합니다.
- 기존 JWT 갱신·로그아웃·관리자 확인을 유지합니다. 액세스 토큰은 메모리, 리프레시 토큰은 탭의 `sessionStorage`에 저장합니다.

### 프론트 미리보기

`npm run dev`에서는 기본적으로 목 응답으로 Google 버튼 → 신규 온보딩 → 로그인 상태를 확인할 수 있습니다. 실제 Google 계정에 연결되지 않습니다. `Codeiary`, `관리자`, `커밋여행자`, `프론트노트`는 중복 닉네임 예시입니다. 작성한 프로필은 이 브라우저에 저장되고, 다음 로그인에는 온보딩을 건너뜁니다. 새 사용자를 다시 확인하려면 개발자 도구에서 `codeiary.oauth.mock.profile` 로컬 저장 항목을 삭제하세요.

### 백엔드 연결 계약 (아직 구현되지 않음)

`VITE_AUTH_MOCK=false`, `VITE_GOOGLE_AUTH_URL`을 설정합니다. 운영 빌드는 목 인증을 포함하지 않으며 시작 URL이 없으면 연결 준비 안내를 표시합니다. 비밀 키는 프론트에 넣지 않습니다.

1. 시작 URL로 전체 페이지 이동: `client_state`와 프론트 `/auth/callback` 주소를 전달합니다. 백엔드가 Google OAuth state/PKCE 또는 해당 서버 흐름의 CSRF 보호, Google 코드 교환과 ID 토큰 검증을 담당해야 합니다. 프론트의 `client_state` 확인은 이를 대체하지 않습니다.
2. 백엔드는 허용된 callback으로 `code`(짧은 수명의 1회용 앱 교환 코드)와 `state`(시작 시 `client_state`)를 반환합니다. JWT를 URL에 담지 않습니다.
3. `POST /auth/oauth2/exchange` `{ code, state }` → 기존 JWT 응답 형식과 `user.onboardingCompleted` 불리언을 반환합니다. 기존 사용자도 이 필드를 명시하고, 미완료 계정의 일반 API 접근은 서버에서도 제한해야 합니다.
4. `GET /users/nickname-availability?nickname=...` → `{ available: boolean }`.
5. `POST /users/me/onboarding` → 인증된 `multipart/form-data`의 `nickname`, 선택 `profileImage`를 받고 완성된 UserProfile을 반환합니다. 중복 시 `409 / NICKNAME_TAKEN`; 최종 중복 보장은 DB의 고유 제약으로 처리해야 합니다.

위 경로는 프론트 연결용 제안이며 백엔드 구현 시 계약을 확정해야 합니다. [Google 서버 OAuth 문서](https://developers.google.com/identity/protocols/oauth2/web-server), [로그인 버튼 가이드](https://developers.google.com/identity/branding-guidelines)를 참고했습니다.

## 검증

```sh
npm test
npm run build
```

OAuth 복귀·JWT 갱신·로그아웃 실패·온보딩·관리자 라우트 보호를 검증합니다.
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
