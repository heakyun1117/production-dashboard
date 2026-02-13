from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

from .csv_parser import read_utf16_tab_block

CHECK_LIMIT = 0.12
NG_LIMIT = 0.15


@dataclass
class PrintingPoint:
    row: int
    leftRight: float
    upDown: float
    judgement: str


def _judge(value: float) -> str:
    abs_value = abs(value)
    if abs_value >= NG_LIMIT:
        return "NG"
    if abs_value >= CHECK_LIMIT:
        return "CHECK"
    return "OK"


def _extract_row_index(name: str) -> int | None:
    m = re.search(r"_(\d+):", name)
    if m:
        return int(m.group(1))
    return None


def parse_printing_rows(path: Path) -> dict:
    rows = read_utf16_tab_block(path)

    # 프린팅 CSV의 기본 숫자 메타(앞 6줄)는 row 인덱스가 없어 제외
    by_row: dict[int, dict[str, float]] = {}
    for row in rows:
        if not row:
            continue

        label = row[0].strip().strip('"')
        if "타발기준_카본좌우_" in label or "타발기준_카본상하_" in label:
            row_idx = _extract_row_index(label)
            if row_idx is None or len(row) < 2:
                continue
            try:
                value = float(row[1])
            except ValueError:
                continue

            by_row.setdefault(row_idx, {})
            if "좌우" in label:
                by_row[row_idx]["leftRight"] = value
            else:
                by_row[row_idx]["upDown"] = value

    points: list[PrintingPoint] = []
    for idx in sorted(by_row.keys()):
        left_right = by_row[idx].get("leftRight", 0.0)
        up_down = by_row[idx].get("upDown", 0.0)
        row_judgement = _judge(max(abs(left_right), abs(up_down)))
        points.append(
            PrintingPoint(
                row=idx,
                leftRight=left_right,
                upDown=up_down,
                judgement=row_judgement,
            )
        )

    max_dev = max((max(abs(p.leftRight), abs(p.upDown)) for p in points), default=0.0)
    status = _judge(max_dev)

    return {
        "process": "printing",
        "sourceFile": path.name,
        "rowCount": len(points),
        "metrics": {
            "maxDeviation": round(max_dev, 4),
            "avgLeftRight": round(mean([p.leftRight for p in points]) if points else 0.0, 4),
            "avgUpDown": round(mean([p.upDown for p in points]) if points else 0.0, 4),
            "status": status,
        },
        "rows": [
            {
                "row": p.row,
                "leftRight": round(p.leftRight, 4),
                "upDown": round(p.upDown, 4),
                "judgement": p.judgement,
            }
            for p in points
        ],
    }
