import React from "react";
import { Box, Typography } from "@mui/material";
import { fmt2, asNumber } from "./fmt";
import StatusChip from "./StatusChip";
import { COLOR_NG, COLOR_CHECK, CI_PRIMARY, TRACK_BG, REF_LINE, BAR_OPACITY } from "./colors";
import useThresholdStore from "../../store/useThresholdStore";

/**
 * BarCell — 0-중심 막대 + CHECK/NG 기준선 + 방향텍스트 + 숫자
 *
 * @param {number}  value         - 측정값
 * @param {string}  axis          - "X" | "Y" | "P"
 * @param {string}  variant       - "default" | "large" (large: DetailHeader 전용)
 * @param {boolean} hideStatus    - 판정뱃지 숨김
 * @param {number}  [ngLimit]     - NG 기준값 override
 * @param {number}  [checkLimit]  - CHECK 기준값 override
 * @param {number}  [scale]       - SCALE override
 * @param {string}  [dirTextMode] - "margin" | "interference" | undefined(기본=쏠림)
 */
export default function BarCell({
  value, axis = "X", variant = "default", hideStatus = false,
  ngLimit, checkLimit, scale, dirTextMode,
}) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const NG_LIMIT = ngLimit ?? storeT.ng;
  const CHECK_LIMIT = checkLimit ?? storeT.check;
  const SCALE = scale ?? storeT.scale;

  const isLarge = variant === "large";
  const halfW = isLarge ? 100 : 64;
  const trackH = isLarge ? 20 : 14;

  const vRaw = asNumber(value) ?? 0;
  // Punch(타발)는 부호가 X와 반대 → 반전하여 바 방향·텍스트 통일
  const v = axis === "P" ? -vRaw : vRaw;
  const absV = Math.abs(v);
  const vClip = Math.max(-SCALE, Math.min(SCALE, v));
  const len = (Math.abs(vClip) / SCALE) * halfW;
  const isPos = vClip >= 0;
  const left = isPos ? halfW : halfW - len;
  const barW = absV < 0.005 ? 0 : Math.max(1, len);

  // 기준선 위치
  const checkPos = halfW + (CHECK_LIMIT / SCALE) * halfW;
  const checkNeg = halfW - (CHECK_LIMIT / SCALE) * halfW;
  const ngPos = halfW + (NG_LIMIT / SCALE) * halfW;
  const ngNeg = halfW - (NG_LIMIT / SCALE) * halfW;

  // 색상
  const barColor = absV >= NG_LIMIT ? COLOR_NG : absV >= CHECK_LIMIT ? COLOR_CHECK : CI_PRIMARY;
  const status = absV >= NG_LIMIT ? "NG" : absV >= CHECK_LIMIT ? "CHECK" : "OK";

  // 방향 텍스트 — CHECK 기준: OK 범위이면 "정상", CHECK 이상부터 방향 표현
  const okText = dirTextMode === "interference" ? "양호" : "정상";
  const dirText = absV < CHECK_LIMIT
    ? okText
    : dirTextMode === "margin"
      ? (v > 0 ? "늘어남" : "줄어듬")
    : dirTextMode === "interference"
      ? "간섭 경계"
    : (axis === "X" || axis === "P"
        ? v > 0 ? "우측쏠림" : "좌측쏠림"
        : v > 0 ? "상측쏠림" : "하측쏠림");

  // 폰트 크기
  const dirFontSize = isLarge ? 13 : 12;
  const valFontSize = isLarge ? 14 : 13;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: isLarge ? 1.5 : 1 }}>
      {/* 바 트랙 */}
      <Box
        sx={{
          position: "relative",
          width: halfW * 2,
          height: trackH,
          borderRadius: 999,
          background: TRACK_BG,
          overflow: "hidden",
          flexShrink: 0,
        }}
        title={`${dirText} · ${fmt2(v)} mm`}
      >
        {/* 0 center line */}
        <Box sx={{ position: "absolute", left: halfW, top: 0, bottom: 0, width: "1px", background: "rgba(0,0,0,0.12)" }} />

        {/* CHECK 기준선 (점선) */}
        <Box sx={{
          position: "absolute", left: checkNeg, top: 1, bottom: 1, width: 0,
          borderLeft: `1px dashed ${REF_LINE.CHECK}`,
        }} />
        <Box sx={{
          position: "absolute", left: checkPos, top: 1, bottom: 1, width: 0,
          borderLeft: `1px dashed ${REF_LINE.CHECK}`,
        }} />

        {/* NG 기준선 (점선) */}
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
            top: isLarge ? 3 : 2,
            height: isLarge ? 14 : 10,
            left,
            width: barW,
            borderRadius: 999,
            background: barColor,
            opacity: BAR_OPACITY,
          }}
        />
      </Box>

      {/* 방향 */}
      <Typography
        variant="body2"
        sx={{
          width: isLarge ? 64 : 56,
          textAlign: "left",
          fontSize: dirFontSize,
          fontWeight: isLarge ? 700 : 600,
          color: "text.secondary",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {dirText}
      </Typography>

      {/* 값 (tabular-nums) */}
      <Typography
        variant="body2"
        sx={{
          width: isLarge ? 80 : 72,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontSize: valFontSize,
          fontWeight: isLarge ? 700 : 600,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {vRaw >= 0 ? "+" : ""}{fmt2(vRaw)} mm
      </Typography>

      {/* 판정 뱃지 */}
      {!hideStatus && (
        <Box sx={{ width: 64, flexShrink: 0 }}>
          <StatusChip status={status} />
        </Box>
      )}
    </Box>
  );
}
