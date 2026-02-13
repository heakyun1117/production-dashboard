# data-flow SKILL

## 목적
FastAPI 기반으로 데이터 수집/가공/학습 3-레이어 흐름을 구축한다.

## 아키텍처
```text
data/
  raw/
  processed/
  learning/
```

## 백엔드
- Python FastAPI
- CSV 파싱 서비스
- 폴더 감시(watchdog) 자동 로딩

## 권장 API
- `POST /api/v1/upload` : CSV 업로드
- `GET /api/v1/sets/{setNo}` : SET 단위 조회
- `GET /api/v1/process/{name}/latest` : 공정 최신 데이터
- `POST /api/v1/adjustments/recommend` : 보정 추천
- `POST /api/v1/learning/feedback` : 적용 결과 피드백

## 폴더 감시 흐름
1. raw 신규 파일 감지
2. 파서 실행
3. processed JSON 저장
4. 필요 시 learning 로그 반영

## 체크리스트
- 중복 파일 처리 idempotent 보장
- 파싱 실패 파일 격리 및 재처리 가능
- API 응답에 상태/원인 코드 명시
