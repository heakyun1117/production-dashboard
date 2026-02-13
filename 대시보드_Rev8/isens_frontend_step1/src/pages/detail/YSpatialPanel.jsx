import React, { useCallback, useEffect, useRef, useMemo } from "react";
import {
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import { asNumber } from "../../components/shared/fmt";
import BullseyeCell from "../../components/shared/BullseyeCell";
import useAppStore from "../../store/useAppStore";
import useThresholdStore from "../../store/useThresholdStore";
import { COLOR_NG, COLOR_CHECK, CI_PRIMARY, CI_GRAY, CI_GREEN, STATUS_STYLES, HIGHLIGHT_BG } from "../../components/shared/colors";

const HIGHLIGHT_RING = "rgba(23,28,143,0.35)";

// 마커 색상 (범례용)
const COLOR_NORMAL = CI_PRIMARY;
const COLOR_GRAY = CI_GRAY;
const COLOR_GREEN = CI_GREEN;

const COUNT = 5;

// X·Y 통합 scoreFn
const xyScoreFn = (row) => {
  const aYL = Math.abs(asNumber(row?.["상하치우침L"]) ?? 0);
  const aYC = Math.abs(asNumber(row?.["상하치우침C"]) ?? 0);
  const aYR = Math.abs(asNumber(row?.["상하치우침R"]) ?? 0);
  const aXL = Math.abs(asNumber(row?.["조립치우침L"]) ?? 0);
  const aXR = Math.abs(asNumber(row?.["조립치우침R"]) ?? 0);
  return Math.max(aYL, aYC, aYR, aXL, aXR);
};

/**
 * YSpatialPanel — 3-Zone BullseyeCell + Worst5 | Best5 좌우 분할
 * Phase 1.6d+: 좌측 Worst 5 / 우측 Best 5 동시 표시
 */
export default function YSpatialPanel({ rows }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK = storeT.check;
  const NG = storeT.ng;

  const highlightedRowId = useAppStore((s) => s.highlightedRowId);
  const setHighlightedRowId = useAppStore((s) => s.setHighlightedRowId);

  const rowRefsMap = useRef(new Map());

  const onRowClick = useCallback(
    (rowId) => setHighlightedRowId(rowId),
    [setHighlightedRowId]
  );

  useEffect(() => {
    if (highlightedRowId == null) return;
    const el = rowRefsMap.current.get(highlightedRowId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightedRowId]);

  const setRowRef = useCallback((rowId, el) => {
    if (el) rowRefsMap.current.set(rowId, el);
    else rowRefsMap.current.delete(rowId);
  }, []);

  const rowList = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  // Worst 5 + Best 5 동시 계산
  const { worstRows, bestRows } = useMemo(() => {
    const scored = rowList.map((row) => ({
      row,
      score: xyScoreFn(row),
    }));

    // 내림차순 정렬 → Worst 5
    const descSorted = [...scored].sort((a, b) => b.score - a.score);
    const worst = descSorted.slice(0, Math.min(COUNT, descSorted.length));
    const worstRanked = worst.map((item, i) => ({ ...item, rank: i + 1 }));
    worstRanked.sort((a, b) => (a.row?.Row ?? 0) - (b.row?.Row ?? 0));

    // 오름차순 정렬 → Best 5
    const ascSorted = [...scored].sort((a, b) => a.score - b.score);
    const best = ascSorted.slice(0, Math.min(COUNT, ascSorted.length));
    const bestRanked = best.map((item, i) => ({ ...item, rank: i + 1 }));
    bestRanked.sort((a, b) => (a.row?.Row ?? 0) - (b.row?.Row ?? 0));

    return { worstRows: worstRanked, bestRows: bestRanked };
  }, [rowList]);

  const getRowStatus = (row) => {
    const worst = xyScoreFn(row);
    if (worst >= NG) return "NG";
    if (worst >= CHECK) return "CHECK";
    return "OK";
  };

  const statusColor = { NG: COLOR_NG, CHECK: COLOR_CHECK, OK: "text.secondary" };

  if (rowList.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Row 데이터가 없습니다.
      </Typography>
    );
  }

  const renderRow = (item, prefix) => {
    const row = item.row;
    const rowId = row?.Row ?? 0;
    const isHL = highlightedRowId === rowId;
    const xyStatus = getRowStatus(row);

    return (
      <Stack
        key={`${prefix}-${rowId}`}
        ref={(el) => setRowRef(rowId, el)}
        direction="row"
        alignItems="center"
        spacing={0.5}
        onClick={() => onRowClick(rowId)}
        sx={{
          cursor: "pointer",
          py: 0.5,
          px: 0.5,
          borderRadius: 1.5,
          background: isHL ? HIGHLIGHT_BG : "transparent",
          outline: isHL ? `2px solid ${HIGHLIGHT_RING}` : "none",
          outlineOffset: -1,
          transition: "all 0.2s ease",
          "&:hover": { background: isHL ? HIGHLIGHT_BG : "rgba(0,0,0,0.02)" },
        }}
      >
        {/* Row 라벨 + 순위 */}
        <Stack spacing={0} alignItems="center" sx={{ width: 40, flexShrink: 0 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, fontSize: 12, color: statusColor[xyStatus], lineHeight: 1.2 }}
          >
            R{rowId}
          </Typography>
          <Chip
            size="small"
            label={`${prefix}#${item.rank}`}
            sx={{
              height: 14,
              fontSize: 7,
              fontWeight: 700,
              background: xyStatus === "NG" ? STATUS_STYLES.NG.bg : xyStatus === "CHECK" ? STATUS_STYLES.CHECK.bg : "rgba(0,0,0,0.04)",
              color: xyStatus === "NG" ? STATUS_STYLES.NG.text : xyStatus === "CHECK" ? STATUS_STYLES.CHECK.text : "text.secondary",
              "& .MuiChip-label": { px: 0.5 },
            }}
          />
        </Stack>

        {/* BullseyeCell — 전폭 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <BullseyeCell
            yL={row?.["상하치우침L"]}
            yC={row?.["상하치우침C"]}
            yR={row?.["상하치우침R"]}
            xL={row?.["조립치우침L"]}
            xR={row?.["조립치우침R"]}
            height={100}
          />
        </Box>
      </Stack>
    );
  };

  return (
    <Stack spacing={0.5}>
      {/* 범례 */}
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        sx={{ pb: 0.5, mb: 0.5, borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, flexWrap: "wrap" }}>
          <Stack direction="row" spacing={0.3} alignItems="center">
            <Typography variant="caption" sx={{ fontSize: 12, color: COLOR_NORMAL, fontWeight: 700 }}>▲</Typography>
            <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>L (좌)</Typography>
          </Stack>
          <Stack direction="row" spacing={0.3} alignItems="center">
            <Typography variant="caption" sx={{ fontSize: 12, color: COLOR_GRAY, fontWeight: 700 }}>●</Typography>
            <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>C (중앙)</Typography>
          </Stack>
          <Stack direction="row" spacing={0.3} alignItems="center">
            <Typography variant="caption" sx={{ fontSize: 12, color: COLOR_GREEN, fontWeight: 700 }}>◆</Typography>
            <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>R (우)</Typography>
          </Stack>
          <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary", ml: 1 }}>
            가로 = X편차(조립치우침) · 세로 = Y편차(상하치우침) · 마커에 마우스를 올리면 상세 정보
          </Typography>
        </Stack>
      </Stack>

      {/* Worst 5 (좌) | Best 5 (우) — 좌우 분할 */}
      <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
        {/* 좌측: Worst 5 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, fontSize: 11, color: COLOR_NG, px: 0.5, mb: 0.5, display: "block" }}
          >
            Worst {COUNT}
          </Typography>
          <Stack spacing={0.5}>
            {worstRows.map((item) => renderRow(item, "W"))}
          </Stack>
        </Box>

        {/* 세로 구분선 */}
        <Box
          sx={{
            width: "1px",
            background: "rgba(0,0,0,0.08)",
            flexShrink: 0,
            my: 1,
          }}
        />

        {/* 우측: Best 5 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, fontSize: 11, color: COLOR_GREEN, px: 0.5, mb: 0.5, display: "block" }}
          >
            Best {COUNT}
          </Typography>
          <Stack spacing={0.5}>
            {bestRows.map((item) => renderRow(item, "B"))}
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
}
