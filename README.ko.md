# Deep Work for QA

[English README](./README.md)

AI 네이티브 QA 워크플로우 플랫폼. Chrome 확장 프로그램으로 버그를 캡처하고, 웹 대시보드에서 관리합니다.

## 주요 기능

- **버그 리포팅** — Chrome 확장 프로그램이 스크린샷, 콘솔 로그, 네트워크 요청, 브라우저 환경 정보를 한 번의 클릭으로 캡처
- **AI 분석** — 캡처된 이벤트를 기반으로 재현 단계를 자동 생성
- **비주얼 리그레션 테스트** — 스크린샷을 베이스라인과 픽셀 단위로 비교 분석
- **웹 대시보드** — 버그 리포트 조회, 필터링, 상태 관리

## 스크린샷

| 버그 리포트 작성 | 버그 리포트 상세 | 대시보드 |
|:---:|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/c6ed82c5-b9ae-4cfe-aea2-c232531ebce6" width="300"> | <img src="https://github.com/user-attachments/assets/818e8e62-fe1f-44e2-8412-0335a7fe5ad7" width="300"> | <img src="https://github.com/user-attachments/assets/9b172644-d455-4bd2-9d5c-cab576a57296" width="300"> |

## 아키텍처

```
Chrome 확장 프로그램 (Manifest V3)
  └─ 스크린샷, 로그, 이벤트 캡처
       ↓ HTTP
API 서버 (Hono + SQLite)
  └─ 리포트 저장, AI 분석 실행
       ↓
웹 대시보드 (Next.js)
  └─ 버그 리포트 조회 및 관리
```

**기술 스택**: TypeScript, Hono, SQLite (Drizzle ORM), Next.js 15, React 19, Tailwind CSS 4, Vite

## 빠른 시작

### 방법 A: 설치 스크립트 (추천)

```bash
curl -fsSL https://raw.githubusercontent.com/jinjin1/Deep-work-for-QA/main/install.sh | bash
```

아래 과정을 자동으로 처리합니다:
- 필수 도구 설치 (Node.js, pnpm, pm2)
- 프로젝트 클론 및 빌드
- API + Web 서버를 pm2로 시작 (재부팅 시 자동 실행)
- `.env` 파일에 로컬 IP 자동 설정

설치 후 Chrome 확장 프로그램을 등록하세요:

1. Chrome에서 `chrome://extensions` 접속
2. **개발자 모드** 활성화
3. **압축 해제된 확장 프로그램 로드** 클릭 → 설치 완료 메시지에 표시된 경로 선택 (예: `~/deep-work-for-qa/packages/extension/dist`)
4. 확장 프로그램 아이콘 우클릭 > **옵션** → 설치 완료 메시지에 표시된 서버 IP 입력

### 방법 B: Docker Compose

```bash
git clone https://github.com/jinjin1/Deep-work-for-QA.git
cd Deep-work-for-QA
cp .env.example .env
# .env 파일에서 서버 IP를 설정하세요
docker compose up -d
```

### 방법 C: 수동 개발 환경 설정

```bash
git clone https://github.com/jinjin1/Deep-work-for-QA.git
cd Deep-work-for-QA
pnpm install
cp .env.example .env
pnpm dev          # API (포트 3001) + Web (포트 3000) 시작
```

개발 환경에서 Chrome 확장 프로그램 설정:

1. `pnpm --filter @deep-work/extension build`
2. Chrome에서 `chrome://extensions` 접속 → **개발자 모드** 활성화
3. **압축 해제된 확장 프로그램 로드** 클릭 → `packages/extension/dist` 선택
4. 확장 프로그램 아이콘 우클릭 > **옵션** → 서버 IP 설정

## 환경 설정

`.env.example`을 `.env`로 복사한 후 설정하세요:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | API 서버 포트 |
| `DB_PATH` | `./data/deep-work.db` | SQLite 데이터베이스 파일 경로 |
| `UPLOADS_DIR` | `./data/uploads` | 스크린샷 파일 저장 디렉토리 |
| `SEED_DEMO_DATA` | `false` | `true`로 설정하면 데모 데이터 생성 |
| `DEEP_WORK_API_KEY` | _(비어있음)_ | 선택적 API 키 인증 |
| `CORS_ORIGIN` | _(비어있음)_ | 허용할 CORS 오리진 (쉼표 구분), 비어있으면 `*` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/v1` | 웹 대시보드에서 사용할 API URL |

> **참고**: 설치 스크립트(방법 A)를 사용하면 `.env`가 로컬 IP 주소로 자동 설정됩니다.

## 팀 사용법

여러 팀원이 같은 서버에 버그를 리포트할 수 있습니다. **서버는 한 명만** 실행하면 되고, 나머지 팀원은 Chrome 확장 프로그램만 설치하면 됩니다.

### 같은 Wi-Fi 네트워크

팀원이 해야 할 것:

1. Chrome 확장 프로그램 설치 (`packages/extension/dist` 로드)
2. 확장 프로그램 옵션에서 서버 IP를 호스트 컴퓨터의 IP로 설정 (예: `192.168.1.50`)

### 원격 / 다른 네트워크

[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (무료)을 사용하면 로컬 서버를 외부에 노출할 수 있습니다:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3001
# 출력: https://xxx-xxx.trycloudflare.com
```

팀원은 로컬 IP 대신 터널 URL을 확장 프로그램 옵션에 입력하면 됩니다.

## 프로젝트 구조

```
packages/
  api/          — 백엔드 API (Hono + SQLite)
  web/          — 웹 대시보드 (Next.js)
  extension/    — Chrome 확장 프로그램 (Vite + CRXJS)
  shared/       — 공유 TypeScript 타입
e2e/            — Playwright E2E 테스트
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | API + Web 개발 모드로 시작 |
| `pnpm dev:all` | API + Web + 확장 프로그램 모두 시작 |
| `pnpm build` | 모든 패키지 빌드 |
| `pnpm test:e2e` | Playwright E2E 테스트 실행 |
| `pnpm typecheck` | TypeScript 타입 체크 |
| `pnpm lint` | 모든 패키지 린트 |
| `pnpm db:reset` | 데이터베이스 삭제 (재시작 시 다시 생성) |

## 라이선스

MIT
