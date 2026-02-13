import React from "react";
import { Box, Typography } from "@mui/material";
import { fmt2 } from "./fmt";
import { COLOR_NG, COLOR_CHECK, CI_PRIMARY, TRACK_BG, REF_LINE, BAR_OPACITY } from "./colors";
import useThresholdStore from "../../store/useThresholdStore";

/**
 * DivergingBarCell — Explorer 리스트용 0-중심 수평 막대 + CHECK/NG 기준선
 *
 * @param {number} value
 * @param {string} axis - "X" | "Y"
 * @param {boolean} compact - true(기본): 작은 바 + 축약 방향, false: 기존 크기
 */
export default function DivergingBarCell({ value, axis = "X", compact = true }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const NG = storeT.ng;
  const CHECK = storeT.check;
  const SCALE = storeT.scale;

  const halfW = compact ? 40 : 56;
  const v = Number(value ?? 0);
  const absV = Math.abs(v);
  const vClip = Math.max(-SCALE, Math.min(SCALE, v));
  const len = (Math.abs(vClip) / SCALE) * halfW;

  const isPos = vClip >= 0;
  const left = isPos ? halfW : halfW - len;
  const barW = absV < 0.005 ? 0 : Math.max(1, len);

  // 기준선 위치
  const checkPos = halfW + (CHECK / SCALE) * halfW;
  const checkNeg = halfW - (CHECK / SCALE) * halfW;
  const ngPos = halfW + (NG / SCALE) * halfW;
  const ngNeg = halfW - (NG / SCALE) * halfW;

  const barColor = absV >= NG ? COLOR_NG : absV >= CHECK ? COLOR_CHECK : CI_PRIMARY;

  // 방향 축약
  const dirText = absV < 0.005
    ? (compact ? "-" : "정상")
    : compact
      ? (axis === "X" ? (v > 0 ? "우" : "좌") : (v > 0 ? "상" : "하"))
      : (axis === "X" ? (v > 0 ? "우측" : "좌측") : (v > 0 ? "상측" : "하측"));

  const title = absV < 0.005
    ? `${axis}: 0.00 mm (정상)`
    : `${axis}: ${v > 0 ? "+" : ""}${fmt2(v)} mm (${
        axis === "X"
          ? (v > 0 ? "우측쏠림" : "좌측쏠림")
          : (v > 0 ? "상측쏠림" : "하측쏠림")
      })`;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {/* 바 트랙 */}
      <Box
        sx={{
          position: "relative",
          width: halfW * 2,
          height: compact ? 12 : 14,
          borderRadius: 999,
          background: TRACK_BG,
          overflow: "hidden",
          flexShrink: 0,
        }}
        title={title}
      >
        {/* 0 center */}
        <Box sx={{ position: "absolute", left: halfW, top: 0, bottom: 0, width: "1px", background: "rgba(0,0,0,0.12)" }} />

        {/* CHECK 기준선 (점선, 저채도) */}
        <Box sx={{
          position: "absolute", left: checkNeg, top: 1, bottom: 1, width: 0,
          borderLeft: `1px dashed ${REF_LINE.CHECK}`,
        }} />
        <Box sx={{
          position: "absolute", left: checkPos, top: 1, bottom: 1, width: 0,
          borderLeft: `1px dashed ${REF_LINE.CHECK}`,
        }} />

        {/* NG 기준선 (점선, 저채도) */}
        <Box sx={{
          position: "absolute", left: ngNeg, top: 0, bottom: 0, width: 0,
          borderLeft: `1px dashed ${REF_LINE.NG}`,
        }} />
        <Box sx={{
          position: "absolute", left: ngPos, top: 0, bottom: 0, width: 0,
          borderLeft: `1px dashed ${REF_LINE.NG}`,
        }} />

        {/* 값 바 */}
        <Box
          sx={{
            position: "absolute",
            top: compact ? 2 : 2,
            height: compact ? 8 : 10,
            left,
            width: barW,
            borderRadius: 999,
            background: barColor,
            opacity: BAR_OPACITY,
          }}
        />
      </Box>

      {/* 방향 (고정폭) */}
      <Typography
        variant="caption"
        sx={{
          width: compact ? 16 : 28,
          textAlign: "left",
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          color: "text.secondary",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {dirText}
      </Typography>

      {/* 값 (고정폭, tabular-nums) */}
      <Typography
        variant="caption"
        sx={{
          width: compact ? 48 : 52,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontSize: compact ? 11 : 12,
          fontWeight: 600,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {fmt2(v)}
      </Typography>
    </Box>
  );
}
