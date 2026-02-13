import React, { useMemo, useState, useCallback } from "react";
import { ResponsiveLine } from "@nivo/line";
import { Box, Chip, Stack, Typography } from "@mui/material";
import {
  CI_PRIMARY, CI_GREEN, COLOR_NG, COLOR_CHECK,
  BORDER_LIGHT,
} from "../../components/shared/colors";
import useThresholdStore from "../../store/useThresholdStore";

const POS_COLORS = { L: "#3B82F6", C: "#8B5CF6", R: "#06B6D4" };

/**
 * SignedLineChart v4 — 2-C 범위+강조선 스타일
 *
 * Before: L~R 범위 회색 음영 + L/R 얇은 점선 + C 점선
 * After:  L/R 음영+실선 + C 굵은 강조선
 * CHECK/NG 밴드 배경
 */
export default function SignedLineChart({ perRow, axis = "y", modeLabel }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK = storeT.check;
  const NG = storeT.ng;

  const isX = axis === "x";
  const title = isX ? "X(좌우) 범위+편차" : "Y(상하) 범위+편차";
  const posKeys = isX ? ["L", "R"] : ["L", "C", "R"];
  const hasC = !isX;

  const [showBefore, setShowBefore] = useState(true);
  const [showAfter, setShowAfter] = useState(true);
  const [hiddenPos, setHiddenPos] = useState(new Set());

  const togglePos = useCallback((p) => {
    setHiddenPos((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }, []);

  // Nivo에 빈 더미 데이터 → 축/그리드/슬라이스 렌더용
  const dummyData = useMemo(() => {
    if (!perRow || perRow.length === 0) return [];
    return [{
      id: "dummy",
      data: perRow.map((r) => ({ x: `R${r.row}`, y: 0 })),
    }];
  }, [perRow]);

  // 실제 데이터
  const chartPoints = useMemo(() => {
    if (!perRow || perRow.length === 0) return [];
    return perRow.map((r) => {
      if (isX) {
        return {
          label: `R${r.row}`,
          bL: r.signed_before_xL ?? 0,
          bR: r.signed_before_xR ?? 0,
          bC: 0,
          aL: r.signed_after_xL ?? 0,
          aR: r.signed_after_xR ?? 0,
          aC: 0,
        };
      }
      return {
        label: `R${r.row}`,
        bL: r.signed_before_yL ?? 0,
        bC: r.signed_before_yC ?? 0,
        bR: r.signed_before_yR ?? 0,
        aL: r.signed_after_yL ?? 0,
        aC: r.signed_after_yC ?? 0,
        aR: r.signed_after_yR ?? 0,
      };
    });
  }, [perRow, isX]);

  // ── 기준선 레이어 (밴드 배경 없이 깔끔하게) ──
  const BandLayer = useCallback(({ yScale, innerWidth }) => {
    return (
      <g>
        {/* 0선 */}
        <line x1={0} x2={innerWidth} y1={yScale(0)} y2={yScale(0)}
          stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} />
        {/* ±CHECK 점선 */}
        <line x1={0} x2={innerWidth} y1={yScale(CHECK)} y2={yScale(CHECK)}
          stroke={COLOR_CHECK} strokeWidth={1} strokeDasharray="6 3" opacity={0.45} />
        <line x1={0} x2={innerWidth} y1={yScale(-CHECK)} y2={yScale(-CHECK)}
          stroke={COLOR_CHECK} strokeWidth={1} strokeDasharray="6 3" opacity={0.45} />
        {/* ±NG 실선 */}
        <line x1={0} x2={innerWidth} y1={yScale(NG)} y2={yScale(NG)}
          stroke={COLOR_NG} strokeWidth={1.2} opacity={0.45} />
        <line x1={0} x2={innerWidth} y1={yScale(-NG)} y2={yScale(-NG)}
          stroke={COLOR_NG} strokeWidth={1.2} opacity={0.45} />
        {/* 라벨 */}
        <text x={innerWidth - 4} y={yScale(CHECK) - 3} textAnchor="end"
          fill={COLOR_CHECK} fontSize={8} fontWeight={700} opacity={0.6}>CHECK</text>
        <text x={innerWidth - 4} y={yScale(-CHECK) + 10} textAnchor="end"
          fill={COLOR_CHECK} fontSize={8} fontWeight={700} opacity={0.6}>CHECK</text>
        <text x={innerWidth - 4} y={yScale(NG) - 3} textAnchor="end"
          fill={COLOR_NG} fontSize={8} fontWeight={700} opacity={0.6}>NG</text>
        <text x={innerWidth - 4} y={yScale(-NG) + 10} textAnchor="end"
          fill={COLOR_NG} fontSize={8} fontWeight={700} opacity={0.6}>NG</text>
      </g>
    );
  }, [CHECK, NG]);

  // ── 메인 차트 레이어 ──
  const MainChartLayer = useCallback(({ xScale, yScale }) => {
    if (chartPoints.length === 0) return null;

    const xs = chartPoints.map((p) => xScale(p.label));

    const buildPath = (points) =>
      points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

    const buildArea = (topPts, bottomPts) => {
      const forward = topPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
      const backward = [...bottomPts].reverse().map((p) => `L${p.x},${p.y}`).join(" ");
      return forward + backward + "Z";
    };

    const elements = [];

    // ── Before: L~R 범위 음영 + 점선 ──
    if (showBefore && !hiddenPos.has("L") && !hiddenPos.has("R")) {
      const lPts = chartPoints.map((p, i) => ({ x: xs[i], y: yScale(p.bL) }));
      const rPts = chartPoints.map((p, i) => ({ x: xs[i], y: yScale(p.bR) }));

      elements.push(
        <path key="before-band" d={buildArea(lPts, rPts)}
          fill="#d5d8dc" fillOpacity={0.25} stroke="none" />
      );
      elements.push(
        <path key="before-L" d={buildPath(lPts)}
          fill="none" stroke="#b0b5bc" strokeWidth={0.8}
          strokeDasharray="3 3" opacity={0.7} />
      );
      elements.push(
        <path key="before-R" d={buildPath(rPts)}
          fill="none" stroke="#b0b5bc" strokeWidth={0.8}
          strokeDasharray="3 3" opacity={0.7} />
      );
    }

    // Before C 점선 (Y축만)
    if (showBefore && hasC && !hiddenPos.has("C")) {
      const cPts = chartPoints.map((p, i) => ({ x: xs[i], y: yScale(p.bC) }));
      elements.push(
        <path key="before-C" d={buildPath(cPts)}
          fill="none" stroke="#a098b0" strokeWidth={1.2}
          strokeDasharray="4 3" opacity={0.7} />
      );
    }

    // ── After: L/R 음영+실선 + C 강조선 ──
    if (showAfter) {
      const y0 = yScale(0);

      if (!hiddenPos.has("L")) {
        const pts = chartPoints.map((p, i) => ({ x: xs[i], y: yScale(p.aL) }));
        const basePts = chartPoints.map((_, i) => ({ x: xs[i], y: y0 }));
        elements.push(
          <path key="after-L-area" d={buildArea(pts, basePts)}
            fill={POS_COLORS.L} fillOpacity={0.07} stroke="none" />
        );
        elements.push(
          <path key="after-L-line" d={buildPath(pts)}
            fill="none" stroke={POS_COLORS.L} strokeWidth={1.8}
            style={{ transition: "all 0.4s ease" }} />
        );
        pts.forEach((p, j) => elements.push(
          <circle key={`after-L-dot-${j}`} cx={p.x} cy={p.y} r={2.5}
            fill="#fff" stroke={POS_COLORS.L} strokeWidth={1.5}
            style={{ transition: "all 0.4s ease" }} />
        ));
      }

      if (!hiddenPos.has("R")) {
        const pts = chartPoints.map((p, i) => ({ x: xs[i], y: yScale(p.aR) }));
        const basePts = chartPoints.map((_, i) => ({ x: xs[i], y: y0 }));
        elements.push(
          <path key="after-R-area" d={buildArea(pts, basePts)}
            fill={POS_COLORS.R} fillOpacity={0.07} stroke="none" />
        );
        elements.push(
          <path key="after-R-line" d={buildPath(pts)}
            fill="none" stroke={POS_COLORS.R} strokeWidth={1.8}
            style={{ transition: "all 0.4s ease" }} />
        );
        pts.forEach((p, j) => elements.push(
          <circle key={`after-R-dot-${j}`} cx={p.x} cy={p.y} r={2.5}
            fill="#fff" stroke={POS_COLORS.R} strokeWidth={1.5}
            style={{ transition: "all 0.4s ease" }} />
        ));
      }

      if (hasC && !hiddenPos.has("C")) {
        const pts = chartPoints.map((p, i) => ({ x: xs[i], y: yScale(p.aC) }));
        elements.push(
          <path key="after-C-line" d={buildPath(pts)}
            fill="none" stroke={POS_COLORS.C} strokeWidth={2.5}
            style={{ transition: "all 0.4s ease" }} />
        );
        pts.forEach((p, j) => elements.push(
          <circle key={`after-C-dot-${j}`} cx={p.x} cy={p.y} r={4}
            fill="#fff" stroke={POS_COLORS.C} strokeWidth={2.5}
            style={{ transition: "all 0.4s ease" }} />
        ));
      }
    }

    return <g>{elements}</g>;
  }, [chartPoints, showBefore, showAfter, hiddenPos, hasC]);

  // ── 툴팁 ──
  const tooltipLayer = useCallback(({ slice }) => {
    if (!slice) return null;
    const xLabel = slice.points[0]?.data.xFormatted;
    const idx = chartPoints.findIndex((p) => p.label === xLabel);
    if (idx < 0) return null;
    const pt = chartPoints[idx];

    const fmt = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
    const statusOf = (v) => {
      const abs = Math.abs(v);
      return abs >= NG ? "NG" : abs >= CHECK ? "CHECK" : "OK";
    };
    const colorOf = (v) => {
      const abs = Math.abs(v);
      return abs >= NG ? COLOR_NG : abs >= CHECK ? COLOR_CHECK : CI_GREEN;
    };

    const rows = [];
    if (showBefore) {
      if (!hiddenPos.has("L")) rows.push({ label: "Before L", val: pt.bL, color: "#b0b5bc", isBefore: true });
      if (hasC && !hiddenPos.has("C")) rows.push({ label: "Before C", val: pt.bC, color: "#a098b0", isBefore: true });
      if (!hiddenPos.has("R")) rows.push({ label: "Before R", val: pt.bR, color: "#b0b5bc", isBefore: true });
    }
    if (showAfter) {
      if (!hiddenPos.has("L")) rows.push({ label: "After L", val: pt.aL, color: POS_COLORS.L, isBefore: false });
      if (hasC && !hiddenPos.has("C")) rows.push({ label: "After C", val: pt.aC, color: POS_COLORS.C, isBefore: false });
      if (!hiddenPos.has("R")) rows.push({ label: "After R", val: pt.aR, color: POS_COLORS.R, isBefore: false });
    }

    return (
      <div style={{
        background: "#fff", border: `1px solid ${BORDER_LIGHT}`, borderRadius: 8,
        padding: "8px 12px", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        minWidth: 120,
      }}>
        <strong style={{ fontSize: 12 }}>{xLabel}</strong>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6, marginTop: 3,
            opacity: r.isBefore ? 0.6 : 1,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: r.color, display: "inline-block",
            }} />
            <span style={{ fontWeight: 600 }}>{r.label}:</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt(r.val)}mm</span>
            {!r.isBefore && (
              <span style={{ fontSize: 9, fontWeight: 700, color: colorOf(r.val) }}>
                ({statusOf(r.val)})
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }, [chartPoints, showBefore, showAfter, hiddenPos, hasC, CHECK, NG]);

  if (!perRow || perRow.length === 0) return null;

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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, mb: 0.3 }}>
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
            {title}
          </Typography>
          {modeLabel && (
            <Typography variant="caption" sx={{ ml: 1, fontSize: 9, color: CI_PRIMARY, fontWeight: 600 }}>
              {modeLabel}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.3} flexWrap="wrap">
          <Chip label="Before" size="small" onClick={() => setShowBefore((v) => !v)}
            sx={chipSx(showBefore, "rgba(120,120,120,0.45)")} />
          <Chip label="After" size="small" onClick={() => setShowAfter((v) => !v)}
            sx={chipSx(showAfter, CI_PRIMARY)} />
          {posKeys.map((p) => (
            <Chip key={p} label={p} size="small" onClick={() => togglePos(p)}
              sx={chipSx(!hiddenPos.has(p), POS_COLORS[p])} />
          ))}
        </Stack>
      </Stack>

      <Box sx={{ height: 280 }}>
        <ResponsiveLine
          data={dummyData}
          margin={{ top: 10, right: 16, bottom: 28, left: 44 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: -0.20, max: 0.20, stacked: false }}
          curve="monotoneX"
          animate={false}
          enableArea={false}
          enablePoints={false}
          enableGridX={false}
          enableGridY={true}
          gridYValues={[-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15]}
          axisLeft={{
            tickSize: 3,
            tickValues: [-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15],
            format: (v) => (v > 0 ? "+" : "") + v.toFixed(2),
          }}
          axisBottom={{ tickSize: 3, tickRotation: 0 }}
          colors={() => "transparent"}
          enableSlices="x"
          sliceTooltip={tooltipLayer}
          layers={[
            "grid", BandLayer, "markers", "axes",
            MainChartLayer,
            "slices",
          ]}
          theme={{
            text: { fontSize: 10, fontWeight: 600 },
            grid: { line: { stroke: "rgba(0,0,0,0.06)", strokeWidth: 1 } },
            axis: { ticks: { text: { fontSize: 10 } } },
            crosshair: { line: { stroke: CI_PRIMARY, strokeWidth: 1 } },
          }}
        />
      </Box>

      {/* 하단 범례 */}
      <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 0.5 }} flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{ width: 14, height: 7, borderRadius: 0.5, bgcolor: "#d5d8dc", border: "1px solid #b0b5bc" }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>Before 범위(좌~우)</Typography>
        </Stack>
        {hasC && (
          <Stack direction="row" alignItems="center" spacing={0.3}>
            <Box sx={{ width: 14, height: 0, borderTop: "1.5px dashed #a098b0" }} />
            <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>Before 중(C)</Typography>
          </Stack>
        )}
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{ width: 10, height: 2, bgcolor: POS_COLORS.L, borderRadius: 1 }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>After 좌(L)</Typography>
        </Stack>
        {hasC && (
          <Stack direction="row" alignItems="center" spacing={0.3}>
            <Box sx={{ width: 10, height: 3, bgcolor: POS_COLORS.C, borderRadius: 1 }} />
            <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>After 중(C)</Typography>
          </Stack>
        )}
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{ width: 10, height: 2, bgcolor: POS_COLORS.R, borderRadius: 1 }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>After 우(R)</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{ width: 10, height: 10, bgcolor: "rgba(232,134,12,0.1)", borderRadius: 0.5 }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: COLOR_CHECK }}>CHECK</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.3}>
          <Box sx={{ width: 10, height: 10, bgcolor: "rgba(220,38,38,0.1)", borderRadius: 0.5 }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: COLOR_NG }}>NG</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
