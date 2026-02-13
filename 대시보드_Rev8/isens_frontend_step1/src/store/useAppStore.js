import { create } from "zustand";

const useAppStore = create((set, get) => ({
  // ── 상태 ──
  jobId: null,
  sheets: [],                // 업로드 응답의 시트 요약 배열
  sortedSheetKeys: [],       // Explorer 정렬 순서 (sheetKey 배열)
  selectedSheetKey: null,
  selectedDetail: null,      // getSheetDetail 응답 전체
  busy: false,
  message: "대기 중",
  highlightedRowId: null,    // Phase 1.5: 양방향 Row 하이라이트 (MiniStrip ↔ ProblemRows)

  // Explorer 필터 상태 유지 (Detail 갔다가 돌아와도 유지)
  explorerFilters: {
    statusFilter: { OK: true, CHECK: true, NG: true },
    searchText: "",
    sortBy: "score_asc",
  },

  // ── 액션 ──
  setJob: (jobId, sheets) =>
    set({
      jobId,
      sheets: sheets ?? [],
      sortedSheetKeys: (sheets ?? []).map((s) => s.sheetKey),
      selectedSheetKey: null,
      selectedDetail: null,
      // 새 Job 업로드 시 필터 초기화
      explorerFilters: {
        statusFilter: { OK: true, CHECK: true, NG: true },
        searchText: "",
        sortBy: "score_asc",
      },
    }),

  setSheets: (sheets) =>
    set({
      sheets: sheets ?? [],
      sortedSheetKeys: (sheets ?? []).map((s) => s.sheetKey),
    }),

  setSortedKeys: (keys) => set({ sortedSheetKeys: keys }),

  setSelectedSheet: (sheetKey) => set({ selectedSheetKey: sheetKey }),

  setSelectedDetail: (detail) => set({ selectedDetail: detail }),

  setBusy: (busy) => set({ busy }),

  setMessage: (msg) => set({ message: msg }),

  // Explorer 필터 업데이트
  setExplorerFilters: (patch) =>
    set((state) => ({
      explorerFilters: { ...state.explorerFilters, ...patch },
    })),

  // Phase 1.5: Row 하이라이트 (MiniStrip ↔ ProblemRows 양방향 연동)
  setHighlightedRowId: (id) => set({ highlightedRowId: id }),
  clearHighlightedRow: () => set({ highlightedRowId: null }),

  // ── 파생 ──
  getSheetByKey: (key) => get().sheets.find((s) => s.sheetKey === key) ?? null,

  getAdjacentKeys: (currentKey) => {
    const keys = get().sortedSheetKeys;
    const idx = keys.indexOf(currentKey);
    if (idx < 0) return { prev: null, next: null, idx: -1, total: keys.length };
    return {
      prev: idx > 0 ? keys[idx - 1] : null,
      next: idx < keys.length - 1 ? keys[idx + 1] : null,
      idx,
      total: keys.length,
    };
  },
}));

export default useAppStore;
