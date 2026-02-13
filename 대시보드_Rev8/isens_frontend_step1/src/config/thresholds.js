/**
 * thresholds.js — 기준값 중앙 관리
 *
 * 모든 CHECK / NG / SCALE 상수를 한 곳에서 관리합니다.
 * useThresholdStore 를 통해 UI에서 런타임 변경 가능.
 */
export const DEFAULT_THRESHOLDS = {
  /** 조립 치우침 기준 (Detail / Compare / Adjustment 등) */
  assembly: {
    ng: 0.15,
    check: 0.10,
    scale: 0.20,
  },

  /** 공정마진 — 프린팅/슬리터 */
  marginPrinting: {
    ng: 0.15,
    check: 0.12,
  },

  /** 공정마진 — 원단/전체폭 */
  marginFabric: {
    ng: 0.07,
    check: 0.05,
    scale: 0.10,
  },

  /** 레이더 차트 */
  radar: {
    maxValue: 0.12,
    target: 0.10,
  },
};
