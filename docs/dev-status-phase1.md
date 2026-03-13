# Deep Work Phase 1 MVP — 개발 현황 정리

> 작성일: 2026-03-12
> 상태: UC1 E2E 플로우 완성, UC2/UC3 기반 구조 구축

---

## 1. 전체 아키텍처

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Chrome Extension    │────▶│   REST API        │◀────│   Web Dashboard     │
│  (Vite + React)      │     │   (Hono + SQLite) │     │   (Next.js 15)      │
│  Port: 5173 (dev)    │     │   Port: 3001      │     │   Port: 3000        │
└─────────────────────┘     └──────────────────┘     └─────────────────────┘
         │                          │
         │ Event Capture            │ Mock AI Pipeline
         │ Console/Network Logs     │ (추후 Claude API 교체)
         ▼                          ▼
   Content Script              AI Route (/v1/ai/*)
   Background SW               generateMockReproSteps()
```

**모노레포 구조:** pnpm workspaces

| 패키지 | 역할 | 기술 스택 |
|--------|------|----------|
| `packages/api` | 백엔드 REST API | Hono, Drizzle ORM, better-sqlite3 |
| `packages/web` | 관리 대시보드 | Next.js 15, React 19, Tailwind CSS v4 |
| `packages/extension` | 브라우저 확장 | Vite, CRXJS, React 19, Manifest V3 |
| `packages/shared` | 공유 타입 정의 | TypeScript |

---

## 2. UC1: AI 버그 리포터 — 구현 완료 ✅

### 2.1 Extension (버그 캡처 + 리포트 작성)

| 컴포넌트 | 상태 | 설명 |
|---------|------|------|
| Content Script | ✅ 완료 | click, input 이벤트 캡처 |
| Console Capture | ✅ 완료 | console.error/warn 인터셉트 |
| Network Capture | ✅ 완료 | PerformanceObserver로 리소스 모니터링 |
| Background SW | ✅ 완료 | 메시지 라우팅, 데이터 저장, 스크린샷 |
| Popup UI | ✅ 완료 | 녹화 시작/중지, 스크린샷 캡처 버튼 |
| SidePanel UI | ✅ 완료 | 버그 리포트 폼 (제목, 설명, 심각도) |
| API Client | ✅ 완료 | createBugReport, generateReproSteps |
| 프로덕션 빌드 | ✅ 완료 | `dist/` 생성, Chrome 로드 가능 |

### 2.2 API (버그 리포트 CRUD + AI)

| 엔드포인트 | 메서드 | 상태 | 설명 |
|-----------|--------|------|------|
| `/v1/bug-reports` | GET | ✅ | 목록 조회 (페이지네이션: page, limit) |
| `/v1/bug-reports/:id` | GET | ✅ | 단건 조회 |
| `/v1/bug-reports` | POST | ✅ | 생성 + 비동기 AI 분석 트리거 |
| `/v1/bug-reports/:id` | PUT | ✅ | 수정 (title, description, severity, status) |
| `/v1/bug-reports/:id` | DELETE | ✅ | 삭제 |
| `/v1/ai/repro-steps` | POST | ✅ | AI 재현 스텝 생성 (Mock) |

**AI 분석 플로우:**
1. POST 생성 시 `aiAnalysisStatus: 'pending'`
2. 비동기로 `processing` → `generateMockReproSteps()` → `completed`
3. 이벤트 타입별 자연어 스텝 생성 (click, input, navigate, scroll, error 등)
4. object/string 타겟 모두 처리 (`resolveTargetLabel()`)

### 2.3 Web Dashboard (버그 리포트 뷰)

| 페이지 | 상태 | 설명 |
|--------|------|------|
| 대시보드 (`/`) | ✅ 완료 | StatCard 3개 + 최근 버그/세션 |
| 버그 목록 (`/bug-reports`) | ✅ 완료 | 필터(상태/심각도), 테이블 |
| 버그 상세 (`/bug-reports/[id]`) | ✅ 완료 | 전체 정보 + AI 분석 + 로그 |
| 레이아웃 | ✅ 완료 | 사이드바 네비게이션 (4개 메뉴) |

---

## 3. UC2: 세션 리플레이 — 기반 구조 구축 🔧

| 항목 | 상태 | 설명 |
|------|------|------|
| 타입 정의 | ✅ 완료 | Session, Anomaly, AnomalyType |
| DB 스키마 | ✅ 완료 | sessions 테이블 |
| API CRUD | ✅ 완료 | GET/POST/PUT /v1/sessions |
| 웹 목록 페이지 | ✅ 완료 | 세션 테이블 (URL, 시간, 이벤트 수) |
| Extension 세션 탭 | 🔧 스텁 | "세션 녹화 시작" 버튼만 |
| 이벤트 녹화 저장 | ❌ 미구현 | 녹화 파일 저장 로직 |
| 리플레이 플레이어 | ❌ 미구현 | 녹화 재생 UI |
| AI 이상 탐지 | ❌ 미구현 | rage click, dead click 등 |

---

## 4. UC3: 시각적 회귀 테스트 — 기반 구조 구축 🔧

| 항목 | 상태 | 설명 |
|------|------|------|
| 타입 정의 | ✅ 완료 | Baseline, VisualDiff, VisualChange |
| DB 스키마 | ✅ 완료 | baselines, visualDiffs 테이블 |
| API CRUD | ✅ 완료 | baselines, visual-diffs 엔드포인트 |
| 웹 대시보드 | ✅ 완료 | 통계 카드 + 베이스라인 목록 |
| Extension 비주얼 탭 | 🔧 스텁 | "베이스라인 저장" 버튼만 |
| 스크린샷 비교 | ❌ 미구현 | 이미지 diff 알고리즘 |
| AI 변경 분류 | ❌ 미구현 | 의도적 vs 회귀 분류 |

---

## 5. 공통 인프라

| 항목 | 상태 | 설명 |
|------|------|------|
| DB 마이그레이션 | ✅ 완료 | Drizzle auto-migrate on startup |
| 시드 데이터 | ✅ 완료 | 기본 org, project, user |
| CORS | ✅ 완료 | Hono CORS 미들웨어 |
| 에러 핸들링 | ✅ 완료 | ApiError 클래스, 타입된 응답 |
| JSON 파싱 유틸 | ✅ 완료 | safeJsonParse for DB columns |
| 인증/권한 | ❌ 미구현 | 현재 하드코딩된 default user |
| Linear 연동 | ❌ 미구현 | 스키마 필드만 존재 |
| 다중 테넌트 | ❌ 미구현 | org_id 필드은 있으나 미적용 |

---

## 6. DB 스키마 (8 테이블)

```
organizations ─┬─ projects ─┬─ bugReports
               │            ├─ sessions
               │            ├─ baselines ── visualDiffs
               │            └─ users
               └─ users
```

---

## 7. 파일 구조 요약

```
packages/
├── shared/src/types/          # 4개 타입 파일 (공유)
├── api/src/
│   ├── db/                    # schema, seed, connection
│   └── routes/                # 5개 라우트 파일
├── web/src/
│   ├── app/                   # 5개 페이지 (+layout)
│   └── lib/api.ts             # API 클라이언트
└── extension/src/
    ├── content/index.ts       # DOM 이벤트 캡처
    ├── background/index.ts    # 메시지 라우팅
    ├── popup/                 # 팝업 UI
    ├── sidepanel/             # 버그 리포트 폼
    └── lib/api.ts             # API 클라이언트
```

---

## 8. 다음 단계 (Phase 1 잔여)

1. **Extension → Chrome 실제 로드 테스트** (dist/ 빌드 완료)
2. **Mock AI → Claude API 교체** (재현 스텝 생성)
3. **Linear 연동** (OAuth + Issue 생성)
4. **인증 레이어** (기본 API key 또는 세션)
5. **UC2 세션 리플레이** 핵심 기능 구현
6. **UC3 시각적 회귀** 핵심 기능 구현
