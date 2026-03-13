# Deep Work Phase 1 — E2E 테스트 리포트

> 테스트 일시: 2026-03-12
> 환경: macOS, Node.js 22.12.0, Chrome Extension Manifest V3
> API: http://localhost:3001 | Web: http://localhost:3000

---

## 테스트 요약

| 카테고리 | 통과 | 실패 | 수정 후 통과 | 총 |
|---------|------|------|------------|-----|
| API Bug Reports CRUD | 6 | 0 | - | 6 |
| API AI Pipeline | 2 | 0 | - | 2 |
| API Sessions CRUD | 4 | 1 | ✅ (FK 수정) | 4 |
| API Baselines CRUD | 2 | 1 | ✅ (cascade 수정) | 2 |
| API Visual Diffs | 2 | 0 | - | 2 |
| API Error Handling | 1 | 0 | - | 1 |
| Web Dashboard | 4 | 1 | ✅ (duration 필드명) | 4 |
| Extension Build | 4 | 0 | - | 4 |
| **합계** | **25** | **3** | **3/3 수정됨** | **25** |

**최종 결과: ✅ 25/25 PASS (수정 포함)**

---

## 1. API E2E 테스트

### 1.1 Bug Reports CRUD

| # | 테스트 | 결과 | 상세 |
|---|--------|------|------|
| T1 | GET /v1/bug-reports (목록) | ✅ | 4개 리포트 반환, request_id 포함 |
| T2 | POST /v1/bug-reports (생성) | ✅ | ID 발급, severity=major, AI status=pending |
| T3 | GET /v1/bug-reports/:id (상세) | ✅ | AI 분석 completed, 재현 스텝 5개 생성 |
| T4 | PUT /v1/bug-reports/:id (수정) | ✅ | status→in_progress, title 변경 확인 |
| T5 | GET ?page=1&limit=2 (페이지네이션) | ✅ | 2개 반환, total=5, page=1 |
| T6 | DELETE /v1/bug-reports/:id | ✅ | deleted: true, 목록에서 제거 확인 |

### 1.2 AI Pipeline

| # | 테스트 | 결과 | 상세 |
|---|--------|------|------|
| T7 | 비동기 AI 분석 (POST 후 2초 대기) | ✅ | pending → completed 전환 |
| T8 | POST /v1/ai/repro-steps (직접 호출) | ✅ | 7개 스텝 생성, object target 정상 변환 |

**AI 재현 스텝 검증 (T8):**
```
Step 1: [navigate] Navigate to https://example.com/login.
Step 2: [click] Click on the 'input#email-input'.
Step 3: [input] Enter 'user@test.com' into the 'input#email-input' field.
Step 4: [click] Click on the 'input#password-input'.
Step 5: [input] Enter '********' into the 'input#password-input' field.
Step 6: [click] Click on the 'button "Login"'.
Step 7: [observe] Observe error: 401 Unauthorized - Invalid credentials.
```
→ `[object Object]` 없이 모든 타겟이 읽기 쉬운 문자열로 변환됨

### 1.3 Sessions CRUD

| # | 테스트 | 결과 | 상세 |
|---|--------|------|------|
| T9a | POST /v1/sessions | ❌→✅ | FK 제약 오류: `'default'` → `'proj-default'` 수정 |
| T9b | GET /v1/sessions | ✅ | 1개 세션 반환 |
| T9c | PUT /v1/sessions/:id | ✅ | duration, pageCount, eventCount 업데이트 |
| T9d | GET /v1/sessions/:id (확인) | ✅ | durationMs=60000, eventCount=142 |

### 1.4 Baselines + Visual Diffs

| # | 테스트 | 결과 | 상세 |
|---|--------|------|------|
| T10 | POST /v1/baselines | ✅ | viewport JSON, screenshotUrl 포함 |
| T11 | GET /v1/baselines | ✅ | 1개 반환, viewport 파싱 정상 |
| T12 | POST /v1/visual-diffs | ✅ | baseline 참조, aiAnalysisStatus=pending |
| T13 | GET /v1/visual-diffs/:id | ✅ | 전체 데이터 반환 |
| T14 | DELETE /v1/baselines/:id | ❌→✅ | cascade delete 추가 (visual-diffs 먼저 삭제) |

### 1.5 Error Handling

| # | 테스트 | 결과 | 상세 |
|---|--------|------|------|
| T15 | GET /v1/bug-reports/nonexistent | ✅ | 404, code: NOT_FOUND |

---

## 2. Web Dashboard E2E 검증

| # | 페이지 | 결과 | 상세 |
|---|--------|------|------|
| W1 | 대시보드 (`/`) | ✅ | StatCard 3개 (버그:4, 세션:1, 시각적:0), 최근 버그 목록 |
| W2 | 버그 목록 (`/bug-reports`) | ✅ | 4개 행, severity/status 배지 색상, 필터 드롭다운 |
| W3 | 버그 상세 (`/bug-reports/[id]`) | ✅ | 환경정보, AI 분석(완료/요약/재현3스텝), 콘솔/네트워크 로그 |
| W4 | 세션 리플레이 (`/sessions`) | ❌→✅ | `duration` → `durationMs` 필드명 수정 후 "1m 0s" 표시 |
| W5 | 시각적 테스트 (`/visual`) | ✅ | 통계 카드 4개, empty state |

---

## 3. Extension 빌드 검증

| # | 항목 | 결과 | 상세 |
|---|------|------|------|
| E1 | Manifest V3 준수 | ✅ | 모든 필수 필드 검증 통과 (9/9) |
| E2 | 빌드 파일 완전성 | ✅ | 7개 필수 파일 + 5개 JS 번들 |
| E3 | Content Script 기능 | ✅ | click, input, console, network, 메시지 9/9 통과 |
| E4 | Background SW 기능 | ✅ | recording, capture, storage, screenshot 6/6 통과 |

**빌드 크기:**
- 총 번들: ~212 KB (gzip ~68 KB)
- React 공유 번들: 194 KB
- Content Script: 2.74 KB
- Popup: 4.12 KB
- SidePanel: 8.33 KB

---

## 4. 테스트 중 발견 및 수정한 버그

### Bug 1: Sessions/Baselines/VisualDiffs FK 제약 오류
- **증상:** POST 시 500 Internal Server Error
- **원인:** 기본값 `'default'`가 실제 seed ID(`'proj-default'`, `'user-default'`)와 불일치
- **수정:** `sessions.ts`, `baselines.ts`, `visual-diffs.ts`의 기본값을 올바른 seed ID로 변경

### Bug 2: Baseline DELETE cascade 미처리
- **증상:** visual diff가 참조하는 baseline 삭제 시 500 에러
- **원인:** 외래키 참조 visual diff를 먼저 삭제하지 않음
- **수정:** `baselines.ts` DELETE에 관련 visual diffs 선 삭제 로직 추가, `visual-diffs.ts`에 DELETE 엔드포인트 추가

### Bug 3: 세션 페이지 Duration 미표시
- **증상:** Duration 컬럼에 `-` 표시
- **원인:** `Session` 인터페이스의 `duration` 필드명이 API 응답의 `durationMs`와 불일치
- **수정:** 인터페이스와 렌더링 코드의 필드명을 `durationMs`로 통일

---

## 5. 수정된 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `packages/api/src/routes/sessions.ts` | FK 기본값 수정 |
| `packages/api/src/routes/baselines.ts` | FK 기본값 수정, cascade delete 추가 |
| `packages/api/src/routes/visual-diffs.ts` | FK 기본값 수정, DELETE 엔드포인트 추가 |
| `packages/web/src/app/sessions/page.tsx` | `duration` → `durationMs` 필드명 수정 |

---

## 6. 다음 단계 권장사항

1. **Chrome에서 실제 Extension 로드 테스트** — `dist/` 디렉토리를 `chrome://extensions`에서 로드
2. **자동화 테스트 스크립트 작성** — 위 E2E 테스트를 쉘 스크립트로 자동화
3. **Mock AI → Claude API 교체** — 실제 LLM 기반 재현 스텝 생성
4. **UC2 세션 리플레이 구현** — 이벤트 녹화 저장, 리플레이 플레이어 UI
5. **UC3 시각적 회귀 테스트 구현** — 스크린샷 비교, 변경 분류
