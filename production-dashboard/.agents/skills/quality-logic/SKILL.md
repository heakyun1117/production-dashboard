# quality-logic SKILL

## 목적
품질 판정, 마진 계산, 보정값 추천, AI 코멘트 생성의 기준 로직을 정의한다.

## 1) 3단계 판정
- OK / CHECK / NG
- 기본 임계:
  - CHECK: |d| >= 0.12mm
  - NG: |d| >= 0.15mm

## 2) 공정별 허용범위
- 프린팅: CHECK ±0.12, NG ±0.15
- 로우슬리터: 공정 규격 우선(기본 ±0.10 참조 가능)
- 샘플검사: NG ±0.15
- 상세 값 충돌 시 project-reference 우선

## 3) 마진 계산식
```text
margin = limit - abs(deviation)
marginRate(%) = (margin / limit) * 100
```

## 4) 보정값 계산
```text
correction = -deviation * factor
```
- 기본 factor = 1.0
- 과보정 이력 있으면 factor < 1.0 적용

## 5) AI 코멘트 4레벨
1. 단일공정
2. 공정연동
3. 트렌드기반
4. 학습기반

## 6) 이상치 판별
- 단일 포인트 급변
- 연속 CHECK 누적
- 연속 NG 즉시 경보

## 7) 95점 만족도 연계

UI 구현 시 아래 6항목을 반드시 충족해야 한다:
1. 정보 접근성 (20점): 스크롤 없이 요약 + 테이블 즉시 표시
2. 방향 직관성 (15점): X/Y 용어 0건
3. 보정 안내 (20점): 모든 편차에 correctionText() 적용
4. 시각화 품질 (15점): InlineDeviationBar + BiasCompass 필수
5. 시뮬레이션 (15점): 입력 → 즉시 Before/After 비교
6. 긴급 대응 (15점): NG행 빨간 강조 + AI코멘트 최우선 안내

## 8) RowSummary 표준 타입

각 Row의 최악 편차를 기준으로 판정한다:
- worst = max(|leftRight|, |upDown|)
- worstAxis = worst가 leftRight에서 나왔으면 '좌우', upDown이면 '상하'
- status = getStatus(worst)

이 타입은 요약카드, AI코멘트, 시뮬레이션에서 공통으로 사용.

## 9) 보정값 전달 프로토콜

공정 간 보정 요청 시 아래 정보를 전달:
- 요청 공정 (from)
- 대상 공정 (to)
- 보정 방향 (좌우/상하)
- 보정 크기 (mm)
- 근거 (어떤 편차 때문인지)
- 긴급도 (일반/긴급)
