// ──────────────────────────────────────────────
// [Phase 1.5] 진단 데이터 파생 유틸
// ──────────────────────────────────────────────
import { asNumber } from "../components/shared/fmt";
import { DEFAULT_THRESHOLDS } from "../config/thresholds";

// ─── 원인 카테고리 매핑 ─────────────────────
const CAUSE_MAP = {
  C_ASYM: "중앙비대칭",
  X_NG: "X축 NG",
  X_CHECK: "X축 CHECK",
  Y_NG: "Y축 NG",
  Y_CHECK: "Y축 CHECK",
  PUNCH_NG: "타발 NG",
  PUNCH_CHECK: "타발 CHECK",
  TILT: "기울기",
  BOW: "휨",
};

/**
 * generateRecommendation
 * diagnosis + rows에서 조정추천 문장 + 원인태그 + 근거Row 추출
 *
 * @param {Object} diagnosis - detail.diagnosis 객체
 * @param {Array} rows - detail.rows 12-Row 배열
 * @returns {{ causeTags: string[], recommendation: string, evidenceRows: Array }}
 */
export function generateRecommendation(diagnosis, rows, thresholds = DEFAULT_THRESHOLDS.assembly) {
  const { ng: NG, check: CHECK } = thresholds;
  const causeTags = [];
  const parts = [];
  const evidenceRows = [];

  if (!diagnosis) return { causeTags, recommendation: "진단 데이터 없음", evidenceRows };

  // 태그에서 원인 추출
  const tags = diagnosis?.tags ?? [];
  for (const t of tags) {
    const name = typeof t === "string" ? t : t?.name ?? t?.type ?? "";
    if (name && !causeTags.includes(name)) causeTags.push(name);
  }

  // WorstX 분석
  const worstX = diagnosis?.worstX;
  const wxVal = asNumber(worstX?.value ?? worstX) ?? 0;
  const wxAbs = Math.abs(wxVal);
  if (wxAbs >= NG) {
    causeTags.includes("X_NG") || causeTags.push("X_NG");
    parts.push("X 보정 (절연/조립기) 필요 [NG]");
  } else if (wxAbs >= CHECK) {
    causeTags.includes("X_CHECK") || causeTags.push("X_CHECK");
    parts.push("X 보정 (절연/조립기) 주의");
  }

  // WorstY 분석
  const worstY = diagnosis?.worstY;
  const wyVal = asNumber(worstY?.value ?? worstY) ?? 0;
  const wyAbs = Math.abs(wyVal);
  if (wyAbs >= NG) {
    causeTags.includes("Y_NG") || causeTags.push("Y_NG");
    parts.push("Y 보정 (카본 프린팅) 필요 [NG]");
  } else if (wyAbs >= CHECK) {
    causeTags.includes("Y_CHECK") || causeTags.push("Y_CHECK");
    parts.push("Y 보정 (카본 프린팅) 주의");
  }

  // Punch 분석 (rows 기반)
  if (Array.isArray(rows)) {
    let punchWorst = 0;
    for (const r of rows) {
      const pL = Math.abs(asNumber(r?.["타발홀L"]) ?? 0);
      const pR = Math.abs(asNumber(r?.["타발홀R"]) ?? 0);
      punchWorst = Math.max(punchWorst, pL, pR);
    }
    if (punchWorst >= NG) {
      causeTags.includes("PUNCH_NG") || causeTags.push("PUNCH_NG");
      parts.push("타발홀 검사 필요 [NG]");
    } else if (punchWorst >= CHECK) {
      causeTags.includes("PUNCH_CHECK") || causeTags.push("PUNCH_CHECK");
      parts.push("타발홀 주의");
    }
  }

  // C_ASYM
  if (diagnosis?.C_ASYM) {
    causeTags.includes("C_ASYM") || causeTags.push("C_ASYM");
  }

  // 근거 Row 추출 (problemRowsTop5에서 severity 상위 3)
  const problemRows = diagnosis?.problemRowsTop5 ?? [];
  // severity 기반 정렬: NG > CHECK > OK
  const sorted = [...problemRows].sort((a, b) => {
    const sevA = a?.severity === "NG" ? 3 : a?.severity === "CHECK" ? 2 : 1;
    const sevB = b?.severity === "NG" ? 3 : b?.severity === "CHECK" ? 2 : 1;
    if (sevB !== sevA) return sevB - sevA;
    return Math.abs(asNumber(b?.value) ?? 0) - Math.abs(asNumber(a?.value) ?? 0);
  });
  for (const it of sorted.slice(0, 3)) {
    evidenceRows.push({
      rowId: it?.rowId ?? it?.Row,
      axis: it?.axis ?? "?",
      side: it?.side ?? "?",
      value: asNumber(it?.value) ?? 0,
    });
  }

  // 추천 문장 조합
  const recommendation = parts.length > 0
    ? parts.join(" + ")
    : "현재 모든 축 정상 범위";

  return { causeTags, recommendation, evidenceRows };
}

/**
 * computeStripSummary
 * 12-Row 데이터에서 축별 문제 Row 수 / 최대편차 / 최악 Row / 방향 요약
 *
 * @param {Array} rows - 12-Row 배열
 * @returns {{ x: Object, y: Object, punch: Object }}
 */
export function computeStripSummary(rows, thresholds = DEFAULT_THRESHOLDS.assembly) {
  const { check: CHECK } = thresholds;
  const result = {
    x: { problemCount: 0, maxDeviation: 0, maxDirection: "", worstRowId: null },
    y: { problemCount: 0, maxDeviation: 0, maxDirection: "", worstRowId: null },
    punch: { problemCount: 0, maxDeviation: 0, maxDirection: "", worstRowId: null },
  };

  if (!Array.isArray(rows)) return result;

  for (const r of rows) {
    const rowId = r?.Row ?? 0;

    // X축: 조립치우침L, 조립치우침R
    const xL = asNumber(r?.["조립치우침L"]) ?? 0;
    const xR = asNumber(r?.["조립치우침R"]) ?? 0;
    const xMax = Math.abs(xL) >= Math.abs(xR) ? xL : xR;
    const xAbs = Math.abs(xMax);
    if (xAbs >= CHECK) {
      result.x.problemCount++;
      if (xAbs > result.x.maxDeviation) {
        result.x.maxDeviation = xAbs;
        result.x.maxDirection = xMax >= 0 ? "우측쏠림" : "좌측쏠림";
        result.x.worstRowId = rowId;
      }
    }

    // Y축: 상하치우침L, 상하치우침C, 상하치우침R
    const yL = asNumber(r?.["상하치우침L"]) ?? 0;
    const yC = asNumber(r?.["상하치우침C"]) ?? 0;
    const yR = asNumber(r?.["상하치우침R"]) ?? 0;
    let yMax = yL;
    if (Math.abs(yC) > Math.abs(yMax)) yMax = yC;
    if (Math.abs(yR) > Math.abs(yMax)) yMax = yR;
    const yAbs = Math.abs(yMax);
    if (yAbs >= CHECK) {
      result.y.problemCount++;
      if (yAbs > result.y.maxDeviation) {
        result.y.maxDeviation = yAbs;
        result.y.maxDirection = yMax >= 0 ? "상측쏠림" : "하측쏠림";
        result.y.worstRowId = rowId;
      }
    }

    // Punch: 타발홀L, 타발홀R
    const pL = asNumber(r?.["타발홀L"]) ?? 0;
    const pR = asNumber(r?.["타발홀R"]) ?? 0;
    const pMax = Math.abs(pL) >= Math.abs(pR) ? pL : pR;
    const pAbs = Math.abs(pMax);
    if (pAbs >= CHECK) {
      result.punch.problemCount++;
      if (pAbs > result.punch.maxDeviation) {
        result.punch.maxDeviation = pAbs;
        result.punch.worstRowId = rowId;
      }
    }
  }

  return result;
}

/**
 * CAUSE_MAP을 외부에서 참조할 수 있도록 export
 */
export { CAUSE_MAP };
