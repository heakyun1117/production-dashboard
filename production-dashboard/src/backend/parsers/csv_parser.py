from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from typing import Any

CHECK_LIMIT = 0.12
NG_LIMIT = 0.15
NAME_PATTERN = re.compile(r"계산기\s+(.+?)_(\d+):")


def read_utf16_tab_block(path: Path) -> list[list[str]]:
    text = path.read_text(encoding="utf-16")
    lines = text.splitlines()

    start = next((index for index, line in enumerate(lines) if line.strip() == ":BEGIN"), None)
    end = next((index for index, line in enumerate(lines) if line.strip() == ":END"), None)

    if start is None or end is None or end <= start:
        raise ValueError(":BEGIN ~ :END 블록을 찾을 수 없습니다.")

    block = "\n".join(lines[start + 1 : end])
    return list(csv.reader(io.StringIO(block), delimiter="\t"))


def _judge(deviation: float) -> str:
    abs_deviation = abs(deviation)
    if abs_deviation >= NG_LIMIT:
        return "NG"
    if abs_deviation >= CHECK_LIMIT:
        return "CHECK"
    return "OK"


def _normalize_metric(raw: str) -> str:
    return (
        raw.replace("타발기준_", "")
        .replace("카본기준_", "카본대비_")
        .replace("좌우", "←좌 / 우→")
        .replace("상하", "↑상 / 하↓")
    )


def parse_printing_csv(path: Path) -> dict[str, Any]:
    rows = read_utf16_tab_block(path)
    row_map: dict[int, list[dict[str, Any]]] = {}

    for row in rows:
        if not row:
            continue

        label = row[0].replace('"', "")
        match = NAME_PATTERN.match(label)
        if not match:
            continue

        metric_name = _normalize_metric(match.group(1))
        row_no = int(match.group(2))

        try:
            deviation = float(row[1])
        except (ValueError, IndexError):
            continue

        row_map.setdefault(row_no, []).append(
            {
                "metricName": metric_name,
                "deviation": deviation,
                "status": _judge(deviation),
                "direction": "우측/상" if deviation >= 0 else "좌측/하",
            }
        )

    normalized_rows = []
    for row_no in range(1, 13):
        points = row_map.get(row_no, [])
        max_abs = max((abs(point["deviation"]) for point in points), default=0.0)
        row_status = "OK"
        if any(point["status"] == "NG" for point in points):
            row_status = "NG"
        elif any(point["status"] == "CHECK" for point in points):
            row_status = "CHECK"

        normalized_rows.append(
            {
                "rowNo": row_no,
                "points": points,
                "maxAbsDeviation": round(max_abs, 4),
                "rowStatus": row_status,
            }
        )

    risk_rows = [str(row["rowNo"]) for row in normalized_rows if row["rowStatus"] in {"CHECK", "NG"}]
    ai_comment = (
        "레벨1 코멘트: 현재 하판 프린팅 편차는 모두 OK 범위입니다."
        if not risk_rows
        else f"레벨1 코멘트: Row {', '.join(risk_rows)}에서 편차 리스크가 확인되었습니다. 편차 부호의 반대 방향 보정을 권장합니다."
    )

    overall_status = "OK"
    if any(row["rowStatus"] == "NG" for row in normalized_rows):
        overall_status = "NG"
    elif any(row["rowStatus"] == "CHECK" for row in normalized_rows):
        overall_status = "CHECK"

    return {
        "process": "printing-bottom",
        "source": path.name,
        "limits": {"check": CHECK_LIMIT, "ng": NG_LIMIT},
        "overallStatus": overall_status,
        "aiComment": ai_comment,
        "rows": normalized_rows,
    }
