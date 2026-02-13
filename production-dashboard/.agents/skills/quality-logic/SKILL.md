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
