# Deep Work — Phase 1 MVP PRD (제품 요구사항 문서)

> **버전:** 1.0
> **작성일:** 2026-03-12
> **상태:** Draft

---

## 1. 제품 비전 & 미션

**비전:** 제품 개발의 모든 단계를 AI가 연결하는 통합 워크플로 플랫폼

**미션:** QA 과정에서 발생하는 반복적이고 수동적인 작업을 AI로 자동화하여, 제품 팀이 문제 발견과 해결에 집중할 수 있게 한다.

**Phase 1 목표:** 브라우저 확장 프로그램 기반의 AI QA 도구를 출시하여, 팀 전체(개발자, PM, 디자이너)가 기술적 장벽 없이 버그를 발견하고 리포트할 수 있게 한다.

---

## 2. 타겟 유저 페르소나

### P1: 프론트엔드 개발자 (Primary)
- **이름:** 민수 (Frontend Developer)
- **Pain:** 버그 리포트에 재현 정보가 부족해 디버깅에 시간 낭비. "어떤 브라우저요?", "다시 해볼 수 있어요?" 반복
- **Goal:** 재현 가능한 버그 리포트를 받고, 코드 원인을 빠르게 특정
- **Deep Work 사용:** 세션 리플레이로 버그 컨텍스트 파악, 콘솔/네트워크 로그로 즉시 디버깅

### P2: PM (Product Manager)
- **이름:** 지은 (Product Manager)
- **Pain:** 버그를 발견해도 기술적 정보(콘솔, 네트워크)를 첨부하지 못함. 개발자에게 설명하기 어려움
- **Goal:** 클릭 한 번으로 개발자가 바로 이해할 수 있는 버그 리포트 생성
- **Deep Work 사용:** AI 버그 리포터로 기술 정보 자동 수집, 재현 스텝 AI 자동 생성

### P3: 디자이너 (Designer)
- **이름:** 현우 (UI/UX Designer)
- **Pain:** 구현된 UI가 디자인과 미묘하게 다른데, 어디가 다른지 설명하기 어려움
- **Goal:** 디자인 의도와 실제 구현의 차이를 시각적으로 즉시 파악
- **Deep Work 사용:** 시각적 회귀 테스트로 UI 변경 자동 감지, 스크린샷 비교

### P4: QA 엔지니어 (Secondary)
- **이름:** 수진 (QA Engineer)
- **Pain:** 수동 테스트에 시간이 너무 많이 소요. 세션별로 이상 행동을 하나하나 확인
- **Goal:** 테스트 세션의 이상 패턴을 AI가 자동으로 감지해주기를 원함
- **Deep Work 사용:** 세션 리플레이 AI 분석으로 이상 행동 자동 감지, 시각적 회귀로 UI 변경 자동 확인

---

## 3. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│                 브라우저 확장 (Chrome Extension)      │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Bug       │  │ Session  │  │ Visual       │    │
│  │ Reporter  │  │ Recorder │  │ Comparator   │    │
│  └─────┬────┘  └─────┬────┘  └──────┬───────┘    │
│        │              │              │             │
│  ┌─────┴──────────────┴──────────────┴─────┐      │
│  │         Content Script Layer             │      │
│  │  (DOM 이벤트, 콘솔, 네트워크 캡처)          │      │
│  └─────────────────┬───────────────────────┘      │
│                    │                               │
│  ┌─────────────────┴───────────────────────┐      │
│  │      Background Service Worker           │      │
│  │  (데이터 수집, 압축, API 전송)              │      │
│  └─────────────────┬───────────────────────┘      │
└────────────────────┼───────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────┐
│                   Backend API                     │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Auth     │  │ Report   │  │ Session      │    │
│  │ Service  │  │ Service  │  │ Service      │    │
│  └──────────┘  └──────────┘  └──────────────┘    │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Visual   │  │ Linear   │  │ Storage      │    │
│  │ Service  │  │ Connector│  │ Service      │    │
│  └──────────┘  └──────────┘  └──────────────┘    │
│                      │                            │
└──────────────────────┼────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              AI Pipeline (Async)                  │
│                                                   │
│  ┌────────────────┐  ┌────────────────────┐      │
│  │ Repro Step     │  │ Anomaly Detection  │      │
│  │ Generator(LLM) │  │ Engine             │      │
│  └────────────────┘  └────────────────────┘      │
│  ┌────────────────┐                               │
│  │ Visual Diff    │                               │
│  │ Analyzer(Vision)│                               │
│  └────────────────┘                               │
└─────────────────────────────────────────────────┘
```

### 브라우저 확장 (Client)
- **Manifest V3** 기반 Chrome Extension
- **Content Script:** DOM 이벤트 감청, rrweb 세션 녹화, 콘솔/네트워크 인터셉트
- **Background Service Worker:** 데이터 버퍼링, 압축, API 전송, 상태 관리
- **Side Panel UI:** 버그 리포트 작성, 세션 목록, 비교 결과 대시보드 (React)

### Backend API
- **REST API** (JSON, 향후 GraphQL 확장 고려)
- **인증:** JWT + OAuth 2.0 (Linear 연동)
- **파일 스토리지:** S3 호환 오브젝트 스토리지 (녹화, 스크린샷)
- **큐:** 비동기 AI 처리를 위한 메시지 큐 (BullMQ / SQS)

### AI Pipeline
- **비동기 처리:** API 요청 → 큐 → AI Worker → 결과 저장 → 클라이언트 폴링/웹소켓
- **UC1 (재현 스텝):** 이벤트 로그 + 콘솔 + 네트워크 → LLM → 구조화된 재현 스텝
- **UC2 (이상 감지):** 세션 이벤트 시퀀스 → 규칙 기반 + ML → 이상 구간 표시
- **UC3 (시각적 비교):** 스크린샷 pair → Vision AI → 변경 분류

---

## 4. 공통 데이터 모델

### Organization
```
Organization {
  id: UUID
  name: string
  slug: string
  plan: enum (free, pro, enterprise)
  created_at: timestamp
}
```

### Project
```
Project {
  id: UUID
  organization_id: UUID (FK → Organization)
  name: string
  url_patterns: string[]        // 이 프로젝트에 해당하는 URL 패턴 (ex: ["*.myapp.com"])
  linear_team_id: string?       // Linear 팀 연동 ID
  created_at: timestamp
}
```

### User
```
User {
  id: UUID
  organization_id: UUID (FK → Organization)
  email: string
  name: string
  role: enum (admin, member, viewer)
  avatar_url: string?
  linear_user_id: string?       // Linear 유저 매핑
  created_at: timestamp
}
```

### BugReport (UC1 핵심)
```
BugReport {
  id: UUID
  project_id: UUID (FK → Project)
  reporter_id: UUID (FK → User)

  // 기본 정보
  title: string
  description: string?
  severity: enum (critical, major, minor, trivial)
  status: enum (open, in_progress, resolved, closed)

  // 자동 수집 데이터
  page_url: string
  environment: {
    browser: string             // "Chrome 120.0"
    os: string                  // "macOS 14.2"
    viewport: { width, height }
    user_agent: string
    device_pixel_ratio: number
  }
  console_logs: ConsoleEntry[]
  network_logs: NetworkEntry[]

  // AI 생성 데이터
  repro_steps: ReproStep[]      // AI가 생성한 재현 스텝
  ai_summary: string?           // AI 요약

  // 미디어
  recording_url: string?        // 녹화 영상 URL
  screenshot_urls: string[]     // 스크린샷 URL 목록

  // 연결
  session_id: UUID? (FK → Session)           // UC2 연결
  visual_diff_id: UUID? (FK → VisualDiff)    // UC3 연결
  linear_issue_id: string?                    // Linear 이슈 ID
  linear_issue_url: string?                   // Linear 이슈 URL

  created_at: timestamp
  updated_at: timestamp
}
```

### ConsoleEntry
```
ConsoleEntry {
  timestamp: number             // 녹화 시작 기준 상대 시간 (ms)
  level: enum (log, warn, error, info, debug)
  message: string
  stack_trace: string?
  source_url: string?
  line_number: number?
}
```

### NetworkEntry
```
NetworkEntry {
  timestamp: number
  method: string                // GET, POST, PUT, DELETE
  url: string
  status_code: number?
  request_headers: object?
  response_headers: object?
  request_body: string?         // 크기 제한 적용
  response_body: string?        // 크기 제한 적용
  duration_ms: number?
  error: string?
}
```

### ReproStep
```
ReproStep {
  order: number
  action: string                // "Navigate to", "Click", "Type", "Scroll" 등
  target: string                // "login button", "email input field" 등
  detail: string?               // 추가 설명
  screenshot_url: string?       // 해당 스텝의 스크린샷
}
```

### Session (UC2 핵심)
```
Session {
  id: UUID
  project_id: UUID (FK → Project)
  user_id: UUID (FK → User)

  // 세션 메타데이터
  start_url: string
  duration_ms: number
  page_count: number            // 방문한 페이지 수
  event_count: number           // 총 이벤트 수
  environment: object           // BugReport.environment와 동일 구조

  // 녹화 데이터
  events_url: string            // rrweb 이벤트 데이터 파일 URL

  // AI 분석 결과
  anomalies: Anomaly[]
  ai_analysis_status: enum (pending, processing, completed, failed)

  // 연결
  bug_report_ids: UUID[]        // 이 세션에서 생성된 버그 리포트들

  created_at: timestamp
}
```

### Anomaly
```
Anomaly {
  id: UUID
  session_id: UUID (FK → Session)

  type: enum (
    error,              // JS 에러 발생
    rage_click,         // 반복 클릭 (frustration)
    dead_click,         // 반응 없는 클릭
    long_wait,          // 비정상적 대기 시간
    unexpected_nav,     // 예상 외 네비게이션
    network_error       // 네트워크 요청 실패
  )

  timestamp_start: number       // 세션 내 시작 시점 (ms)
  timestamp_end: number         // 세션 내 종료 시점 (ms)
  severity: enum (high, medium, low)
  description: string           // AI 생성 설명

  // 관련 데이터
  related_events: object[]      // 관련 이벤트 스냅샷
  screenshot_url: string?
}
```

### Baseline (UC3 핵심)
```
Baseline {
  id: UUID
  project_id: UUID (FK → Project)

  name: string                  // "Homepage - Desktop", "Login Page - Mobile" 등
  page_url: string
  viewport: { width, height }
  screenshot_url: string        // 베이스라인 스크린샷
  dom_snapshot: string?         // DOM 스냅샷 URL (optional)

  created_by: UUID (FK → User)
  created_at: timestamp
  updated_at: timestamp
}
```

### VisualDiff (UC3 핵심)
```
VisualDiff {
  id: UUID
  baseline_id: UUID (FK → Baseline)
  project_id: UUID (FK → Project)

  // 비교 데이터
  current_screenshot_url: string
  diff_image_url: string        // 차이점 하이라이트 이미지

  // AI 분석 결과
  changes: VisualChange[]
  overall_status: enum (no_change, intentional, regression, mixed)
  ai_analysis_status: enum (pending, processing, completed, failed)

  created_by: UUID (FK → User)
  created_at: timestamp
}
```

### VisualChange
```
VisualChange {
  id: UUID
  visual_diff_id: UUID (FK → VisualDiff)

  region: { x, y, width, height }    // 변경 영역 좌표
  type: enum (
    layout_shift,       // 레이아웃 이동
    text_change,        // 텍스트 변경
    color_change,       // 색상 변경
    element_missing,    // 요소 사라짐
    element_added,      // 요소 추가됨
    size_change,        // 크기 변경
    other
  )
  classification: enum (intentional, regression, uncertain)
  confidence: number            // 0.0 ~ 1.0
  description: string           // AI 생성 설명

  // 버그 리포트 연결
  bug_report_id: UUID?          // regression으로 분류 시 자동 생성된 버그 리포트
}
```

---

## 5. 공통 API 설계 원칙

### Base URL
```
https://api.deepwork.dev/v1
```

### 인증
```
Authorization: Bearer <JWT_TOKEN>
```

### 응답 형식
```json
{
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO8601"
  }
}
```

### 에러 응답
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": [...]
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO8601"
  }
}
```

### 페이지네이션
```
GET /v1/bug-reports?cursor=xxx&limit=20
```

### 공통 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/auth/login` | 이메일/패스워드 로그인 |
| POST | `/auth/oauth/linear` | Linear OAuth 연동 |
| GET | `/auth/me` | 현재 유저 정보 |
| GET | `/projects` | 프로젝트 목록 |
| POST | `/projects` | 프로젝트 생성 |
| PUT | `/projects/:id` | 프로젝트 수정 |
| POST | `/upload/presigned` | 파일 업로드 presigned URL 발급 |

---

## 6. Linear 연동 아키텍처

### 인증 플로우
```
1. 유저가 Deep Work에서 "Linear 연결" 클릭
2. Linear OAuth 인증 페이지로 리다이렉트
3. 유저 승인 → Deep Work 콜백 URL로 code 전달
4. Backend에서 code → access_token 교환
5. access_token 암호화 저장
```

### 연동 기능 (MVP)
- **Issue 생성:** 버그 리포트 → Linear Issue 자동 생성
- **Label 매핑:** Deep Work severity → Linear Label
- **Project 매핑:** Deep Work Project → Linear Team/Project
- **링크 동기화:** 생성된 Issue URL을 버그 리포트에 저장

### Linear Issue 생성 시 포함 정보
```
Title: [Deep Work] {버그 리포트 제목}
Description:
  - AI 생성 재현 스텝
  - 환경 정보 (브라우저, OS, 뷰포트)
  - 콘솔 에러 요약
  - Deep Work 버그 리포트 링크
  - 세션 리플레이 링크 (있는 경우)
  - 스크린샷/녹화 링크
Labels: severity 기반 자동 매핑
```

---

## 7. 인증/권한 모델

### 인증 방식
- **MVP:** 이메일 + 패스워드 (bcrypt)
- **향후:** Google OAuth, SSO

### 권한 레벨
| 역할 | 버그 리포트 | 세션 | 베이스라인 | 프로젝트 설정 | 팀 관리 |
|------|-----------|------|---------|------------|--------|
| Admin | CRUD | CRUD | CRUD | CRUD | CRUD |
| Member | CRUD | CRUD | CRUD | Read | Read |
| Viewer | Read | Read | Read | Read | - |

---

## 8. 비기능 요구사항

### 성능
- 브라우저 확장이 페이지 로드 시간에 미치는 영향: **< 50ms**
- 버그 리포트 생성 (녹화 종료 → 리포트 화면): **< 3초**
- AI 재현 스텝 생성: **< 15초**
- 세션 리플레이 시작까지: **< 2초**
- 시각적 비교 결과: **< 30초**

### 보안
- 모든 API 통신 HTTPS
- 녹화/스크린샷은 암호화된 스토리지에 저장
- 민감 정보 (비밀번호 입력 등) 자동 마스킹
- 네트워크 로그에서 Authorization 헤더 자동 제거
- GDPR 준수: 데이터 삭제 요청 지원

### 확장성
- 단일 프로젝트당 동시 녹화 세션: **100+**
- 월간 버그 리포트: **10,000+ / 프로젝트**
- 스크린샷 스토리지: 프로젝트당 **50GB**

### 브라우저 지원
- **MVP:** Chrome (Manifest V3)
- **Phase 2:** Firefox, Edge, Safari

---

## 9. UC 간 연결 구조

```
┌─────────────┐          ┌──────────────────┐
│ UC3: Visual │──변경감지──→│                  │
│ Regression  │          │  UC1: AI Bug     │──→ Linear Issue
│             │          │  Reporter (Hub)  │
└─────────────┘          │                  │
                         └────────▲─────────┘
┌─────────────┐                  │
│ UC2: Session│──이상감지──────────┘
│ Replay      │──세션링크 첨부────→ 버그 리포트에 컨텍스트 추가
└─────────────┘
```

- UC2 세션에서 이상 감지 → UC1 버그 리포트 자동 생성 제안
- UC3 시각적 회귀 감지 → UC1 버그 리포트 자동 생성
- UC1 버그 리포트에 UC2 세션 리플레이 링크 자동 첨부
- 모든 버그 리포트는 UC1을 통해 Linear으로 전송

---

## 10. MVP 릴리즈 기준

- [ ] 3개 UC 모든 Must Have 기능 구현 완료
- [ ] 브라우저 확장이 Chrome Web Store 심사 통과
- [ ] Linear 연동으로 Issue 생성 성공
- [ ] AI 재현 스텝 생성 정확도 70% 이상 (내부 테스트 기준)
- [ ] 시각적 비교 변경 감지율 90% 이상
- [ ] 세션 리플레이 이상 감지 precision 60% 이상
- [ ] 페이지 로드 영향 < 50ms
- [ ] 민감 정보 마스킹 동작 확인
- [ ] 5인 이상 내부 팀 2주간 dogfooding 완료
