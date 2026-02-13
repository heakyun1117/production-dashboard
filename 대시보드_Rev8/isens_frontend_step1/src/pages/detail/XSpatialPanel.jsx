import React, { useCallback, useEffect, useRef } from "react";
import {
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { asNumber } from "../../components/shared/fmt";
import DeviationDot from "../../components/shared/DeviationDot";
import useAppStore from "../../store/useAppStore";
import useThresholdStore from "../../store/useThresholdStore";
import useWorstBestRows from "../../hooks/useWorstBestRows";

const HIGHLIGHT_BG = "rgba(23,28,143,0.10)";
const HIGHLIGHT_RING = "rgba(23,28,143,0.35)";

// X축 scoreFn: max(|조립치우침L|, |조립치우침R|)
const xScoreFn = (row) => {
  const aL = Math.abs(asNumber(row?.["조립치우침L"]) ?? 0);
  const aR = Math.abs(asNumber(row?.["조립치우침R"]) ?? 0);
  return Math.max(aL, aR);
};

/**
 * XSpatialPanel — Worst5/Best5 × L/R 1D 편차 트랙 (fluid 모드)
 * Phase 1.6b: 전체 폭 활용 + 5개 Row 토글
 */
export default function XSpatialPanel({ rows }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK = storeT.check;
  const NG = storeT.ng;

  const highlightedRowId = useAppStore((s) => s.highlightedRowId);
  const setHighlightedRowId = useAppStore((s) => s.setHighlightedRowId);

  const { mode, setMode, displayRows } = useWorstBestRows(rows, xScoreFn, 5);

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

  const getRowXStatus = (row) => {
    const worst = xScoreFn(row);
    if (worst >= NG) return "NG";
    if (worst >= CHECK) return "CHECK";
    return "OK";
  };

  const statusColor = { NG: "#DC2626", CHECK: "#E8860C", OK: "text.secondary" };

  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Row 데이터가 없습니다.
      </Typography>
    );
  }

  return (
    <Stack spacing={0}>
      {/* 헤더 + 토글 */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{ pb: 0.5, mb: 0.5, borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        <Typography
          variant="caption"
          sx={{ width: 72, fontWeight: 800, fontSize: 11, color: "text.secondary" }}
        >
          Row
        </Typography>
        <Typography
          variant="caption"
          sx={{ flex: 1, fontWeight: 700, fontSize: 11, color: "text.secondary", textAlign: "center" }}
        >
          L (좌측)
        </Typography>
        <Typography
          variant="caption"
          sx={{ flex: 1, fontWeight: 700, fontSize: 11, color: "text.secondary", textAlign: "center" }}
        >
          R (우측)
        </Typography>

        {/* Worst/Best 토글 */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => { if (v) setMode(v); }}
          size="small"
          sx={{ ml: 1, flexShrink: 0 }}
        >
          <ToggleButton value="worst" sx={{ fontSize: 10, fontWeight: 700, px: 1, py: 0.25, textTransform: "none", height: 24 }}>
            Worst 5
          </ToggleButton>
          <ToggleButton value="best" sx={{ fontSize: 10, fontWeight: 700, px: 1, py: 0.25, textTransform: "none", height: 24 }}>
            Best 5
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* 5 Rows */}
      {displayRows.map((item) => {
        const row = item.row;
        const rowId = row?.Row ?? 0;
        const isHL = highlightedRowId === rowId;
        const xStatus = getRowXStatus(row);
        const prefix = mode === "worst" ? "W" : "B";

        return (
          <Stack
            key={`xsp-${rowId}`}
            ref={(el) => setRowRef(rowId, el)}
            direction="row"
            alignItems="center"
            onClick={() => onRowClick(rowId)}
            sx={{
              cursor: "pointer",
              py: 0.5,
              px: 0.5,
              borderRadius: 1,
              background: isHL ? HIGHLIGHT_BG : "transparent",
              outline: isHL ? `2px solid ${HIGHLIGHT_RING}` : "none",
              outlineOffset: -1,
              transition: "all 0.2s ease",
              "&:hover": { background: isHL ? HIGHLIGHT_BG : "rgba(0,0,0,0.02)" },
            }}
          >
            {/* Row 라벨 + 순위 */}
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: 72, flexShrink: 0 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, fontSize: 12, color: statusColor[xStatus] }}
              >
                R{rowId}
              </Typography>
              <Chip
                size="small"
                label={`${prefix}#${item.rank}`}
                sx={{
                  height: 16,
                  fontSize: 8,
                  fontWeight: 700,
                  background: xStatus === "NG" ? "#FEE2E2" : xStatus === "CHECK" ? "#FEF3C7" : "rgba(0,0,0,0.04)",
                  color: xStatus === "NG" ? "#991B1B" : xStatus === "CHECK" ? "#92400E" : "text.secondary",
                }}
              />
            </Stack>

            {/* L 트랙 (fluid) */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <DeviationDot
                value={row?.["조립치우침L"]}
                axis="X"
                fluid
                showText
                compact
              />
            </Box>

            {/* R 트랙 (fluid) */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <DeviationDot
                value={row?.["조립치우침R"]}
                axis="X"
                fluid
                showText
                compact
              />
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
