# Deep Work 오픈소스 패키징 계획

## 배경

Deep Work는 AI 네이티브 QA 워크플로우 플랫폼으로, Chrome 확장 프로그램으로 버그를 캡처하고 웹 대시보드에서 관리하는 도구입니다. 현재 Phase 1 MVP 상태이며, 기업의 QA 매니저/PM이 맥미니 같은 장비에 설치하여 사내 도구로 활용할 수 있도록 오픈소스로 패키징하는 것이 목표입니다.

**핵심 원칙**: 통계/분석 기능 추가 없이, 엔드유저가 실제로 사용할 때 부딪히는 제약사항만 해결합니다.

---

## 사용 시나리오

### 설치 (IT 담당자가 맥미니에서 1회 수행)

터미널에서 한 줄만 실행하면 됩니다:

```bash
curl -fsSL https://github.com/.../install.sh | bash
```

설치 스크립트가 자동으로 처리하는 일:
1. Homebrew가 없으면 설치 (Mac 표준 패키지 관리자)
2. Node.js 설치
3. Deep Work 코드 다운로드, 빌드, 실행
4. 맥미니 재시작 시 자동 실행 등록 (macOS launchd)
5. 완료 후 접속 주소 출력 (예: `http://192.168.1.50:3000`)

> Docker를 선호하는 환경에서는 `docker compose up` 으로도 설치할 수 있습니다 (선택 옵션).

### 팀원 셋업 (각자 PC에서 1회)

1. 전달받은 확장 프로그램 파일을 Chrome에 설치
2. 확장 프로그램 설정에서 서버 주소 입력 (예: `192.168.1.50`)

### 일상 사용 (매일)

1. 테스트 중 버그 발견 → Deep Work 아이콘 클릭 → 영역 드래그 → 자동 리포트 생성
2. 웹 대시보드에서 버그 현황 확인, 필터링, 상태 관리

---

## 계정 시스템: 불필요

사내 맥미니 셀프호스팅 시나리오에서는 네트워크 수준의 접근 제어(방화벽, VPN)가 보안 경계 역할을 합니다. 현재 스키마에 org/user/project 구조가 이미 있으므로 나중에 필요하면 추가 가능합니다. 대신 **선택적 API Key** 미들웨어(~20줄)를 추가하여 최소한의 보호를 제공합니다.

---

## 추가 유즈케이스: 현재로는 불필요

현재 UC1(버그 리포팅), UC2(세션 리플레이), UC3(비주얼 리그레션)이 있습니다.

- UC1(버그 리포팅)이 핵심 가치이고, 이것만 제대로 동작하면 MVP로 충분
- UC2, UC3는 부분적으로 구현되어 있어 bonus feature로 제공 가능
- 데이터 export(CSV/JSON) 등은 출시 후 피드백을 받아 추가

---

## 엔드유저 제약사항 및 해결 계획

### P0: 기본 기능이 동작하지 않는 문제

#### 1. 스크린샷이 data URL로 SQLite에 직접 저장됨

- **현재**: 확장 프로그램이 캡처한 스크린샷을 base64 data URL로 API에 전송 → SQLite JSON 컬럼에 그대로 저장
- **문제**: 스크린샷당 수백KB~수MB → DB가 빠르게 비대해지고 성능 저하 → 실사용 불가
- **해결**: 파일 업로드 엔드포인트 추가, `data/uploads/` 디렉토리에 PNG 파일로 저장, URL 경로만 DB에 저장
- **관련 파일**:
  - `packages/api/src/app.ts` — 업로드 라우트 및 정적 파일 서빙 추가
  - `packages/api/src/routes/bug-reports.ts` — 스크린샷 저장 로직 변경
  - `packages/extension/src/background/index.ts` — 파일 업로드 방식으로 변경

#### 2. 확장 프로그램의 API URL이 localhost로 하드코딩

- **현재**: `background/index.ts:4`에 `http://localhost:3001/v1` 하드코딩, 대시보드 링크도 `localhost:3000` (라인 631, 651)
- **문제**: 맥미니(예: 192.168.1.50)에 배포 시 다른 PC 브라우저의 확장 프로그램이 API에 접속 불가
- **해결**: `chrome.storage.sync`에서 서버 URL을 읽도록 변경, 확장 프로그램에 간단한 설정 페이지(Options page) 추가
- **관련 파일**:
  - `packages/extension/src/background/index.ts` — 동적 URL 로딩
  - 새 파일: Options 페이지 (서버 URL 입력 폼)

#### 3. 프로덕션 프로세스 관리 없음

- **현재**: `scripts/start-*.sh`에 asdf 전용 노드 경로 하드코딩, 재시작/장애 복구 없음
- **해결**:
  - **기본**: 원클릭 설치 스크립트 (`install.sh`) — Homebrew + Node.js + pm2 + launchd 자동 설정
  - **옵션**: Docker Compose (`docker-compose.yml`) — 컨테이너 기반 배포
- **관련 파일**:
  - 새 파일: `install.sh` — 설치 스크립트
  - 새 파일: `docker-compose.yml`, `packages/api/Dockerfile`, `packages/web/Dockerfile`

#### 4. DB 경로 하드코딩

- **현재**: `packages/api/src/db/index.ts:11`에서 `../../dev.db`로 고정
- **해결**: `DB_PATH` 환경변수로 설정 가능하게 변경
- **관련 파일**: `packages/api/src/db/index.ts`

---

### P1: 사용성 저하 문제

#### 5. 데모 시드 데이터가 항상 생성됨

- **현재**: 서버 시작 시 `seedDemoSessions()`, `seedDemoBaselines()` 항상 실행 → 운영 DB에 더미 데이터 오염
- **해결**: `SEED_DEMO_DATA=true` 환경변수로 게이팅, 기본 org/project/user만 항상 생성
- **관련 파일**: `packages/api/src/db/seed.ts`

#### 6. UI 언어 혼재

- **현재**: 대시보드/사이드바는 한국어, 테이블 헤더/일부 컴포넌트는 영어
- **해결**: 오픈소스 릴리스를 위해 영어로 통일
- **관련 파일**: `packages/web/src/app/page.tsx`, `packages/web/src/app/layout.tsx`, 기타 UI 파일들

#### 7. 환경 설정 가이드 없음

- **현재**: `.env.example` 없음, 설정 가능한 환경변수를 소스 코드를 읽어야 알 수 있음
- **해결**: `.env.example` 생성
  - `PORT`, `DB_PATH`, `NEXT_PUBLIC_API_URL`, `VITE_API_URL`, `SEED_DEMO_DATA`, `DEEP_WORK_API_KEY`, `CORS_ORIGIN`

#### 8. 선택적 API Key 인증

- **해결**: `DEEP_WORK_API_KEY` 환경변수가 설정되면 `X-API-Key` 헤더 검증 미들웨어 추가
- **관련 파일**: `packages/api/src/app.ts`

#### 9. CORS 전면 개방

- **현재**: `app.use('*', cors())` → 네트워크의 모든 출처에서 접근 가능
- **해결**: `CORS_ORIGIN` 환경변수로 허용 출처 설정 가능하게 변경
- **관련 파일**: `packages/api/src/app.ts`

---

## 구현 순서

| 순서 | 작업 | 규모 |
|------|------|------|
| 1 | DB 경로 환경변수화 (`DB_PATH`) | 소 |
| 2 | 데모 시드 데이터 환경변수 게이팅 | 소 |
| 3 | 스크린샷 파일 저장 시스템 (업로드 엔드포인트 + 정적 파일 서빙) | 중 |
| 4 | 확장 프로그램 서버 URL 설정 페이지 (Options page + chrome.storage) | 중 |
| 5 | 선택적 API Key 미들웨어 + CORS 설정 | 소 |
| 6 | `.env.example` 생성 | 소 |
| 7 | 원클릭 설치 스크립트 (`install.sh`) | 중 |
| 8 | Docker Compose 패키징 (선택 옵션) | 중 |
| 9 | UI 영어 통일 | 소 |
| 10 | start 스크립트에서 asdf 경로 제거 | 소 |
| 11 | README.md (설치 가이드, 아키텍처) | 중 |

---

## 검증 방법

1. 설치 스크립트 실행 후 API + Web 서버 정상 기동 확인
2. 다른 PC에서 Chrome 확장 프로그램 설치 → 서버 URL 설정 → 버그 캡처 → 스크린샷이 대시보드에 표시되는지 확인
3. 맥미니 재시작 후 서버 자동 실행 확인
4. API Key 설정 시 인증 없는 요청 차단 확인
5. 기존 E2E 테스트 (`pnpm test:e2e`) 통과 확인
