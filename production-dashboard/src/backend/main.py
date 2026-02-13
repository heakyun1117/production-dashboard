from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from parsers.csv_parser import parse_printing_csv

BASE_DIR = Path(__file__).resolve().parents[2]
SAMPLE_PRINTING_CSV = BASE_DIR / "data" / "samples" / "0122_printing-A_SET_298.csv"

app = FastAPI(title="Production Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/process/printing/latest")
def get_latest_printing() -> dict:
    if not SAMPLE_PRINTING_CSV.exists():
        raise HTTPException(status_code=404, detail="프린팅 샘플 CSV를 찾을 수 없습니다.")

    try:
        return parse_printing_csv(SAMPLE_PRINTING_CSV)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"CSV 파싱 실패: {exc}") from exc
