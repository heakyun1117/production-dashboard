from __future__ import annotations

import re
from pathlib import Path
from statistics import mean, pstdev

from .csv_parser import read_utf16_tab_block

OUTLIER_THRESHOLD = 3.0


class DispensingParseError(ValueError):
    """분주 CSV 구조가 기대와 다를 때 발생."""


def _to_float(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_index(label: str) -> int | None:
    match = re.search(r"_(\d+):", label)
    return int(match.group(1)) if match else None


def _build_stats(values: list[float]) -> dict[str, float]:
    if not values:
        return {
            "count": 0,
            "mean": 0.0,
            "stdDev": 0.0,
            "min": 0.0,
            "max": 0.0,
            "cv": 0.0,
        }

    avg = mean(values)
    std = pstdev(values) if len(values) > 1 else 0.0
    cv = (std / avg * 100) if avg != 0 else 0.0

    return {
        "count": len(values),
        "mean": round(avg, 4),
        "stdDev": round(std, 4),
        "min": round(min(values), 4),
        "max": round(max(values), 4),
        "cv": round(cv, 2),
    }


def _sigma_status(value: float, avg: float, std: float) -> str:
    if std == 0:
        return "OK"

    z = abs((value - avg) / std)
    if z > 2:
        return "NG"
    if z > 1:
        return "CHECK"
    return "OK"


def parse_dispensing_rows(path: Path) -> dict:
    rows = read_utf16_tab_block(path)

    area_values: dict[int, float] = {}
    spacing_values: dict[int, float] = {}

    for row in rows:
        if len(row) < 2:
            continue

        label = row[0].strip().strip('"')
        value = _to_float(row[1])
        if value is None:
            continue

        idx = _extract_index(label)
        if idx is None:
            continue

        if "분주면적" in label:
            area_values[idx] = value
        elif "분주간격" in label:
            spacing_values[idx] = value

    if not area_values or not spacing_values:
        raise DispensingParseError("분주면적/분주간격 데이터를 찾지 못했습니다.")

    set_count = min(len(area_values) // 2, len(spacing_values))
    if set_count == 0:
        raise DispensingParseError("면적 2개 + 간격 1개 세트 구성에 필요한 데이터가 부족합니다.")

    sets: list[dict] = []
    area_all: list[float] = []
    area_filtered: list[float] = []
    spacing_all: list[float] = []

    for set_idx in range(1, set_count + 1):
        area1 = area_values.get(set_idx * 2 - 1)
        area2 = area_values.get(set_idx * 2)
        spacing = spacing_values.get(set_idx)
        if area1 is None or area2 is None or spacing is None:
            continue

        outlier1 = area1 < OUTLIER_THRESHOLD
        outlier2 = area2 < OUTLIER_THRESHOLD
        outlier = outlier1 or outlier2

        area_avg = (area1 + area2) / 2

        area_all.extend([area1, area2])
        spacing_all.append(spacing)

        if not outlier1:
            area_filtered.append(area1)
        if not outlier2:
            area_filtered.append(area2)

        sets.append(
            {
                "index": set_idx,
                "area1": round(area1, 4),
                "area2": round(area2, 4),
                "areaAvg": round(area_avg, 4),
                "spacing": round(spacing, 4),
                "outlier": outlier,
                "outlierAreaCount": int(outlier1) + int(outlier2),
            }
        )

    area_filtered_stats = _build_stats(area_filtered)
    spacing_stats = _build_stats(spacing_all)

    for item in sets:
        area_status = _sigma_status(item["areaAvg"], area_filtered_stats["mean"], area_filtered_stats["stdDev"])
        spacing_status = _sigma_status(item["spacing"], spacing_stats["mean"], spacing_stats["stdDev"])

        if item["outlier"]:
            item["judgement"] = "NG"
        elif "NG" in (area_status, spacing_status):
            item["judgement"] = "NG"
        elif "CHECK" in (area_status, spacing_status):
            item["judgement"] = "CHECK"
        else:
            item["judgement"] = "OK"

    status_count = {"OK": 0, "CHECK": 0, "NG": 0}
    for item in sets:
        status_count[item["judgement"]] += 1

    outlier_count = sum(item["outlierAreaCount"] for item in sets)

    return {
        "process": "dispensing",
        "sourceFile": path.name,
        "setCount": len(sets),
        "outlierCount": outlier_count,
        "counts": status_count,
        "stats": {
            "areaFiltered": area_filtered_stats,
            "areaAll": _build_stats(area_all),
            "spacing": spacing_stats,
        },
        "rows": sets,
    }
