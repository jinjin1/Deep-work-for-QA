# UC1: AI 버그 리포터 — 상세 PRD

> **핵심 가치:** "클릭 한 번으로 버그를 리포트하고, AI가 나머지를 완성한다"

---

## 1. 문제 정의 & 기회

### 현재 문제
- **비개발자의 버그 리포팅 장벽:** PM/디자이너가 버그를 발견해도 콘솔 로그, 네트워크 요청, 환경 정보를 첨부하지 못함
- **재현 정보 부족:** "어떻게 재현하나요?" 질문이 반복되며 개발자-리포터 간 핑퐁 발생
- **컨텍스트 유실:** 버그 발견 시점의 화면 상태, 사용자 행동 이력이 리포트에 포함되지 않음
- **도구 분산:** 스크린샷(캡처 도구) + 설명(Slack/이메일) + 티켓(Linear) 등 여러 도구를 오가며 시간 낭비

### 기회
- Jam.dev 등 기존 도구는 캡처에 집중하지만, **AI가 재현 스텝을 자동 생성**하는 것은 미개척 영역
- 팀 전원이 개발자 수준의 버그 리포트를 생성할 수 있게 되면, **디버깅 시간 50% 이상 절감** 가능

---

## 2. 유저 스토리

### PM (지은)
```
AS A PM
I WANT TO 브라우저에서 버그를 발견했을 때 확장 아이콘을 클릭하여 녹화하고, 제목만 입력하면 자동으로 완성된 버그 리포트를 생성
SO THAT 개발자가 추가 질문 없이 즉시 디버깅할 수 있는 리포트를 만들 수 있다
```

### 프론트엔드 개발자 (민수)
```
AS A Frontend Developer
I WANT TO 버그 리포트에 포함된 콘솔 로그, 네트워크 요청, 환경 정보를 확인하고, AI가 생성한 재현 스텝을 따라 버그를 재현
SO THAT 별도 커뮤니케이션 없이 버그 원인을 빠르게 파악할 수 있다
```

### 디자이너 (현우)
```
AS A Designer
I WANT TO UI에서 발견한 시각적 문제를 스크린샷과 함께 바로 리포트
SO THAT 어떤 부분이 의도와 다른지 명확하게 전달할 수 있다
```

---

## 3. 기능 요구사항

### Must Have (MVP 필수)

| ID | 기능 | 설명 |
|----|------|------|
| F1.1 | 원클릭 녹화 | 확장 아이콘 클릭 → 즉시 녹화 시작. 탭 전체 캡처 |
| F1.2 | 녹화 중지 & 리포트 화면 | 녹화 중지 시 Side Panel에서 리포트 작성 화면 표시 |
| F1.3 | 자동 환경 수집 | 브라우저, OS, 뷰포트, URL, User Agent 자동 감지 |
| F1.4 | 콘솔 로그 캡처 | 녹화 구간의 console.log/warn/error 전체 수집 |
| F1.5 | 네트워크 로그 캡처 | 녹화 구간의 XHR/Fetch 요청/응답 수집 (민감정보 마스킹) |
| F1.6 | 스크린샷 캡처 | 녹화 시작/종료 시점 + 사용자 수동 캡처 |
| F1.7 | AI 재현 스텝 생성 | 이벤트 로그 기반으로 AI가 자연어 재현 스텝 자동 생성 |
| F1.8 | 리포트 편집 | 제목, 설명, 심각도 편집. AI 재현 스텝 수정 가능 |
| F1.9 | Linear 전송 | 버그 리포트를 Linear Issue로 원클릭 생성 |
| F1.10 | 민감정보 마스킹 | 비밀번호 입력, Authorization 헤더 자동 마스킹 |

### Should Have (MVP에 포함하되, 완성도 타협 가능)

| ID | 기능 | 설명 |
|----|------|------|
| F1.11 | 비디오 녹화 | 탭 화면을 비디오로 녹화 (WebM/GIF) |
| F1.12 | 스크린 어노테이션 | 스크린샷에 화살표, 박스, 텍스트 추가 |
| F1.13 | 프로젝트 자동 매칭 | URL 패턴으로 현재 페이지의 프로젝트를 자동 판별 |
| F1.14 | 리포트 공유 링크 | 생성된 리포트의 공유 가능한 링크 |

### Could Have (Phase 2 고려)

| ID | 기능 | 설명 |
|----|------|------|
| F1.15 | Jira 연동 | Jira Issue 생성 |
| F1.16 | GitHub Issues 연동 | GitHub Issue 생성 |
| F1.17 | Slack 연동 | 리포트 생성 시 Slack 채널 알림 |
| F1.18 | AI 심각도 제안 | 에러 유형 기반으로 심각도 자동 추천 |
| F1.19 | 중복 버그 감지 | 유사한 기존 버그 리포트 자동 표시 |

---

## 4. 유저 플로우 (단계별 상세)

### Flow 1: 기본 버그 리포팅

```
[1] 유저가 웹앱 사용 중 버그 발견
         │
[2] 브라우저 툴바의 Deep Work 아이콘 클릭
         │
[3] 확장이 팝업 표시: "녹화 시작" 버튼
    ├─ 현재 URL 표시
    └─ 프로젝트 자동 매칭 표시
         │
[4] "녹화 시작" 클릭 → 녹화 시작
    ├─ 탭 상단에 녹화 중 인디케이터 표시
    ├─ Content Script가 DOM 이벤트 캡처 시작
    ├─ 콘솔 로그 인터셉트 시작
    └─ 네트워크 요청 인터셉트 시작
         │
[5] 유저가 버그를 재현하는 행동 수행
    (클릭, 입력, 네비게이션 등)
         │
[6] "녹화 중지" 클릭 (아이콘 또는 인디케이터)
         │
[7] Side Panel 열림: 버그 리포트 작성 화면
    ├─ [자동 채워짐] 환경 정보
    ├─ [자동 채워짐] 콘솔 로그 (에러 하이라이트)
    ├─ [자동 채워짐] 네트워크 로그 (실패 요청 하이라이트)
    ├─ [자동 채워짐] 스크린샷 (시작/종료)
    ├─ [AI 생성 중...] 재현 스텝 (로딩 → 완료 시 표시)
    ├─ [사용자 입력] 제목 (필수)
    ├─ [사용자 입력] 설명 (선택)
    └─ [사용자 선택] 심각도 (기본: Major)
         │
[8] AI 재현 스텝 생성 완료 → 유저 검토/수정
         │
[9] "리포트 생성" 클릭
    ├─ Deep Work에 버그 리포트 저장
    └─ (Linear 연동 시) Linear Issue 자동 생성
         │
[10] 완료 화면: 리포트 링크 + Linear 이슈 링크 표시
```

### Flow 2: 빠른 스크린샷 리포트 (녹화 없이)

```
[1] 유저가 버그 발견 → Deep Work 아이콘 우클릭
         │
[2] "스크린샷 캡처" 선택
         │
[3] 현재 화면 스크린샷 + 환경정보 + 콘솔 로그 수집
         │
[4] Side Panel: 간단 리포트 작성
    ├─ 스크린샷에 어노테이션 추가 가능
    ├─ 제목 입력
    └─ "리포트 생성" 클릭
         │
[5] 리포트 저장 + Linear 전송
```

---

## 5. 데이터 모델 (UC1 고유)

> 공통 데이터 모델은 `prd-overview.md` 참조. 여기서는 UC1 고유 모델만 기술.

### Recording (녹화 데이터)
```
Recording {
  id: UUID
  bug_report_id: UUID (FK → BugReport)

  // 녹화 메타
  duration_ms: number
  start_timestamp: timestamp
  end_timestamp: timestamp

  // 이벤트 데이터
  dom_events: DOMEvent[]        // 클릭, 입력, 스크롤 등
  event_count: number

  // 미디어
  video_url: string?            // 비디오 녹화 파일
  thumbnail_url: string?        // 녹화 썸네일

  created_at: timestamp
}
```

### DOMEvent
```
DOMEvent {
  timestamp: number             // 녹화 시작 기준 상대 시간 (ms)
  type: enum (click, input, scroll, navigation, resize, focus, blur)
  target: {
    tag: string                 // "button", "input", "a" 등
    id: string?
    class_list: string[]
    text_content: string?       // 버튼 텍스트 등 (truncated)
    aria_label: string?
    xpath: string               // 요소 위치
    selector: string            // CSS selector
  }
  data: object                  // type별 추가 데이터
                                // click: { x, y }
                                // input: { value (마스킹됨) }
                                // scroll: { scrollTop, scrollLeft }
                                // navigation: { from_url, to_url }
}
```

---

## 6. API 엔드포인트

### 버그 리포트 CRUD

```
POST   /v1/bug-reports                    # 버그 리포트 생성
GET    /v1/bug-reports                    # 버그 리포트 목록 (필터/페이지네이션)
GET    /v1/bug-reports/:id                # 버그 리포트 상세
PUT    /v1/bug-reports/:id                # 버그 리포트 수정
DELETE /v1/bug-reports/:id                # 버그 리포트 삭제
```

### 버그 리포트 생성 Request Body
```json
{
  "project_id": "uuid",
  "title": "로그인 버튼 클릭 시 무반응",
  "description": "이메일/비밀번호 입력 후 로그인 버튼이 동작하지 않음",
  "severity": "major",
  "page_url": "https://app.example.com/login",
  "environment": {
    "browser": "Chrome 120.0.6099.109",
    "os": "macOS 14.2.1",
    "viewport": { "width": 1440, "height": 900 },
    "user_agent": "Mozilla/5.0 ...",
    "device_pixel_ratio": 2
  },
  "console_logs": [
    {
      "timestamp": 3200,
      "level": "error",
      "message": "Uncaught TypeError: Cannot read property 'submit' of null",
      "stack_trace": "at handleLogin (login.js:42:15)...",
      "source_url": "https://app.example.com/static/login.js",
      "line_number": 42
    }
  ],
  "network_logs": [
    {
      "timestamp": 3100,
      "method": "POST",
      "url": "https://api.example.com/auth/login",
      "status_code": 500,
      "duration_ms": 230,
      "error": "Internal Server Error"
    }
  ],
  "recording": {
    "duration_ms": 5200,
    "dom_events": [...],
    "video_url": "presigned_upload_url"
  },
  "screenshot_urls": ["presigned_url_1", "presigned_url_2"],
  "session_id": "uuid (optional, UC2 연결)"
}
```

### 버그 리포트 생성 Response
```json
{
  "data": {
    "id": "uuid",
    "title": "로그인 버튼 클릭 시 무반응",
    "status": "open",
    "repro_steps": null,
    "ai_analysis_status": "processing",
    "share_url": "https://app.deepwork.dev/reports/abc123",
    "linear_issue": null,
    "created_at": "2026-03-12T10:00:00Z"
  }
}
```

### AI 재현 스텝 조회
```
GET /v1/bug-reports/:id/repro-steps

Response:
{
  "data": {
    "status": "completed",
    "repro_steps": [
      {
        "order": 1,
        "action": "Navigate to",
        "target": "https://app.example.com/login",
        "detail": "로그인 페이지를 연다"
      },
      {
        "order": 2,
        "action": "Type",
        "target": "이메일 입력 필드",
        "detail": "이메일 주소를 입력한다"
      },
      {
        "order": 3,
        "action": "Type",
        "target": "비밀번호 입력 필드",
        "detail": "비밀번호를 입력한다"
      },
      {
        "order": 4,
        "action": "Click",
        "target": "로그인 버튼",
        "detail": "로그인 버튼을 클릭한다"
      }
    ],
    "ai_summary": "로그인 폼 제출 시 submit 핸들러에서 null 참조 에러가 발생하여 로그인이 실패합니다. 서버에서도 500 에러가 반환되었습니다."
  }
}
```

### Linear 이슈 생성
```
POST /v1/bug-reports/:id/linear-issue

Request:
{
  "team_id": "linear_team_uuid",
  "project_id": "linear_project_uuid (optional)",
  "label_ids": ["linear_label_uuid"],
  "assignee_id": "linear_user_uuid (optional)"
}

Response:
{
  "data": {
    "linear_issue_id": "LIN-123",
    "linear_issue_url": "https://linear.app/team/issue/LIN-123"
  }
}
```

---

## 7. AI 파이프라인 설계

### 재현 스텝 생성 파이프라인

```
입력 데이터:
├─ DOM Events (클릭, 입력, 네비게이션 시퀀스)
├─ Console Logs (에러 로그 중심)
├─ Network Logs (실패 요청 중심)
└─ Page URL + 환경 정보

    │
    ▼
전처리:
├─ DOM 이벤트를 시간순 정렬
├─ 노이즈 이벤트 필터링 (스크롤, 마우스 이동 등)
├─ 핵심 유저 액션만 추출 (클릭, 입력, 네비게이션)
├─ 콘솔 에러와 시간적으로 연관된 이벤트 그룹핑
└─ 민감 정보 재확인 및 마스킹

    │
    ▼
LLM 프롬프트 구성:
├─ System: "당신은 QA 엔지니어입니다. 주어진 유저 행동 로그를 분석하여
│           누구나 따라할 수 있는 버그 재현 스텝을 작성하세요."
├─ Context: 페이지 URL, 환경 정보
├─ Events: 전처리된 이벤트 시퀀스 (JSON)
├─ Errors: 관련 콘솔/네트워크 에러
└─ Output Format: 구조화된 ReproStep[] JSON

    │
    ▼
후처리:
├─ JSON 파싱 및 검증
├─ 스텝 번호 정규화
├─ 요약(ai_summary) 생성
└─ 결과 저장 → 클라이언트 알림
```

### LLM 선택
- **Primary:** Claude API (높은 추론 품질)
- **Fallback:** 로컬 경량 모델 (비용 최적화용, 향후)
- **Rate Limiting:** 프로젝트당 분당 10건

---

## 8. UI 컴포넌트 명세

### Extension Popup (녹화 제어)
```
┌─────────────────────────┐
│  Deep Work         [⚙]  │
├─────────────────────────┤
│                         │
│  📍 app.example.com     │
│  📁 My Project (auto)   │
│                         │
│  ┌───────────────────┐  │
│  │   🔴 녹화 시작     │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │   📸 스크린샷 캡처  │  │
│  └───────────────────┘  │
│                         │
│  최근 리포트: 3건       │
└─────────────────────────┘
```

### Side Panel (리포트 작성)
```
┌──────────────────────────────┐
│  새 버그 리포트         [✕]  │
├──────────────────────────────┤
│                              │
│  제목 *                      │
│  ┌──────────────────────┐    │
│  │ 로그인 버튼 무반응     │    │
│  └──────────────────────┘    │
│                              │
│  설명                        │
│  ┌──────────────────────┐    │
│  │ (optional)            │    │
│  └──────────────────────┘    │
│                              │
│  심각도:  ◉ Critical         │
│           ○ Major            │
│           ○ Minor            │
│           ○ Trivial          │
│                              │
│  ── 자동 수집 데이터 ────────  │
│                              │
│  📸 스크린샷 (2)     [편집]   │
│  ┌────┐ ┌────┐              │
│  │ 🖼 │ │ 🖼 │              │
│  └────┘ └────┘              │
│                              │
│  🎥 녹화 (5.2초)    [미리보기]│
│                              │
│  🖥 환경: Chrome 120 / macOS │
│     1440×900                 │
│                              │
│  📋 콘솔 로그 (3건)  [펼치기] │
│  🔴 TypeError: Cannot read.. │
│                              │
│  🌐 네트워크 (12건)  [펼치기] │
│  🔴 POST /auth/login → 500  │
│                              │
│  ── AI 재현 스텝 ────────────  │
│  ⏳ 생성 중...               │
│  → 완료 시:                  │
│  1. 로그인 페이지로 이동      │
│  2. 이메일 입력               │
│  3. 비밀번호 입력             │
│  4. 로그인 버튼 클릭          │
│  [스텝 수정]                 │
│                              │
│  ── 전송 ─────────────────── │
│                              │
│  ☐ Linear Issue 생성         │
│    Team: [Engineering ▼]     │
│                              │
│  ┌──────────────────────┐    │
│  │    📤 리포트 생성      │    │
│  └──────────────────────┘    │
└──────────────────────────────┘
```

### Recording Indicator (녹화 중 표시)
```
┌─────────────────────────────────────────┐
│ 🔴 Deep Work 녹화 중 (00:05)    [⏹ 중지] │
└─────────────────────────────────────────┘
(탭 상단 고정 배너, 드래그 가능)
```

---

## 9. 성공 지표 (KPI)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 리포트 생성 완료율 | > 80% | 녹화 시작 대비 리포트 제출 비율 |
| 녹화→리포트 시간 | < 60초 | 녹화 종료 후 리포트 제출까지 평균 시간 |
| AI 재현 스텝 정확도 | > 70% | 유저가 수정 없이 채택한 비율 |
| Linear 전송 활용률 | > 50% | 리포트 대비 Linear Issue 생성 비율 |
| 주간 활성 유저 | > 60% | 설치 유저 중 주 1회 이상 리포트 생성 |
| 비개발자 사용 비율 | > 30% | 전체 리포트 중 비개발자(PM/디자이너)가 생성한 비율 |

---

## 10. 범위 외 (Out of Scope)

- 모바일 브라우저 지원
- 네이티브 앱 버그 리포팅
- Jira/GitHub Issues 연동 (Phase 2)
- AI 심각도 자동 추천 (Phase 2)
- 중복 버그 자동 감지 (Phase 2)
- 버그 리포트 코멘트/스레드
- 버그 리포트 일괄 관리 (bulk actions)

---

## 11. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| AI 재현 스텝 품질이 낮을 경우 | 유저 신뢰도 하락 | 유저 편집 기능 제공 + 피드백으로 프롬프트 개선 |
| Manifest V3 제한으로 백그라운드 녹화 어려움 | 기능 제한 | Service Worker 최적화 + offscreen document 활용 |
| 녹화 데이터 크기가 클 경우 | 업로드 느림/비용 증가 | 클라이언트 사이드 압축 + 이벤트 기반 녹화(비디오 대신) |
| 민감정보 유출 | 보안/법적 리스크 | 자동 마스킹 + 유저 리뷰 단계 필수 |
| 기업 보안 정책으로 확장 설치 불가 | 고객 이탈 | 관리자 콘솔 제공, Chrome Enterprise 정책 호환 |

---

## 12. 기술 구현 참고

### Content Script 이벤트 캡처
```
캡처 대상:
├─ DOM Events: click, input, change, submit, keydown (특정), scroll
├─ Navigation: pushState, replaceState, popstate, hashchange
├─ Console: console.log/warn/error/info 오버라이드
├─ Network: XMLHttpRequest + fetch API 인터셉트
└─ Errors: window.onerror, unhandledrejection

마스킹 대상:
├─ input[type="password"] 값
├─ Authorization / Cookie 헤더
├─ 커스텀 마스킹 패턴 (설정 가능)
└─ 요청/응답 body의 token/secret/key 패턴
```

### 데이터 전송 전략
```
녹화 중:
├─ 이벤트를 메모리 버퍼에 누적 (5초 단위)
├─ 버퍼가 1MB 초과 시 Background SW로 전달
└─ Background SW에서 IndexedDB에 임시 저장

녹화 종료:
├─ 전체 이벤트 데이터 JSON 직렬화
├─ gzip 압축
├─ Presigned URL로 S3에 직접 업로드
└─ 메타데이터만 API 서버로 전송
```
