# dashboard-ui SKILL

## 목적
React + Vite + Tailwind 기반으로 현장 작업자/관리자 대시보드를 구현한다.

## 기술 스택
- React + Vite
- Tailwind CSS
- Zustand (전역 상태)

## 화면 구성 규칙
- 총 10개 탭: 작업자 7 + 관리자 3
- 작업자는 자기 공정 탭만 집중해서 보도록 구성
- 탭 이동 시 데이터가 사라지지 않도록 Zustand persist 전략 적용

## UX 기준
- 27인치 QHD(2560×1440) 기준
- 최소 조작 영역 44px
- 본문 16px+, 라벨 13px+, 차트 수치 14px+

## 색상 가이드
- Primary: `#171C8F`
- Secondary: `#2D68C4`
- Accent: `#88A7E1`
- Background: `#EDF1FE`

## 용어 규칙
- X/Y 용어 금지
- 반드시 `←좌 / 우→`, `↑상 / 하↓` 사용

## 구현 체크리스트
- 탭 전환/새로고침 후 상태 유지 확인
- 표 헤더 말줄임 금지(줄바꿈 허용)
- 한국어 UI 텍스트 일관성 확인

## 다크 테마 디자인 가이드

### 색상 팔레트
| 용도 | 변수 | 색상 코드 |
|------|------|----------|
| 배경 | bg | #0F172A (슬레이트 900) |
| 카드 | card | #1E293B (슬레이트 800) |
| 테두리 | border | #334155 (슬레이트 700) |
| 본문 텍스트 | text | #F1F5F9 |
| 보조 텍스트 | textDim | #94A3B8 |
| OK | ok | #2D68C4 (i-SENS Blue) |
| CHECK | check | #F59E0B |
| NG | ng | #EF4444 |
| Primary | accent | #171C8F (i-SENS Primary) |
| Accent | green | #78BE20 (i-SENS Green) |

### 테이블 스타일
- 헤더: palette.accent 배경, 흰색 텍스트
- 홀수행: palette.card
- 짝수행: palette.bg
- 판정 배지: 둥근 모서리 (borderRadius 12px), 판정 색상 배경, 흰색 텍스트
- 호버: palette.border 배경

### AI 코멘트 패널
- 배경: palette.card
- 왼쪽 accent 바: 4px, palette.accent
- 아이콘: 💡
- 제목: "AI 분석 코멘트", palette.text
- 내용: palette.textDim

### 요약 카드
- 3개 가로 배치 (OK/CHECK/NG)
- 배경: 각 판정 색상의 10% 불투명도
- 숫자: 큰 글씨 (32px), 판정 색상
- 라벨: palette.textDim
