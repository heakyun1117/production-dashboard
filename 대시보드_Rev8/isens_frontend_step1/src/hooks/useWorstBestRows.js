import { useMemo, useState } from "react";

/**
 * useWorstBestRows — Worst 5 / Best 5 Row 선택 공용 훅
 *
 * @param {Array} rows      - 전체 Row 배열 (최대 12개)
 * @param {Function} scoreFn - (row) => number : Row 하나의 최대 |편차|
 * @param {number} count     - 표시할 Row 수 (default 5)
 * @returns {{ mode, setMode, displayRows: [{ row, score, rank }] }}
 */
export default function useWorstBestRows(rows, scoreFn, count = 5) {
  const [mode, setMode] = useState("worst"); // "worst" | "best"

  const rowList = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  const displayRows = useMemo(() => {
    // 각 Row에 점수 부여
    const scored = rowList.map((row) => ({
      row,
      score: scoreFn(row),
    }));

    // 정렬: worst=내림차순, best=오름차순
    const sorted = [...scored].sort(
      mode === "worst"
        ? (a, b) => b.score - a.score
        : (a, b) => a.score - b.score
    );

    // 상위/하위 N개 선택
    const selected = sorted.slice(0, Math.min(count, sorted.length));

    // 그룹 내 순위 부여 (1=가장 extreme/가장 clean)
    const ranked = selected.map((item, i) => ({
      ...item,
      rank: i + 1,
    }));

    // Row 번호순 정렬 (표시용)
    ranked.sort((a, b) => (a.row?.Row ?? 0) - (b.row?.Row ?? 0));

    return ranked;
  }, [rowList, scoreFn, mode, count]);

  return { mode, setMode, displayRows };
}
