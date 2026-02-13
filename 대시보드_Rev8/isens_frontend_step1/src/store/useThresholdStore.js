import { create } from "zustand";
import { DEFAULT_THRESHOLDS } from "../config/thresholds";

/**
 * useThresholdStore — 기준값 런타임 관리
 *
 * UI 설정 패널에서 값 변경 시 모든 차트/바/게이지에 즉시 반영.
 */
const useThresholdStore = create((set, get) => ({
  thresholds: structuredClone(DEFAULT_THRESHOLDS),

  /** 카테고리별 부분 업데이트 (예: updateCategory("assembly", { ng: 0.16 })) */
  updateCategory: (category, patch) =>
    set((state) => ({
      thresholds: {
        ...state.thresholds,
        [category]: { ...state.thresholds[category], ...patch },
      },
    })),

  /** 전체 초기화 */
  resetAll: () => set({ thresholds: structuredClone(DEFAULT_THRESHOLDS) }),
}));

export default useThresholdStore;
