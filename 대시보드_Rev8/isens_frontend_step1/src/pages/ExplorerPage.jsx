import React, { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import useAppStore from "../store/useAppStore";
import SheetList from "../components/SheetList.jsx";
import CompareBasketBar from "./explorer/CompareBasketBar.jsx";
import { STATUS_STYLES, COLOR_NG, COLOR_CHECK, CI_GREEN } from "../components/shared/colors";

// CI 색상 필터 칩
const STATUS_CHIP_STYLES = {
  NG:    { on: { background: STATUS_STYLES.NG.bg,    color: STATUS_STYLES.NG.text },    off: { borderColor: COLOR_NG,    color: STATUS_STYLES.NG.text } },
  CHECK: { on: { background: STATUS_STYLES.CHECK.bg, color: STATUS_STYLES.CHECK.text }, off: { borderColor: COLOR_CHECK, color: STATUS_STYLES.CHECK.text } },
  OK:    { on: { background: STATUS_STYLES.OK.bg,    color: STATUS_STYLES.OK.text },    off: { borderColor: CI_GREEN,    color: STATUS_STYLES.OK.text } },
};

// 정렬 옵션
const SORT_OPTIONS = [
  { value: "score_asc", label: "Score (위험순)" },
  { value: "score_desc", label: "Score (안전순)" },
  { value: "worstX", label: "WorstX (큰 순)" },
  { value: "worstY", label: "WorstY (큰 순)" },
  { value: "sheet", label: "시트넘버 순" },
];

export default function ExplorerPage() {
  const navigate = useNavigate();

  const sheets = useAppStore((s) => s.sheets);
  const jobId = useAppStore((s) => s.jobId);
  const setSortedKeys = useAppStore((s) => s.setSortedKeys);
  const explorerFilters = useAppStore((s) => s.explorerFilters);
  const setExplorerFilters = useAppStore((s) => s.setExplorerFilters);

  // Zustand에서 필터 상태 읽기 (Detail 갔다 돌아와도 유지)
  const statusFilter = explorerFilters.statusFilter;
  const searchText = explorerFilters.searchText;
  const sortBy = explorerFilters.sortBy;

  const setStatusFilter = (fn) => {
    const next = typeof fn === "function" ? fn(statusFilter) : fn;
    setExplorerFilters({ statusFilter: next });
  };
  const setSearchText = (v) => setExplorerFilters({ searchText: v });
  const setSortBy = (v) => setExplorerFilters({ sortBy: v });

  // 전체 시트 기준 Score 내림차순 Rank 맵 (높은 점수 = #1)
  const rankMap = useMemo(() => {
    const map = {};
    const all = Array.isArray(sheets) ? [...sheets] : [];
    all.sort((a, b) => (Number(b?.qualityScore ?? -1)) - (Number(a?.qualityScore ?? -1)));
    all.forEach((s, idx) => { map[s.sheetKey] = idx + 1; });
    return map;
  }, [sheets]);

  // 필터 + 정렬
  const sortedSheets = useMemo(() => {
    let arr = Array.isArray(sheets) ? [...sheets] : [];

    arr = arr.filter((s) => statusFilter[s?.status] !== false);

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      arr = arr.filter(
        (s) =>
          (s?.sheetKey ?? "").toLowerCase().includes(q) ||
          (s?.meta?.메모 ?? "").toLowerCase().includes(q) ||
          (s?.meta?.라인명 ?? "").toLowerCase().includes(q) ||
          (s?.meta?.로트명 ?? "").toLowerCase().includes(q)
      );
    }

    arr.sort((a, b) => {
      switch (sortBy) {
        case "score_asc": return (Number(a?.qualityScore ?? 999)) - (Number(b?.qualityScore ?? 999));
        case "score_desc": return (Number(b?.qualityScore ?? -1)) - (Number(a?.qualityScore ?? -1));
        case "worstX": return Math.abs(Number(b?.worstX ?? 0)) - Math.abs(Number(a?.worstX ?? 0));
        case "worstY": return Math.abs(Number(b?.worstY ?? 0)) - Math.abs(Number(a?.worstY ?? 0));
        case "sheet": return (Number(a?.meta?.시트넘버 ?? 999999)) - (Number(b?.meta?.시트넘버 ?? 999999));
        default: return 0;
      }
    });

    setSortedKeys(arr.map((s) => s.sheetKey));
    return arr;
  }, [sheets, statusFilter, searchText, sortBy, setSortedKeys]);

  const onSelectSheet = useCallback(
    (sheet) => {
      useAppStore.getState().setSelectedSheet(sheet.sheetKey);
    },
    []
  );

  const onDoubleClickSheet = useCallback(
    (sheet) => {
      useAppStore.getState().setSelectedSheet(sheet.sheetKey);
      navigate(`/detail/${encodeURIComponent(sheet.sheetKey)}`);
    },
    [navigate]
  );

  // 상태별 카운트 (전체 시트 기준)
  const statusCounts = useMemo(() => {
    const counts = { NG: 0, CHECK: 0, OK: 0 };
    for (const s of (sheets ?? [])) {
      if (counts[s?.status] !== undefined) counts[s.status]++;
    }
    return counts;
  }, [sheets]);

  const toggleStatus = (st) => {
    setStatusFilter((prev) => ({ ...prev, [st]: !prev[st] }));
  };

  if (!jobId) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.secondary" }}>
        <Typography variant="h6">CSV 파일을 업로드하세요</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ height: "100%" }}>
      {/* 툴바 */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: "wrap" }}>
        {["NG", "CHECK", "OK"].map((st) => {
          const active = statusFilter[st];
          const style = STATUS_CHIP_STYLES[st];
          return (
            <Chip
              key={st}
              label={`${st} (${statusCounts[st]})`}
              size="small"
              variant={active ? "filled" : "outlined"}
              onClick={() => toggleStatus(st)}
              sx={{
                fontWeight: 700,
                cursor: "pointer",
                ...(active ? style.on : style.off),
              }}
            />
          );
        })}

        <Divider orientation="vertical" flexItem />

        <TextField
          size="small"
          placeholder="시트/라인/로트/메모 검색..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ minWidth: 240 }}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>정렬</InputLabel>
          <Select value={sortBy} label="정렬" onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {sortedSheets.length}개 시트 · 더블 클릭하여 디테일 보기
        </Typography>
      </Stack>

      {/* 시트 그리드 */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SheetList
          sheets={sortedSheets}
          rankMap={rankMap}
          selectedKey={null}
          onSelect={onSelectSheet}
          onDoubleClick={onDoubleClickSheet}
        />
      </Box>

      {/* 비교 바구니 바 */}
      <CompareBasketBar />
    </Stack>
  );
}
