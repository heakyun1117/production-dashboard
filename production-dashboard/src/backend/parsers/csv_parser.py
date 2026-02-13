from __future__ import annotations

import csv
from pathlib import Path


def read_utf16_tab_block(path: Path) -> list[list[str]]:
    """UTF-16 LE BOM + 탭 구분자 CSV에서 :BEGIN~:END 구간만 읽는다."""
    text = path.read_text(encoding="utf-16")
    lines = text.splitlines()

    start = next((i for i, line in enumerate(lines) if line.strip().lstrip("\ufeff") == ":BEGIN"), None)
    end = next((i for i, line in enumerate(lines) if line.strip() == ":END"), None)

    if start is None or end is None or end <= start:
        raise ValueError(f":BEGIN/:END 블록을 찾을 수 없습니다: {path}")

    block = lines[start + 1 : end]
    return list(csv.reader(block, delimiter="\t"))
