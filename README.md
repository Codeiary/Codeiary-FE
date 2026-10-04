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
- 건물, 건물 이름표, 미니맵의 건물을 클릭하면 충돌을 피해 자동으로 걸어갑니다.
- 화면 드래그: 시점 회전 / 마우스 휠: 확대·축소
- 오른쪽 도구: 낮·밤 전환. 사이트는 항상 무음입니다.
- 홈 로고: 시점 초기화 / 상단의 '이 동네에 대해': 조작 안내
- 모바일: 화면 오른쪽 아래의 방향 버튼으로 이동
- 상단 메뉴에서도 각 콘텐츠 창을 바로 열 수 있으며, Escape로 닫을 수 있습니다.

블로그 검색·분류, 글 상세 보기, 프로젝트 상세 보기, IT 이슈 상세 보기는
목업 데이터를 사용합니다. 관리자 로그인과 실제 뉴스 피드는 포함하지 않습니다.

도시 모델과 간판은 코드로 생성합니다. 외부 3D 모델을 내려받을 필요가 없습니다.
`src/city/world.ts`는 3D 장면과 조작, `src/city/navigation.ts`는 충돌과 경로 탐색,
`src/App.vue`는 화면과 샘플 콘텐츠를 담당합니다.

WebGL을 사용할 수 없는 환경에서는 상단 메뉴로 콘텐츠를 볼 수 있습니다.

API 요청은 운영 환경에서 같은 오리진의 `/api`를 사용합니다. 개발 서버에서는
`vite.config.ts`가 `/api` 요청을 `http://localhost:8080`으로 프록시합니다.

## Lightsail 배포

`main` 브랜치에 push하면 GitHub Actions가 정적 파일을 Docker 이미지로 패키징해
Amazon ECR Public에 게시하고, SSM Run Command로 `/var/www/codeiary`와 Nginx 설정을 배포합니다.

GitHub Actions repository variables:

- `AWS_ROLE_ARN`, `AWS_REGION`, `SSM_INSTANCE_ID`

Access Key는 저장하지 않고 GitHub OIDC로 프론트 전용 IAM 역할을 사용합니다.
Cloudflare의 루트 및 `www` 레코드는 Lightsail 고정 IP를 가리키고 프록시를 켭니다.
서버는 Certbot의 Let’s Encrypt 인증서를 `/etc/letsencrypt/live/codeiary.com`에서 사용하며,
SSL/TLS 모드는 `Full (strict)`로 설정합니다.
