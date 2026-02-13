# 🗂️ i-SENS 대시보드 v3 — 종합 실행 계획서 (개정판)

> 작성일: 2026-02-13 (개정)
> 목적: Codex + Claude Code Teams를 활용한 대시보드 재구축
> 대상: 코딩 비전문가가 AI 에이전트를 활용하여 프로덕션급 대시보드를 만드는 전체 로드맵
> 변경: 11개 개선사항 반영, 에이전트 6명 팀 구성(모델 분리), 시각 개선 루프 추가

---

## 📌 Part 1: Codex 생태계 이해

### 1.1 Codex란?

OpenAI의 코딩 에이전트. 3가지 사용 방식:

| 방식 | 설명 | 우리 상황 |
|------|------|-----------|
| **웹 (chatgpt.com/codex)** | 브라우저에서 GitHub 연결 후 작업 | ✅ Windows 사용 가능 |
| **데스크톱 앱** | macOS 전용, 멀티 에이전트 병렬 | ❌ Windows 미지원 |
| **CLI** | `npm i -g @openai/codex` | ✅ Windows 가능 |

**우리는 웹(chatgpt.com/codex)을 주로 사용.**

### 1.2 핵심 개념

#### ① 프로젝트 = GitHub 저장소
`heakyun1117/production-dashboard`

#### ② 스레드 = 개별 작업 단위
웹에서는 한 번에 1개 작업. 작게 나눠서 순서대로 진행.

#### ③ 스킬 = .agents/skills/ 의 SKILL.md
Codex가 작업 시 자동으로 관련 스킬을 찾아 읽고 따름.

### 1.3 스킬 시스템

**Progressive Disclosure:**
```
시작 → 스킬 이름+설명만 읽음
요청 → 매칭 스킬 선택 → SKILL.md 전체 로드
작업 중 → 필요한 참조만 추가 로드
```

**우리 프로젝트 커스텀 스킬 9개:**

| 스킬 | 용도 |
|------|------|
| csv-parser | CSV 5종 파싱 규칙 |
| dashboard-ui | UI 구축 + 현장 UX |
| chart-viz | 차트/시각화 디자인 |
| quality-logic | 판정/마진/보정 로직 |
| report-export | 보고서 PDF 출력 |
| data-flow | 데이터 흐름/상태관리 |
| trend-analysis | 트렌드/이상감지 |
| **worker-persona** | 작업자 관점 UX 시뮬 ← NEW |
| **manager-persona** | 관리자 관점 공정연동 시뮬 ← NEW |

### 1.4 AGENTS.md

```
읽는 순서:
1. ~/.codex/AGENTS.md (글로벌)
2. 저장소 루트/AGENTS.md ← 우리 파일 (~14KB)
3. 하위 디렉토리/AGENTS.md
32KB 합산 제한 → 14KB는 충분
```

### 1.5 Codex 웹 제한

| 제한 | 대응 |
|------|------|
| 한 번에 1작업 | Phase를 작게 나눠 순서대로 |
| 워크트리 없음 | 파일 충돌 주의 |
| 렌더링 미리보기 불가 | 시각 개선은 Teams 단계에서 |
| 인터넷 차단 | npm 패키지 사전 설치 목록 |

---

## 📌 Part 2: 프로젝트 구조

### 2.1 GitHub 저장소 파일 구조

```
production-dashboard/
├── AGENTS.md                          ← 프로젝트의 뇌 (14KB)
├── README.md
├── .agents/skills/                    ← 커스텀 스킬 9개
│   ├── csv-parser/SKILL.md
│   ├── dashboard-ui/SKILL.md
│   ├── chart-viz/SKILL.md
│   ├── quality-logic/SKILL.md
│   ├── report-export/SKILL.md
│   ├── data-flow/SKILL.md
│   ├── trend-analysis/SKILL.md
│   ├── worker-persona/SKILL.md       ← NEW
│   └── manager-persona/SKILL.md      ← NEW
├── docs/
│   ├── project-reference.md           ← 부호 방향 정본
│   ├── field-feedback.md
│   └── execution-plan.md              ← 이 파일
├── data/
│   ├── samples/                        ← CSV 샘플 5개
│   ├── raw/{공정}/{날짜}/             ← 원본 CSV 저장소
│   ├── processed/{공정}/{날짜}/       ← 가공 JSON
│   └── learning/                       ← 학습/피드백 데이터
├── assets/drawings/
└── src/
    ├── frontend/
    └── backend/
```

### 2.2 업로드 전 체크리스트

- [ ] AGENTS.md 루트에 위치
- [ ] .agents/skills/ 9개 스킬 확인
- [ ] data/samples/ CSV 5개 확인
- [ ] docs/project-reference.md 부호 방향 정본 확인
- [ ] assets/drawings/ 도면 7개 확인

---

## 📌 Part 3: Codex 실행 계획 (Day 1~3)

### 전체 로드맵

```
Day 1
├── Step 0: GitHub 세팅 + 환경 확인
├── Phase 1: CSV 파싱 엔진 (백엔드)
└── Phase 2: 프론트엔드 기본 구조 + 데이터 아키텍처

Day 2
├── Phase 3: 공정별 페이지 (하판, 상판, 분주)
└── Phase 4: 공정별 페이지 (로우슬리팅, 50T, 조립)

Day 3
├── Phase 5: 차트/시각화 v1
├── Phase 6: 판정 로직 + 마진 계산 + AI 코멘트 기본
└── Phase 7: 기본 통합

Day 4~ (Claude Code Teams — 6명 에이전트)
├── Phase 8: 공정 연동 시뮬레이션
├── Phase 9: AI 코멘트 고도화 (4단계)
├── Phase 10: 트렌드 분석 + 학습 데이터
├── Phase 11: 보고서 + 관리자 종합
├── Phase 12: 시각 개선 피드백 루프 (v2, v3...)
└── Phase 13: UX 최종 검수
```

---

### Step 0: GitHub 저장소 세팅

**프롬프트:**
```
AGENTS.md를 읽고 프로젝트 구조를 파악해줘.
.agents/skills/ 폴더의 모든 스킬 목록을 보여주고,
data/samples/에 있는 CSV 파일들도 확인해줘.
모든 것이 정상적으로 인식되는지 알려줘.
```

---

### Phase 1: CSV 파싱 엔진

**프롬프트:**
```
[Phase 1] CSV 파싱 엔진을 만들어줘.

참고: .agents/skills/csv-parser/SKILL.md, AGENTS.md 섹션 8
데이터: data/samples/의 CSV 5개
부호 방향 정본: docs/project-reference.md 섹션 5

작업 순서:
1. AGENTS.md + csv-parser 스킬 읽고 요구사항 파악
2. 구현 계획 먼저 세워줘
3. 확인 후 코딩 시작

구현:
- src/backend/parsers/ 모듈별 분리
- base.py (UTF-16 BOM + 탭 + BEGIN/END 공통)
- detector.py (파일 타입 자동 감지)
- printing.py, electrode.py, dispensing.py, row_slitter.py, sample_test.py
- 통일된 JSON 구조 출력

테스트: data/samples/ 각 파일 파싱 → 값 검증

절대 규칙:
- 파일당 1,500줄 기본 제한 (초과 시 분리)
- 가장 단순한 로우슬리터부터 시작
- Q값 최적화 엔진 불필요 (구현하지 말 것)
```

**예상**: 15~30분
**확인**: 5개 CSV 파싱 성공 + JSON 출력

---

### Phase 2: 프론트엔드 기본 구조 + 데이터 아키텍처

**프롬프트:**
```
[Phase 2] 프론트엔드 기본 구조를 만들어줘.

참고: .agents/skills/dashboard-ui/SKILL.md, data-flow/SKILL.md

작업:
1. src/frontend/ — React + Vite + Tailwind CSS
2. Zustand 스토어 (탭 이동 시 데이터 유지)
3. 기본 레이아웃:
   - AppShell (사이드바 260px + 메인)
   - Sidebar 공정 탭 10개 (작업자 7 + 관리자 3)
   - i-SENS CI 색상
4. React Router 10개 페이지
5. data/ 폴더 구조 생성:
   - raw/{공정}/{날짜}/ — 원본 CSV 저장
   - processed/{공정}/{날짜}/ — 가공 JSON
   - learning/ — 학습 데이터 (adjustment_log, pattern_library, correction_factors)

디자인 기준:
- 27인치 QHD (2560×1440) 기준 설계
- 본문 16px+, 라벨 13px+, 차트 수치 14px+
- 최소 44px 클릭 영역
- 모바일 불필요

절대 규칙:
- UI 텍스트 전부 한국어
- X/Y 금지 → "←좌/우→", "↑상/하↓"
- 파일당 1,500줄 제한
```

**예상**: 15~30분
**확인**: npm run dev → 기본 레이아웃 + 탭 네비게이션

---

### Phase 3-4: 공정별 페이지

**각 페이지마다 별도 Codex 작업!**

**Phase 3a — 하판 프린팅:**
```
[Phase 3a] 하판 프린팅 페이지를 만들어줘.

참고: .agents/skills/dashboard-ui/SKILL.md, chart-viz/SKILL.md
부호 방향: docs/project-reference.md 섹션 5 — 반드시 따를 것

페이지: src/frontend/src/pages/BottomPrintPage.jsx
사용자: 프린팅 담당 작업자 (자기 공정만 봄)
데이터: 프린팅CSV (47줄) + 전극면적CSV (302줄)

UI 구성:
1. AI 코멘트 패널 (상단, 접을 수 있게)
2. 데이터 로드 영역 (파일 드래그&드롭)
3. 요약 카드 (OK/CHECK/NG 개수 + 최소마진)
4. 4포인트 편차 차트 (Recharts)
5. 거리 편차 양방향 바차트
6. 마진 게이지

⚠️ X/Y 금지 → "←좌/우→", "↑상/하↓"
⚠️ 막대바 옆 수치 표시
⚠️ 테이블 중앙 정렬
⚠️ 27인치 QHD 기준 여유 있는 레이아웃
⚠️ 보정 방향 = 편차 부호의 반대
```

**Phase 3b** — 상판 프린팅 (하판과 동일 로직 재사용)
**Phase 3c** — 분주 페이지
**Phase 4a** — 로우슬리팅
**Phase 4b** — 50T 타발
**Phase 4c** — 조립/검사

---

### Phase 5: 차트/시각화 v1

```
[Phase 5] 공용 차트 컴포넌트를 만들어줘.

참고: .agents/skills/chart-viz/SKILL.md
Recharts만 사용 (다른 라이브러리 혼용 금지)

컴포넌트:
1. DeviationBar.jsx — 양방향 편차 바 (가장 중요)
   - 중심선(0), NG/CHECK 영역 배경색
   - 바 옆 수치, 방향 라벨 "←좌/우→"
2. ProcessHeatmap.jsx — 공정 히트맵
3. MarginGauge.jsx — 마진 게이지 (27인치에서 잘 보이게)
4. MiniBar.jsx — 테이블 내 미니바

⚠️ 이 단계에서는 기본 구현(v1). 
   시각적 미세조정은 Teams 단계에서 피드백 루프로 진행.
```

---

### Phase 6: 판정 로직 + AI 코멘트 기본

```
[Phase 6] 판정 로직과 AI 코멘트 기본을 구현해줘. think hard로 진행.

참고: .agents/skills/quality-logic/SKILL.md
부호 방향 정본: docs/project-reference.md 섹션 5

⚠️ 부호가 틀리면 보정 방향이 반대! 정확성 최우선.

구현:
1. src/frontend/src/utils/judgement.js — OK/CHECK/NG 판정
2. src/frontend/src/utils/margin.js — 마진(%) = (1 - |편차|/NG한계) × 100
3. src/frontend/src/utils/direction.js — 부호→방향, 보정 추천
4. src/frontend/src/utils/thresholds.js — 허용 기준 상수
5. src/backend/ai_comment/basic.py — AI 코멘트 레벨1 (단일 공정 분석)
   - "포인트3 절연 상하 마진 12%, NG 임박, 하방 0.03mm 보정 권장"

⚠️ Q값 최적화 불필요. 단순 보정 추천만 구현.
⚠️ AI 코멘트 레벨 2~4 (연동, 트렌드, 학습)는 Teams 단계에서 구현.
```

---

### Phase 7: 기본 통합

```
[Phase 7] 지금까지 만든 것들을 통합해줘.

작업:
1. 백엔드 FastAPI → 프론트엔드 데이터 흐름 연결
2. CSV 업로드 → 파싱 → JSON → 차트 표시 전체 흐름
3. AI 코멘트 레벨1이 각 공정 페이지에 표시되는지 확인
4. 탭 이동 시 데이터 유지 확인

테스트:
- data/samples/ 5개 CSV로 전체 파이프라인 검증
- 각 공정 페이지에서 데이터가 올바르게 표시되는지
- 부호/방향이 project-reference.md와 일치하는지
```

---

## 📌 Part 4: Claude Code Teams 실행 계획 (Day 4~)

### 4.1 에이전트 팀 구성 (6명)

#### 개발팀 (4명)

| 역할 | 모델 | 담당 | 이유 |
|------|------|------|------|
| 리더 | GPT-5.3-Codex | 아키텍처, 코드리뷰, 통합, 공정간 조율 | 최고 판단력 필요 |
| 백엔드 | GPT-5.2-Codex | 파싱, API, 폴더감시, 학습데이터 | 정확성 위주, 5.2 충분 |
| 프론트엔드 | GPT-5.2-Codex | UI, 상태관리, 페이지 | 구현 위주, 5.2 충분 |
| 시각화 | GPT-5.3-Codex | 차트, AI코멘트, 보고서, PDF | 미학 + 고급 판단 |

#### 시뮬레이션팀 (2명)

| 역할 | 모델 | 담당 | 이유 |
|------|------|------|------|
| 작업자 시뮬 | GPT-5.3-Codex | 공정별 작업자 관점 UX 테스트 | 현실적 추론 필요 |
| 관리자 시뮬 | GPT-5.3-Codex | 전체 흐름 + 공정연동 시나리오 | 복합 시나리오 추론 |

#### 모델 배분 근거
- **5.3 (4명)**: 리더, 시각화, 작업자시뮬, 관리자시뮬 → 판단/추론 집약
- **5.2 (2명)**: 백엔드, 프론트엔드 → 구현 집약, 비용 효율적

#### 파일 충돌 방지

| 에이전트 | 담당 폴더 | 금지 폴더 |
|----------|-----------|-----------|
| 백엔드 | `src/backend/` | `src/frontend/src/pages/` |
| 프론트엔드 | `src/frontend/src/pages/`, `store/`, `hooks/` | `src/backend/` |
| 시각화 | `src/frontend/src/components/`, `utils/` | `src/backend/parsers/` |
| 시뮬팀 | `docs/simulation-log.md` (피드백 기록만) | `src/` 전체 |

### 4.2 상호작용 흐름

```
━━━ 빌드 사이클 ━━━
리더 → 백엔드: "학습 데이터 API 구현. JSON 스키마: {...}"
리더 → 프론트엔드: "공정 연동 UI. 이 스키마 기반"
리더 → 시각화: "AI 코멘트 패널 v2. 4단계 레벨 표시"
       ↓
  리더: 취합 + 코드리뷰 + 통합

━━━ 시뮬 사이클 ━━━
작업자 시뮬 → 각 공정 페이지 테스트
  ├── "데이터 로드했는데 어디를 봐야 할지 모르겠어"
  ├── "27인치인데도 숫자가 작아"
  ├── "보정 방향을 모르겠어"
  └── → 리더에게 피드백

관리자 시뮬 → 전체 흐름 + 시나리오 테스트
  ├── "조립 마진 부족 → 프린팅 보정 요청 흐름이 없어"
  ├── "프린팅 보정 후 로우슬리터 마진 변화를 못 봐"
  ├── "기존 1차 입력값 참조해서 2차 보정값 계산 UI가 없어"
  └── → 리더에게 피드백

리더 → 피드백 정리 → 개발팀에 수정 지시
```

### 4.3 공정 연동 시뮬레이션 시나리오

```
━━━ 시나리오: 조립 마진 부족 ━━━

① 관리자 시뮬 → 시나리오 생성:
   "원자재 이슈로 양면테이프 편심 0.08mm, 마진 15%"

② 관리자 시뮬 → 작업자 시뮬(조립):
   "마진 부족. 프린팅에 좌측 0.03mm 보정 요청"

③ 작업자 시뮬(프린팅):
   "기존 1차 보정값 0.02mm 있음.
    추가 2차 보정값 0.03mm = 총 0.05mm
    내 공정 마진 확인... 45% OK, 적용 가능"

④ 관리자 시뮬:
   "프린팅 보정 후 로우슬리터 마진도 확인"
   → 전체 공정 마진 변화 리뷰

⑤ 리더: 이 전체 흐름이 대시보드에서 가능한지 검증
   → 부족한 UI/기능 → 개발팀에 지시
```

### 4.4 시각 개선 피드백 루프

```
━━━ Codex에서 안 되고 Teams에서 하는 이유 ━━━
Codex 웹: 렌더링 미리보기 불가 → 결과물을 "볼 수" 없음
Teams: 로컬 실행 + 스크린샷 → "보고 → 고치고 → 다시 보고" 가능

━━━ 루프 흐름 ━━━
시각화 에이전트 → 차트/도형 v1
       ↓
작업자 시뮬 → "4포인트 도형에서 편차 방향이 직관적이지 않아"
관리자 시뮬 → "공정 마진 게이지가 너무 작아, 한눈에 안 들어와"
       ↓
리더 → 피드백 정리 → 시각화 에이전트에 지시
       ↓
시각화 에이전트 → v2 수정
       ↓
다시 시뮬 → v3... (반복)
```

⚠️ **Codex 단계에서도 차트 v1은 만든다.** Teams에서 안 하겠다는 게 아님!
⚠️ **"보면서 고치기"가 필요한 미세 조정만 Teams 단계로 연기.**

### 4.5 Teams Phase 상세

#### Phase 8: 공정 연동 시뮬레이션
```
공정간 마진 공유 API
보정 요청 → 전달 → 반영 흐름
1차/2차 보정값 계산 UI
Before/After 비교
전 공정 마진 변화 동시 표시
```

#### Phase 9: AI 코멘트 고도화
```
레벨2 — 공정 연동: "조립 편심 증가 → 프린팅 선제 보정 권장"
레벨3 — 트렌드: "SET 295부터 우측 드리프트, 스텐실 점검"
레벨4 — 학습: "이전 패턴 0.05mm 과보정 → 0.03mm 감소 추천"
```

#### Phase 10: 트렌드 + 학습 데이터
```
SET 단위 시계열 차트
이상감지 (연속 CHECK/NG 패턴)
학습 데이터 구조:
  - adjustment_log.json (보정 추천 vs 실제 결과)
  - pattern_library.json (편차 패턴 분류)
  - correction_factors.json (보정 계수)
피드백 루프: 추천→적용→결과 기록→정확도 개선
```

#### Phase 11: 보고서 + 관리자 종합
```
PDF 원클릭 보고서
관리자 종합 페이지 (전체 공정 요약)
공정 연동 현황 대시보드
```

#### Phase 12: 시각 개선 루프
```
시뮬팀 피드백 기반 차트/도형 반복 개선
27인치 QHD에서 가독성 최적화
작업자/관리자 시점 별도 최적화
```

#### Phase 13: UX 최종 검수
```
worker-persona 스킬로 전 공정 워크스루
manager-persona 스킬로 연동 시나리오 테스트
field-feedback.md 11개 항목 전부 통과 확인
```

### 4.6 MCP 활용 (Teams 단계)

| MCP 서버 | 용도 |
|----------|------|
| Context7 | React/Recharts 최신 문서 실시간 참조 |
| Sequential Thinking | 공정 연동 시뮬레이션 복잡 로직 설계 |
| (필요시 추가) | |

---

## 📌 Part 5: Codex 사용 팁 (초보자용)

### 5.1 프롬프트 원칙

**좋은 프롬프트:**
```
[Phase 1] CSV 파서를 만들어줘.
참고: .agents/skills/csv-parser/SKILL.md
먼저 계획을 세우고, 확인 후 코딩해.
가장 단순한 로우슬리터부터 시작해.
파일당 1,500줄 기본 제한.
```

**나쁜 프롬프트:**
```
대시보드 만들어줘.
```

### 5.2 작업 흐름

```
1. chatgpt.com/codex 접속
2. production-dashboard 선택
3. 프롬프트 입력 (Phase별 복사)
4. Plan 활성화
5. 코딩 시작 → 1~30분 대기
6. 결과 diff 리뷰
7. 문제없으면 승인(Merge) → 다음 Phase
8. 문제있으면 코멘트 → 수정 요청
```

### 5.3 문제 발생 시

| 상황 | 대응 프롬프트 |
|------|--------------|
| 파싱 오류 | "data/samples/의 파일을 파싱해서 결과 보여줘" |
| 1,500줄 초과 | "이 파일을 모듈로 분리해줘" |
| X/Y 사용됨 | "UI에서 X/Y를 ←좌/우→, ↑상/하↓로 교체해줘" |
| 빌드 에러 | "npm run dev 에러 확인하고 수정해줘" |
| 방향 반대 | "docs/project-reference.md 섹션 5 기준으로 방향 검증해줘" |

---

## 📌 Part 6: 시간 추정

### Codex (Day 1~3)

| Phase | 예상 | 누적 |
|-------|------|------|
| Step 0 | 15분 | 15분 |
| Phase 1 | 30분 | 45분 |
| Phase 2 | 30분 | 1시간 15분 |
| Phase 3 (3페이지) | 45분 | 2시간 |
| Phase 4 (3페이지) | 45분 | 2시간 45분 |
| Phase 5 | 30분 | 3시간 15분 |
| Phase 6 | 30분 | 3시간 45분 |
| Phase 7 | 20분 | 4시간 5분 |
| **Codex 총** | **~4시간** | (대기/리뷰 포함 2~3일) |

### Teams (Day 4~)

| Phase | 예상 |
|-------|------|
| Phase 8 (공정연동) | 2~3시간 |
| Phase 9 (AI코멘트) | 1~2시간 |
| Phase 10 (트렌드/학습) | 2~3시간 |
| Phase 11 (보고서/관리자) | 1~2시간 |
| Phase 12 (시각개선) | 2~4시간 (루프 횟수에 따라) |
| Phase 13 (최종검수) | 1~2시간 |
| **Teams 총** | **~10~16시간** (2~4일) |

**전체: 약 5~7일 (Codex 3일 + Teams 2~4일)**

---

## 📌 Part 7: 체크리스트 (완료 시 확인)

### Codex 완료 조건 (Phase 7 이후)
- [ ] CSV 5종 파싱 성공
- [ ] FastAPI 기본 엔드포인트
- [ ] React 기본 구조 + 10개 탭
- [ ] 공정별 페이지 7개 (기본 틀)
- [ ] 차트 v1 (기본 구현)
- [ ] 판정/마진 로직
- [ ] AI 코멘트 레벨1
- [ ] Zustand 상태 유지
- [ ] data/ 3-레이어 폴더 구조

### Teams 완료 조건 (Phase 13 이후)
- [ ] 공정 연동 시뮬레이션 동작
- [ ] AI 코멘트 4단계 전부 동작
- [ ] 보정값 1차/2차 계산 UI
- [ ] 트렌드 분석 + 이상감지
- [ ] 학습 데이터 피드백 루프
- [ ] PDF 보고서 출력
- [ ] 관리자 종합 페이지
- [ ] 27인치 QHD 시각 최적화 완료
- [ ] 작업자 시뮬 피드백 반영 완료
- [ ] 관리자 시뮬 시나리오 통과
- [ ] 부호/방향 정확성 최종 확인
