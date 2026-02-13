from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException

from parsers.dispensing_parser import DispensingParseError, parse_dispensing_rows
from parsers.printing_parser import parse_printing_rows

app = FastAPI(title="Production Dashboard API", version="0.1.0")

ROOT = Path(__file__).resolve().parents[2]
SAMPLES_DIR = ROOT / "data" / "samples"


def _filename_order_key(path: Path) -> tuple:
    """신규 규칙 우선 정렬 + 레거시 파일 fallback."""
    stem = path.stem
    parts = stem.split("_")
    # {date}_{processLine}_{lot}_{status}_{sheetOrder}_{memo?}.csv
    if len(parts) >= 5 and parts[0].isdigit() and len(parts[0]) == 6 and parts[4].isdigit():
        date_part = parts[0]
        status = parts[3]
        order = int(parts[4])
        status_weight = {"SET": 0, "TEST": 1, "PRD": 2}.get(status, -1)
        return (2, date_part, status_weight, order, path.name)

    # 레거시: mtime 최신순 기준
    stat = path.stat()
    return (1, datetime.fromtimestamp(stat.st_mtime).isoformat(), 0, 0, path.name)


@app.get("/api/process/printing/latest")
def get_latest_printing() -> dict[str, Any]:
    if not SAMPLES_DIR.exists():
        raise HTTPException(status_code=404, detail="data/samples 디렉토리가 없습니다.")

    candidates = sorted(
        SAMPLES_DIR.glob("*.csv"),
        key=_filename_order_key,
        reverse=True,
    )
    printing_files = [p for p in candidates if "printing" in p.name.lower() or "프린팅" in p.name]

    if not printing_files:
        raise HTTPException(status_code=404, detail="프린팅 CSV 파일을 찾지 못했습니다.")

    latest = printing_files[0]
    parsed = parse_printing_rows(latest)

    return {
        "ok": True,
        "latestFile": latest.name,
        "data": parsed,
    }


@app.get("/api/dispensing")
def get_dispensing(file: str | None = None) -> dict[str, Any]:
    if not SAMPLES_DIR.exists():
        raise HTTPException(status_code=404, detail="data/samples 디렉토리가 없습니다.")

    if file:
        target = SAMPLES_DIR / file
    else:
        candidates = sorted(SAMPLES_DIR.glob("*dispensing*.csv"), key=lambda p: p.name)
        if not candidates:
            raise HTTPException(status_code=404, detail="분주 CSV 파일을 찾지 못했습니다.")
        target = candidates[-1]

    if not target.exists() or target.suffix.lower() != ".csv":
        raise HTTPException(status_code=404, detail="요청한 CSV 파일이 존재하지 않습니다.")

    try:
        parsed = parse_dispensing_rows(target)
    except DispensingParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"CSV 파싱 실패: {exc}") from exc

    return {
        "ok": True,
        "file": target.name,
        "data": parsed,
    }
