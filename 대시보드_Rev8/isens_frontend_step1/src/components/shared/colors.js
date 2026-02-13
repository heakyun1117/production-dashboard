// ──────────────────────────────────────────────
// [i-SENS CI] 중앙 색상 상수
// 모든 컴포넌트가 이 파일의 값을 참조합니다.
// ──────────────────────────────────────────────

// ── 브랜드 색상 ──
export const CI_PRIMARY   = "#171C8F";   // i-SENS Blue
export const CI_GREEN     = "#78BE20";   // i-SENS Green
export const CI_GRAY      = "#53565A";   // i-SENS Gray

// ── 상태 색상 ──
export const COLOR_NG     = "#DC2626";   // Red
export const COLOR_CHECK  = "#E8860C";   // Orange/Amber
export const COLOR_OK     = CI_GREEN;    // Green

// ── 상태 배경 + 텍스트 ──
export const STATUS_STYLES = {
  OK:    { bg: "#F2F9E9", text: "#3D7A0A" },
  CHECK: { bg: "#FEF3C7", text: "#92400E" },
  NG:    { bg: "#FEE2E2", text: "#991B1B" },
};

// ── 기준선 (CHECK/NG dashed line) ──
export const REF_LINE = {
  CHECK: "rgba(232,134,12,0.30)",
  NG:    "rgba(220,38,38,0.25)",
};

// ── 공통 투명도 패턴 ──
export const TRACK_BG        = "rgba(0,0,0,0.04)";    // 바 트랙 배경
export const CENTER_LINE     = "rgba(0,0,0,0.12)";    // 중심선
export const BORDER_LIGHT    = "rgba(0,0,0,0.06)";    // 연한 테두리
export const HIGHLIGHT_BG    = "rgba(23,28,143,0.10)"; // Row 하이라이트

// ── 바 불투명도 ──
export const BAR_OPACITY = 0.85;

// ── 카드/컨테이너 ──
export const CARD_RADIUS = 3;           // borderRadius
export const CHIP_RADIUS = 999;         // pill shape
