// ──────────────────────────────────────────────
// [SPEC LOCK] 공용 포맷/변환 유틸
// 단위: mm, 표시: 소수점 2자리
// ──────────────────────────────────────────────

/** 숫자를 소수점 2자리 문자열로. null/NaN이면 "-" */
export function fmt2(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  const x = Math.round(Number(v) * 100) / 100;
  return (Object.is(x, -0) ? 0 : x).toFixed(2);
}

/** 어떤 타입이든 안전하게 React child 렌더용 문자열로 변환 */
export function asText(x) {
  if (x === null || x === undefined) return "-";
  const t = typeof x;
  if (t === "string" || t === "number" || t === "boolean") return String(x);
  if (Array.isArray(x)) return x.map(asText).join(", ");
  if (t === "object") {
    if ("summary" in x) return asText(x.summary);
    if ("text" in x) return asText(x.text);
    if ("name" in x) return asText(x.name);
    if ("type" in x) return asText(x.type);
    if ("axis" in x && "value" in x) return `${asText(x.axis)}:${asText(x.value)}`;
    if ("value" in x) return asText(x.value);
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }
  return String(x);
}

/** 숫자처럼 써야 하는 값이 객체로 올 때 대비 */
export function asNumber(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof x === "object" && x !== null) {
    if ("value" in x) return asNumber(x.value);
  }
  return null;
}
