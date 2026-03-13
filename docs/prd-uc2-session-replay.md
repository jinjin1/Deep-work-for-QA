# UC2: 세션 리플레이 + AI 분석 — 상세 PRD

> **핵심 가치:** "유저가 뭘 했는지 다시 보고, AI가 문제를 짚어준다"

---

## 1. 문제 정의 & 기회

### 현재 문제
- **맥락 유실:** 버그 리포트만으로는 유저가 어떤 흐름을 거쳐 버그에 도달했는지 알 수 없음
- **수동 테스트의 비효율:** QA가 수십 개 시나리오를 수동으로 테스트하면서 이상 패턴을 놓침
- **Frustration 감지 불가:** 유저가 반복 클릭, 뒤로가기 등 좌절 신호를 보내도 이를 체계적으로 포착하지 못함
- **재현 어려움:** "간헐적으로 발생한다"는 버그를 재현하려면 정확한 사용 흐름이 필요

### 기회
- 기존 세션 리플레이 도구(FullStory, Hotjar)는 **프로덕션 유저 분석** 중심이지만, Deep Work는 **QA 테스트 세션 분석**에 특화
- AI가 세션을 분석하여 이상 패턴을 자동 감지하면, QA 효율을 대폭 향상
- UC1(버그 리포터)과 결합하면 "발견 → 맥락 파악 → 리포트" 전체 흐름이 자동화됨

---

## 2. 유저 스토리

### QA 엔지니어 (수진)
```
AS A QA Engineer
I WANT TO 테스트 세션을 녹화하고, AI가 세션에서 이상 패턴(에러, 반복 클릭, 비정상 대기)을 자동으로 감지
SO THAT 수동으로 모든 시나리오를 확인하지 않아도 문제가 있는 구간을 빠르게 찾을 수 있다
```

### 프론트엔드 개발자 (민수)
```
AS A Frontend Developer
I WANT TO 버그 리포트에 첨부된 세션 리플레이를 통해 버그 발생 전후의 전체 유저 행동을 재현
SO THAT 버그의 컨텍스트를 완전히 이해하고 정확한 원인을 파악할 수 있다
```

### PM (지은)
```
AS A PM
I WANT TO QA 세션에서 AI가 감지한 이상 패턴 요약을 확인
SO THAT 릴리즈 전 주요 이슈를 빠르게 파악하고 우선순위를 결정할 수 있다
```

---

## 3. 기능 요구사항

### Must Have (MVP 필수)

| ID | 기능 | 설명 |
|----|------|------|
| F2.1 | 세션 녹화 시작/중지 | 확장에서 "세션 녹화" 토글. 페이지 이동 간에도 지속 |
| F2.2 | DOM 기반 녹화 | rrweb 기반 DOM 스냅샷 + 증분 이벤트 녹화 |
| F2.3 | 인터랙션 이벤트 기록 | 클릭, 입력, 스크롤, 네비게이션, 리사이즈 이벤트를 타임스탬프와 함께 기록 |
| F2.4 | 콘솔/네트워크 동기 기록 | 세션 녹화와 동기화된 콘솔 로그 및 네트워크 요청 기록 |
| F2.5 | 세션 리플레이어 | 타임라인 기반 리플레이어. 재생, 일시정지, 속도 조절(0.5x~4x), 특정 시점 이동 |
| F2.6 | AI 이상 감지 | 세션 이벤트를 분석하여 이상 패턴 자동 감지 및 타임라인에 마커 표시 |
| F2.7 | 이상 구간 하이라이트 | 감지된 이상 구간을 타임라인에 컬러 마커로 표시, 클릭 시 해당 시점으로 이동 |
| F2.8 | 세션 목록 | 프로젝트별 세션 목록, 필터(날짜, 유저, 이상 감지 여부), 정렬 |
| F2.9 | UC1 연동 | 세션 리플레이 중 특정 시점에서 "버그 리포트 생성" → UC1으로 전환, 세션 링크 자동 첨부 |
| F2.10 | 민감정보 마스킹 | input[type=password] 값 마스킹, rrweb 개인정보 필터링 |

### Should Have (MVP 포함, 완성도 타협 가능)

| ID | 기능 | 설명 |
|----|------|------|
| F2.11 | 세션 구간 공유 | 특정 시간 구간의 딥링크 생성 (ex: session/abc?t=30-45) |
| F2.12 | 이벤트 필터 뷰 | 리플레이어 하단에 이벤트 유형별 필터 (클릭만, 에러만, 네트워크만) |
| F2.13 | 세션 메타데이터 | 세션 요약: 총 시간, 방문 페이지 수, 에러 수, 이상 감지 수 |
| F2.14 | 세션 태그 | 유저가 세션에 태그 추가 (ex: "로그인 플로우", "결제 테스트") |

### Could Have (Phase 2 고려)

| ID | 기능 | 설명 |
|----|------|------|
| F2.15 | 실시간 세션 관찰 | 녹화 중인 세션을 다른 팀원이 실시간 관찰 |
| F2.16 | 세션 비교 | 두 세션의 행동 경로를 나란히 비교 |
| F2.17 | 자동 테스트 생성 | 세션 이벤트에서 E2E 테스트 코드 자동 생성 |
| F2.18 | 히트맵 | 세션 데이터 기반 클릭/스크롤 히트맵 |
| F2.19 | 프로덕션 세션 수집 | SDK를 통한 실제 유저 세션 수집 (SDK 기반, Phase 2) |

---

## 4. 유저 플로우 (단계별 상세)

### Flow 1: QA 테스트 세션 녹화 & 분석

```
[1] QA 엔지니어가 테스트 시작 전 확장에서 "세션 녹화" 활성화
    ├─ 프로젝트 자동 매칭 (URL 패턴 기반)
    └─ 세션 태그 입력 (optional): "로그인 플로우 테스트"
         │
[2] 녹화 시작
    ├─ 탭 상단에 세션 녹화 인디케이터 표시 (녹색 배지)
    ├─ rrweb 녹화 시작 (DOM 스냅샷 + 증분 이벤트)
    ├─ 인터랙션 이벤트 기록 시작
    ├─ 콘솔 로그 인터셉트 시작
    └─ 네트워크 요청 인터셉트 시작
         │
[3] QA가 테스트 시나리오 수행
    ├─ 여러 페이지 이동 (SPA/MPA 모두 지원)
    ├─ 폼 입력, 버튼 클릭, 기능 확인
    └─ (버그 발견 시) 확장에서 "마크" 버튼으로 시점 표시 가능
         │
[4] 테스트 완료 → "세션 녹화 중지" 클릭
         │
[5] 세션 데이터 업로드 (백그라운드)
    ├─ rrweb 이벤트 데이터 압축
    ├─ Presigned URL로 스토리지 업로드
    └─ 메타데이터 API 전송
         │
[6] AI 분석 시작 (비동기)
    ├─ 이벤트 시퀀스 분석
    ├─ 이상 패턴 탐지
    └─ 분석 완료 시 알림
         │
[7] 세션 목록에서 해당 세션 선택 → 리플레이어 열림
    ├─ 타임라인에 이상 구간 마커 표시
    ├─ 마커 클릭 → 해당 시점으로 이동
    ├─ 이상 패턴 상세 패널 (유형, 설명, 심각도)
    └─ 관련 콘솔/네트워크 로그 동기 표시
         │
[8] 이상 구간에서 "버그 리포트 생성" 클릭
    ├─ UC1 Side Panel 열림
    ├─ 세션 리플레이 링크 자동 첨부
    ├─ 해당 시점의 스크린샷 자동 캡처
    ├─ 관련 콘솔/네트워크 로그 자동 포함
    └─ AI가 해당 구간의 재현 스텝 자동 생성
```

### Flow 2: 개발자가 버그 리포트에서 세션 확인

```
[1] 개발자가 Linear에서 버그 이슈 확인
         │
[2] 이슈 설명에 포함된 Deep Work 세션 리플레이 링크 클릭
         │
[3] Deep Work 웹에서 세션 리플레이어 열림
    ├─ 버그 발생 시점이 자동 포커스
    ├─ 이전/이후 맥락을 타임라인으로 확인
    ├─ 콘솔 에러 발생 시점 확인
    └─ 네트워크 요청 실패 시점 확인
         │
[4] 버그 원인 파악 → 수정 작업 진행
```

---

## 5. AI 이상 감지 엔진 설계

### 감지 대상 이상 패턴

| 패턴 | 정의 | 심각도 | 감지 로직 |
|------|------|--------|----------|
| **error** | JS 런타임 에러 발생 | High | console.error 또는 window.onerror 이벤트 |
| **rage_click** | 동일 영역 3회 이상 빠른 클릭 (1초 이내) | Medium | 클릭 이벤트의 좌표/대상 + 시간 간격 분석 |
| **dead_click** | 클릭 후 DOM 변경/네비게이션 없음 | Medium | 클릭 이벤트 후 500ms 이내 DOM mutation 없음 |
| **long_wait** | 페이지 로딩/API 응답 5초 이상 대기 | Low | 네비게이션/XHR 시작 후 응답까지 시간 측정 |
| **unexpected_nav** | 에러 페이지(404/500)로 이동 | High | 네비게이션 이벤트의 status code 또는 URL 패턴 |
| **network_error** | API 요청 실패 (4xx/5xx) | Medium~High | fetch/XHR 응답 status code 분석 |

### 감지 파이프라인

```
입력:
├─ 세션 이벤트 시퀀스 (click, input, navigation, ...)
├─ 콘솔 로그 (error, warn)
├─ 네트워크 로그 (status codes, durations)
└─ DOM mutation 로그 (rrweb incremental snapshots)

    │
    ▼
Phase 1: 규칙 기반 감지 (즉시)
├─ 시간 윈도우 기반 rage_click 감지
├─ 클릭 후 DOM 변경 여부로 dead_click 감지
├─ 네트워크 응답 시간/상태 코드로 long_wait/network_error 감지
├─ 콘솔 에러 이벤트로 error 감지
└─ URL 패턴으로 unexpected_nav 감지

    │
    ▼
Phase 2: AI 분석 (비동기, LLM)
├─ 규칙 기반 감지 결과 + 이벤트 컨텍스트를 LLM에 전달
├─ 각 이상 패턴에 대한 자연어 설명 생성
├─ 이상 패턴 간 인과관계 분석 (ex: network_error → error → rage_click)
└─ 세션 전체 요약 생성

    │
    ▼
출력:
├─ Anomaly[] (타입, 시간, 심각도, 설명)
├─ 세션 요약 텍스트
└─ 이상 구간 간 관계 그래프
```

### LLM 프롬프트 구성 (Phase 2 AI 분석)

```
System: "당신은 QA 전문가입니다. 유저의 웹앱 테스트 세션 데이터를 분석하여
         이상 패턴을 설명하고 세션 전체를 요약하세요."

Context:
  - 페이지 URL 히스토리
  - 세션 총 시간, 이벤트 수

Detected Anomalies:
  [규칙 기반 감지 결과 JSON]

Event Context:
  [각 이상 구간 전후 10초 이벤트]

Output:
  {
    "anomaly_descriptions": [...],   // 각 이상 패턴의 사람이 읽을 수 있는 설명
    "causal_chain": [...],           // 이상 패턴 간 인과관계
    "session_summary": "..."         // 세션 전체 요약
  }
```

---

## 6. 데이터 모델 (UC2 고유)

> 공통 모델(Session, Anomaly)은 `prd-overview.md` 참조. 여기서는 UC2 고유 모델만 기술.

### SessionEvent (rrweb 이벤트 외 추가 메타)
```
SessionEvent {
  session_id: UUID (FK → Session)
  timestamp: number              // 세션 시작 기준 상대 시간 (ms)
  type: enum (
    page_visit,                  // 페이지 방문
    user_mark,                   // 유저가 수동으로 마크한 시점
    anomaly_detected             // 이상 감지 시점 (분석 후 추가)
  )
  data: object                   // type별 추가 데이터
}
```

### SessionBookmark (유저 마크)
```
SessionBookmark {
  id: UUID
  session_id: UUID (FK → Session)
  timestamp: number              // 세션 내 시점 (ms)
  label: string?                 // "여기서 버그 발생" 등
  created_by: UUID (FK → User)
}
```

### SessionTag
```
SessionTag {
  id: UUID
  session_id: UUID (FK → Session)
  name: string                   // "로그인 플로우", "결제 테스트" 등
}
```

---

## 7. API 엔드포인트

### 세션 CRUD

```
POST   /v1/sessions                       # 세션 생성 (녹화 시작)
PUT    /v1/sessions/:id                    # 세션 업데이트 (녹화 종료, 메타 추가)
GET    /v1/sessions                        # 세션 목록 (필터/페이지네이션)
GET    /v1/sessions/:id                    # 세션 상세 (메타 + 이상 감지 결과)
DELETE /v1/sessions/:id                    # 세션 삭제
```

### 세션 이벤트 & 리플레이

```
POST   /v1/sessions/:id/events/upload-url  # 이벤트 데이터 업로드 URL 발급
GET    /v1/sessions/:id/events             # 이벤트 데이터 다운로드 URL 반환
GET    /v1/sessions/:id/anomalies          # 이상 감지 결과 목록
```

### 세션 부가 기능

```
POST   /v1/sessions/:id/bookmarks          # 세션 북마크(마크) 추가
GET    /v1/sessions/:id/bookmarks           # 북마크 목록
POST   /v1/sessions/:id/tags               # 세션 태그 추가
DELETE /v1/sessions/:id/tags/:tag_id        # 태그 삭제
POST   /v1/sessions/:id/bug-report          # 세션에서 버그 리포트 생성 (UC1 연동)
GET    /v1/sessions/:id/share-link           # 공유 링크 생성
```

### 세션 생성 Request Body
```json
{
  "project_id": "uuid",
  "start_url": "https://app.example.com/dashboard",
  "environment": {
    "browser": "Chrome 120.0.6099.109",
    "os": "macOS 14.2.1",
    "viewport": { "width": 1440, "height": 900 }
  },
  "tags": ["대시보드 테스트"]
}
```

### 세션 종료 (업데이트) Request Body
```json
{
  "duration_ms": 180000,
  "page_count": 5,
  "event_count": 342,
  "events_url": "s3://bucket/sessions/uuid/events.json.gz"
}
```

### 이상 감지 결과 Response
```json
{
  "data": {
    "session_id": "uuid",
    "ai_analysis_status": "completed",
    "anomalies": [
      {
        "id": "uuid",
        "type": "rage_click",
        "timestamp_start": 42000,
        "timestamp_end": 43500,
        "severity": "medium",
        "description": "유저가 '저장' 버튼을 1.5초 동안 4회 반복 클릭했습니다. 버튼이 비활성화 상태이거나 클릭 핸들러가 동작하지 않는 것으로 보입니다.",
        "related_events": [
          { "type": "click", "timestamp": 42000, "target": "button.save-btn" },
          { "type": "click", "timestamp": 42400, "target": "button.save-btn" },
          { "type": "click", "timestamp": 42900, "target": "button.save-btn" },
          { "type": "click", "timestamp": 43500, "target": "button.save-btn" }
        ]
      },
      {
        "id": "uuid",
        "type": "network_error",
        "timestamp_start": 41800,
        "timestamp_end": 42000,
        "severity": "high",
        "description": "POST /api/documents/save 요청이 500 에러로 실패했습니다. 이 네트워크 에러 직후 유저가 반복 클릭(rage_click)을 보였습니다.",
        "related_events": [
          { "type": "network", "timestamp": 41800, "url": "/api/documents/save", "status": 500 }
        ]
      }
    ],
    "session_summary": "총 3분간의 세션에서 문서 저장 기능에 문제가 감지되었습니다. API 서버에서 500 에러가 반환되어 저장이 실패했고, 유저가 이를 인지하지 못해 반복 클릭을 시도했습니다.",
    "causal_chain": [
      {
        "cause": "network_error (POST /api/documents/save → 500)",
        "effect": "rage_click (저장 버튼 4회 클릭)",
        "explanation": "서버 에러로 저장이 실패했지만 UI에 에러 피드백이 없어 유저가 반복 시도"
      }
    ]
  }
}
```

### 세션에서 버그 리포트 생성 Request Body
```json
{
  "anomaly_id": "uuid",
  "timestamp_start": 41800,
  "timestamp_end": 43500,
  "title": "문서 저장 실패 - 서버 500 에러",
  "severity": "major"
}
```

---

## 8. UI 컴포넌트 명세

### 세션 녹화 컨트롤 (Extension Popup 내)
```
┌─────────────────────────┐
│  Deep Work         [⚙]  │
├─────────────────────────┤
│                         │
│  세션 녹화               │
│  ┌───────────────────┐  │
│  │ ● 녹화 시작        │  │
│  └───────────────────┘  │
│                         │
│  태그: [로그인 테스트  ▼] │
│                         │
│  ── 진행 중 세션 ──────  │
│  (없음)                 │
└─────────────────────────┘

녹화 중:
┌─────────────────────────┐
│  Deep Work         [⚙]  │
├─────────────────────────┤
│                         │
│  🟢 녹화 중  02:35      │
│  📍 app.example.com     │
│  📄 3 pages visited     │
│                         │
│  ┌───────────────────┐  │
│  │ 📌 마크 추가       │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ ⏹ 녹화 중지        │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

### 세션 리플레이어 (웹 대시보드)
```
┌──────────────────────────────────────────────────────┐
│  세션: 로그인 플로우 테스트        2026-03-12 14:30   │
│  by 수진 · 3분 12초 · 5 pages · 2 anomalies         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │                                            │      │
│  │           DOM 리플레이 영역                  │      │
│  │         (rrweb player iframe)              │      │
│  │                                            │      │
│  │                                            │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
│  ◀ ▶ ⏸  1x [0.5x 1x 2x 4x]           01:42 / 03:12 │
│                                                      │
│  타임라인:                                            │
│  ├──────●──────🔴──🟡──────────────●──────────┤      │
│  0:00        0:42  0:45          1:42       3:12     │
│              ↑error  ↑rage                           │
│              click                                   │
│                                                      │
│  ── 이벤트 패널 ─────────────────────────────────────  │
│  [All] [Clicks] [Errors] [Network] [Anomalies]       │
│                                                      │
│  🔴 0:42  console.error  TypeError: Cannot read...   │
│  🟡 0:43  rage_click     저장 버튼 4회 반복 클릭       │
│  🌐 0:41  POST /api/save  500 Internal Server Error  │
│  🖱 0:40  click          저장 버튼 클릭               │
│  🖱 0:35  input          이메일 입력                  │
│                                                      │
│  ── 이상 감지 요약 ──────────────────────────────────  │
│  ┌──────────────────────────────────────────┐        │
│  │ 🔴 network_error → rage_click            │        │
│  │ API 서버 500 에러로 저장 실패 → 반복 클릭   │        │
│  │                          [버그 리포트 생성] │        │
│  └──────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

### 세션 목록 (웹 대시보드)
```
┌──────────────────────────────────────────────────────┐
│  세션 목록                    [필터 ▼] [정렬: 최신 ▼]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  필터: 날짜 [최근 7일 ▼]  태그 [전체 ▼]  이상감지 [있음]│
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ 로그인 플로우 테스트                            │    │
│  │ 수진 · 3분 12초 · 5 pages                     │    │
│  │ 🔴 2 anomalies  · 2026-03-12 14:30           │    │
│  │ Tags: #로그인 #인증                            │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │ 결제 프로세스 테스트                             │    │
│  │ 수진 · 5분 45초 · 8 pages                     │    │
│  │ 🟢 0 anomalies  · 2026-03-12 11:00           │    │
│  │ Tags: #결제                                    │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## 9. 성공 지표 (KPI)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 주간 세션 녹화 수 | > 10회/유저 | 활성 유저당 주간 세션 녹화 횟수 |
| AI 이상 감지 precision | > 60% | 감지된 이상 중 실제 이슈로 인정된 비율 |
| 이상 감지 → 버그 리포트 전환율 | > 30% | 감지된 이상 중 버그 리포트로 생성된 비율 |
| 세션 리플레이 조회율 | > 50% | 버그 리포트 중 세션 리플레이가 조회된 비율 |
| 세션 분석 처리 시간 | < 60초 | 세션 업로드 → AI 분석 완료까지 시간 |
| 페이지 성능 영향 | < 3% CPU | 세션 녹화 중 CPU 오버헤드 |

---

## 10. 범위 외 (Out of Scope)

- 프로덕션 유저 세션 수집 (SDK 기반, Phase 2)
- 실시간 세션 관찰 (다른 팀원이 라이브 관찰)
- 세션 비교 (두 세션 나란히 비교)
- 히트맵/퍼널 분석
- 모바일 브라우저 세션 녹화
- 세션 데이터 기반 E2E 테스트 자동 생성
- 세션 데이터 장기 보관 (MVP: 30일 보관)

---

## 11. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| rrweb 녹화가 페이지 성능에 영향 | 유저 경험 저하, 테스트 결과 왜곡 | 샘플링 비율 조절, mutation observer 최적화, 비활성 탭 일시정지 |
| 세션 데이터 크기가 큼 (장시간 녹화) | 스토리지 비용, 업로드 시간 | 이벤트 압축(gzip), 10분 이상 세션 분할, 유휴 구간 제거 |
| AI 이상 감지 오탐(false positive) 과다 | 유저 신뢰도 하락 | 규칙 기반 감지 우선, AI는 보조 분석. 유저 피드백으로 개선 |
| SPA 페이지 전환 감지 실패 | 페이지 방문 기록 누락 | pushState/replaceState/popstate + MutationObserver 조합 |
| iframe 내부 녹화 불가 | 일부 컨텐츠 녹화 누락 | cross-origin iframe 미지원 명시, same-origin iframe은 지원 |

---

## 12. 기술 구현 참고

### rrweb 녹화 설정
```
녹화 옵션:
├─ blockClass: 'dw-block'        // 녹화 제외 요소 CSS class
├─ maskInputOptions:
│   ├─ password: true
│   └─ email: false              // 이메일은 마스킹하지 않음 (설정 가능)
├─ sampling:
│   ├─ mousemove: 50             // 마우스 이동 50ms 간격 샘플링
│   ├─ mouseInteraction: true
│   ├─ scroll: 150               // 스크롤 150ms 간격
│   └─ input: 'last'             // 입력은 마지막 값만
├─ recordCanvas: false           // Canvas 녹화 비활성화 (성능)
└─ collectFonts: false           // 폰트 수집 비활성화 (크기)
```

### 세션 데이터 저장 전략
```
녹화 중:
├─ rrweb 이벤트 → 5초 버퍼 → Background Service Worker
├─ Service Worker → IndexedDB 청크 저장 (5MB 단위)
└─ 메모리 사용량 모니터링 (100MB 초과 시 경고)

녹화 종료:
├─ IndexedDB 청크 결합
├─ gzip 압축 (평균 70-80% 압축률)
├─ Presigned URL로 S3 업로드 (multipart)
├─ 업로드 완료 후 IndexedDB 정리
└─ 메타데이터 API 전송 → AI 분석 트리거
```
