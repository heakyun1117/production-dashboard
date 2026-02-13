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
