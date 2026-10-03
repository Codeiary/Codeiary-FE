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

API 요청은 운영 환경에서 같은 오리진의 `/api`를 사용합니다. 개발 서버에서는
`vite.config.ts`가 `/api` 요청을 `http://localhost:8080`으로 프록시합니다.

## Lightsail 배포

`main` 브랜치에 push하면 GitHub Actions가 정적 파일을 S3에 업로드하고 SSM Run
Command로 `/var/www/codeiary`에 배포한 뒤 Nginx 설정을 반영합니다.

GitHub Actions repository variables:

- `AWS_ROLE_ARN`, `AWS_REGION`, `SSM_INSTANCE_ID`, `FE_DEPLOY_BUCKET`

Access Key는 저장하지 않고 GitHub OIDC로 프론트 전용 IAM 역할을 사용합니다.
Cloudflare Origin Certificate는 서버의 `/etc/ssl/codeiary`에 설치합니다. DNS의 루트와 `www`
레코드는 Lightsail 고정 IP로 프록시하고 SSL/TLS 모드는 `Full (strict)`로 설정합니다.
