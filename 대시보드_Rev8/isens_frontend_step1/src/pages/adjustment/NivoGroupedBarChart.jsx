import React, { useMemo, useState, useRef, useCallback } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import {
  CI_PRIMARY, CI_GREEN, COLOR_NG, COLOR_CHECK, BORDER_LIGHT,
} from "../../components/shared/colors";
import useThresholdStore from "../../store/useThresholdStore";

/**
 * NivoGroupedBarChart v7 — 순수 SVG 멀티패널 가로 막대
 *
 * X축(좌우) → 좌(L) · 우(R)   2패널
 * Y축(상하) → 좌(L) · 중(C) · 우(R)  3패널
 *
 * 0 중심 ±대칭 스케일 (최소 ±0.20)
 * Before: 넓은 반투명 막대
 * After:  좁은 상태색 막대 (오버레이)
 * ±CHECK/NG 수직 기준선
 */

/* ── 상수 ─────────────────────────────────── */
const BEFORE_FILL = "#b8c5e0";
const BEFORE_OPACITY = 0.42;
const AFTER_NARROW = 0.46;   // After 바 높이 비율
const BAR_RADIUS = 2;
const SCALE_FIXED = 0.20;    // 최소 ±0.20

/* ── 패널 구성 ────────────────────────────── */
const PANEL_CFG = {
  x: [
    { key: "L", label: "좌 (L)", bf: "signed_before_xL", af: "signed_after_xL" },
    { key: "R", label: "우 (R)", bf: "signed_before_xR", af: "signed_after_xR" },
  ],
  y: [
    { key: "L", label: "좌 (L)", bf: "signed_before_yL", af: "signed_after_yL" },
    { key: "C", label: "중 (C)", bf: "signed_before_yC", af: "signed_after_yC" },
    { key: "R", label: "우 (R)", bf: "signed_before_yR", af: "signed_after_yR" },
  ],
};

/* ── 유틸 ─────────────────────────────────── */
function getAfterColor(val, ngLimit, check) {
  const abs = Math.abs(val);
  if (abs >= ngLimit) return COLOR_NG;
  if (abs >= check) return COLOR_CHECK;
  return CI_PRIMARY;
}

function fmtSigned(v) {
  return (v >= 0 ? "+" : "") + v.toFixed(3);
}

function fmtAxis(v) {
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

/* ── MiniBarPanel (순수 SVG) ──────────────── */
function MiniBarPanel({
  panelLabel, data, showBefore, showAfter,
  scaleMax, CHECK, NG_LIMIT,
  showAxisLeft, height, chartAxis,
}) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [containerW, setContainerW] = useState(0);

  /* ResizeObserver로 너비 측정 */
  const measRef = useCallback((node) => {
    containerRef.current = node;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  /* 레이아웃 계산 */
  const ml = showAxisLeft ? 30 : 6;   // 왼쪽 마진 (Y축 라벨)
  const mr = 6;
  const mt = 14;   // 상단 (기준선 라벨 공간)
  const mb = 20;   // 하단 (X축 라벨)
  const chartW = Math.max(0, containerW - ml - mr);
  const chartH = height - mt - mb;
  const rowCount = data.length;
  const bandH = rowCount > 0 ? chartH / rowCount : 0;
  const barPad = 0.2;
  const barH = bandH * (1 - barPad);

  /* value → x 좌표 (0 중심, ±scaleMax) */
  const vToX = (v) => ((v + scaleMax) / (2 * scaleMax)) * chartW;
  const x0 = vToX(0);

  /* X축 눈금 */
  const ticks = [-scaleMax, -scaleMax / 2, 0, scaleMax / 2, scaleMax];

  /* 기준선 정의 */
  const refLines = [
    { v: 0, color: "rgba(0,0,0,0.18)", w: 1.2, dash: "", label: "" },
    { v: CHECK, color: COLOR_CHECK, w: 0.8, dash: "4 2.5", label: "CHECK" },
    { v: -CHECK, color: COLOR_CHECK, w: 0.8, dash: "4 2.5", label: "" },
    { v: NG_LIMIT, color: COLOR_NG, w: 1, dash: "", label: "NG" },
    { v: -NG_LIMIT, color: COLOR_NG, w: 1, dash: "", label: "" },
  ];

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {/* 패널 헤더 */}
      <Typography
        sx={{
          fontSize: 11, fontWeight: 800, textAlign: "center",
          color: "text.secondary", letterSpacing: 0.3, mb: 0.2,
        }}
      >
        {panelLabel}
      </Typography>

      <Box ref={measRef} sx={{ height, position: "relative" }}>
        {containerW > 0 && (
          <svg width={containerW} height={height} style={{ display: "block" }}>
            <g transform={`translate(${ml},${mt})`}>
              {/* 그리드선 + X축 눈금 */}
              {ticks.map((t, i) => {
                const x = vToX(t);
                return (
                  <g key={`t${i}`}>
                    <line x1={x} x2={x} y1={0} y2={chartH}
                      stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
                    <text x={x} y={chartH + 14} textAnchor="middle"
                      style={{ fontSize: 9, fill: "#888", fontWeight: 500 }}>
                      {fmtAxis(t)}
                    </text>
                  </g>
                );
              })}

              {/* 기준선 (CHECK/NG) */}
              {refLines.map((rl, i) => {
                const x = vToX(rl.v);
                return (
                  <g key={`rl${i}`}>
                    <line x1={x} x2={x} y1={0} y2={chartH}
                      stroke={rl.color} strokeWidth={rl.w}
                      strokeDasharray={rl.dash || undefined}
                      opacity={rl.v === 0 ? 1 : 0.4} />
                    {rl.label && (
                      <text x={x} y={-4} textAnchor="middle"
                        style={{ fontSize: 7, fill: rl.color, fontWeight: 700, opacity: 0.6 }}>
                        {rl.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 행별 막대 */}
              {data.map((d, ri) => {
                const cy = ri * bandH + bandH / 2;
                const by = cy - barH / 2;

                /* Before 막대 */
                const bVal = d.before;
                const bx1 = Math.min(x0, vToX(bVal));
                const bw = Math.abs(vToX(bVal) - x0);

                /* After 막대 */
                const aVal = d.after;
                const ah = barH * AFTER_NARROW;
                const ay = cy - ah / 2;
                const ax1 = Math.min(x0, vToX(aVal));
                const aw = Math.abs(vToX(aVal) - x0);

                return (
                  <g key={d.row}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (rect) {
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top - 10,
                          row: d.row, before: bVal, after: aVal,
                        });
                      }
                    }}
                    onMouseMove={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (rect) {
                        setTooltip((prev) => prev ? {
                          ...prev,
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top - 10,
                        } : null);
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* 호버 영역 */}
                    <rect x={0} y={by} width={chartW} height={barH}
                      fill="transparent" />

                    {/* Before 바 */}
                    {showBefore && bw > 0.5 && (
                      <rect x={bx1} y={by} width={bw} height={barH}
                        rx={BAR_RADIUS} fill={BEFORE_FILL} opacity={BEFORE_OPACITY} />
                    )}

                    {/* After 바 */}
                    {showAfter && aw > 0.5 && (
                      <rect x={ax1} y={ay} width={aw} height={ah}
                        rx={BAR_RADIUS}
                        fill={getAfterColor(aVal, NG_LIMIT, CHECK)} />
                    )}

                    {/* Y축 라벨 (첫 패널만) */}
                    {showAxisLeft && (
                      <text x={-6} y={cy} textAnchor="end" dominantBaseline="central"
                        style={{ fontSize: 9, fontWeight: 600, fill: "#666" }}>
                        {d.row}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* 툴팁 */}
        {tooltip && (
          <Box
            sx={{
              position: "absolute",
              left: tooltip.x + 8,
              top: tooltip.y - 36,
              pointerEvents: "none",
              zIndex: 10,
              background: "#fff",
              border: `1px solid ${BORDER_LIGHT}`,
              borderRadius: 2,
              px: 1.2, py: 0.8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              fontSize: 11, lineHeight: 1.5, whiteSpace: "nowrap",
            }}
          >
            <strong>{tooltip.row}</strong>
            <span style={{ color: "#aaa", marginLeft: 4, fontSize: 10 }}>{panelLabel}</span>
            <div style={{ color: "#999" }}>Before: {fmtSigned(tooltip.before)} mm</div>
            <div style={{
              color: getAfterColor(tooltip.after, NG_LIMIT, CHECK),
              fontWeight: 700,
            }}>
              After: {fmtSigned(tooltip.after)} mm
              <span style={{
                fontSize: 9, marginLeft: 3,
                color: Math.abs(tooltip.after) >= NG_LIMIT ? COLOR_NG
                  : Math.abs(tooltip.after) >= CHECK ? COLOR_CHECK : CI_GREEN,
              }}>
                ({Math.abs(tooltip.after) >= NG_LIMIT ? "NG"
                  : Math.abs(tooltip.after) >= CHECK ? "CHECK" : "OK"})
              </span>
            </div>
            <div style={{ fontSize: 10, color: "#666", fontWeight: 600 }}>
              {(() => {
                const abs = Math.abs(tooltip.after);
                if (abs < CHECK) return "정상";
                return chartAxis === "x"
                  ? (tooltip.after > 0 ? "우측쏠림" : "좌측쏠림")
                  : (tooltip.after > 0 ? "상측쏠림" : "하측쏠림");
              })()}
            </div>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ── 메인 오케스트레이터 ─────────────────── */
export default function NivoGroupedBarChart({ perRow, axis = "y" }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK = storeT.check;
  const NG_LIMIT = storeT.ng;

  const isX = axis === "x";
  const title = isX ? "X (좌우)" : "Y (상하)";
  const panels = PANEL_CFG[axis] || PANEL_CFG.y;

  const [showBefore, setShowBefore] = useState(true);
  const [showAfter, setShowAfter] = useState(true);

  /* 패널별 데이터 */
  const panelDataSets = useMemo(() => {
    if (!perRow || perRow.length === 0) return [];
    return panels.map(({ key, label, bf, af }) => ({
      key,
      label,
      data: perRow.map((r) => ({
        row: `R${r.row}`,
        before: r[bf] ?? 0,
        after: r[af] ?? 0,
      })),
    }));
  }, [perRow, panels]);

  /* 통합 스케일 — 0 중심 대칭, 최소 ±0.20 */
  const scaleMax = useMemo(() => {
    let absMax = 0;
    for (const panel of panelDataSets) {
      for (const d of panel.data) {
        absMax = Math.max(absMax, Math.abs(d.before), Math.abs(d.after));
      }
    }
    const bound = Math.max(absMax * 1.15, SCALE_FIXED);
    return Math.ceil(bound * 50) / 50; // 0.02 단위 반올림
  }, [panelDataSets]);

  if (panelDataSets.length === 0) return null;

  /* 칩 스타일 */
  const chipSx = (active, color) => ({
    height: 18, fontSize: 9, fontWeight: 700, cursor: "pointer",
    bgcolor: active ? color : "transparent",
    color: active ? "#fff" : "#bbb",
    border: active ? "none" : "1px solid #ddd",
    textDecoration: active ? "none" : "line-through",
    opacity: active ? 1 : 0.5,
    "& .MuiChip-label": { px: 0.5 },
  });

  return (
    <Box>
      {/* 제목 + 토글 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: 0.5, mb: 0.3 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#444", letterSpacing: 0.3 }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={0.3}>
          <Chip label="Before" size="small" onClick={() => setShowBefore((v) => !v)}
            sx={chipSx(showBefore, "rgba(120,130,160,0.55)")} />
          <Chip label="After" size="small" onClick={() => setShowAfter((v) => !v)}
            sx={chipSx(showAfter, CI_PRIMARY)} />
        </Stack>
      </Stack>

      {/* 패널 나란히 */}
      <Stack direction="row" spacing={0.5}>
        {panelDataSets.map((panel, idx) => (
          <MiniBarPanel
            key={panel.key}
            panelLabel={panel.label}
            data={panel.data}
            showBefore={showBefore}
            showAfter={showAfter}
            scaleMax={scaleMax}
            CHECK={CHECK}
            NG_LIMIT={NG_LIMIT}
            showAxisLeft={idx === 0}
            height={280}
            chartAxis={axis}
          />
        ))}
      </Stack>

      {/* 하단 범례 */}
      <Stack direction="row" spacing={1.5} justifyContent="center"
        sx={{ mt: 0.5, mb: 0.3 }}>
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{
            width: 14, height: 8, borderRadius: 0.5,
            bgcolor: BEFORE_FILL, opacity: BEFORE_OPACITY,
          }} />
          <Typography sx={{ fontSize: 9, color: "text.secondary" }}>Before</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: CI_PRIMARY }} />
          <Typography sx={{ fontSize: 9, color: "text.secondary" }}>After (OK)</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{ width: 10, height: 0, borderTop: `2px dashed ${COLOR_CHECK}` }} />
          <Typography sx={{ fontSize: 9, color: COLOR_CHECK }}>CHECK</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{ width: 10, height: 0, borderTop: `2px solid ${COLOR_NG}` }} />
          <Typography sx={{ fontSize: 9, color: COLOR_NG }}>NG</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
