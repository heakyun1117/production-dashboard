# i-SENS Dashboard Backend (Step1) — 실행 방법

## 0) 폴더 구조
- main.py : FastAPI 엔트리(서버)
- core.py : Step1 로직 엔진(파싱/판정/디테일 요약)
- requirements.txt : 필요 패키지 목록

## 1) 설치(처음 1회)
Windows PowerShell 기준:

```bash
cd isens_backend_step1
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## 2) 실행
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

브라우저에서:
- http://127.0.0.1:8000/health
- API 문서: http://127.0.0.1:8000/docs

## 3) Step1 API
### 업로드
- POST `/api/v1/measurements/upload`
- form-data key: `files` (여러 개)

### 시트 디테일
- GET `/api/v1/measurements/sheets/{jobId}/{sheetKey}`

> sheetKey는 업로드 응답의 sheets[].sheetKey 값을 그대로 URL 인코딩해서 넣으면 됩니다.
