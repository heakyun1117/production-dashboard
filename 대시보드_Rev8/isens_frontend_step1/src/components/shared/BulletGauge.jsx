import React from "react";
import { Box, Typography } from "@mui/material";
import { fmt2 } from "./fmt";
import {
  COLOR_NG,
  COLOR_CHECK,
  CI_GREEN,
  CI_PRIMARY,
  STATUS_STYLES,
} from "./colors";

/**
 * BulletGauge — 불릿 게이지 (마진 시각화용)
 *
 * |====DANGER====|===OBSERVE===|=====NORMAL=====| ← 배경 3-zone
 *                     ▼ current (마커)
 *
 * @param {number} value   - 현재 마진 (mm) 또는 소모량
 * @param {number} ngLimit - NG 경계 (mm)
 * @param {number} checkLimit - CHECK 경계 (mm)
 * @param {number} max     - 게이지 최대값 (mm)
 * @param {string} label   - 좌측 라벨 (예: "X", "Y", "원단")
 * @param {string} mode    - "margin" | "consumed" (margin: 잔여마진, consumed: 소모량)
 */
export default function BulletGauge({
  value = 0,
  ngLimit = 0.15,
  checkLimit = 0.10,
  max = 0.20,
  label = "",
  mode = "margin",
  height = 28,
}) {
  const gaugeW = "100%";
  const absVal = Math.abs(value);
  const clippedVal = Math.min(absVal, max);
  const pct = (v) => `${Math.min((v / max) * 100, 100)}%`;

  // 상태 판정
  const zone =
    absVal >= ngLimit ? "danger" : absVal >= checkLimit ? "observe" : "normal";

  const zoneColor = {
    danger: COLOR_NG,
    observe: COLOR_CHECK,
    normal: CI_GREEN,
  };

  const zoneLabel = {
    danger: "NG",
    observe: "CHECK",
    normal: "OK",
  };

  const zoneBg = {
    danger: STATUS_STYLES.NG.bg,
    observe: STATUS_STYLES.CHECK.bg,
    normal: STATUS_STYLES.OK.bg,
  };

  // 마커 위치 (왼쪽→오른쪽 = 0→max)
  const markerLeft = pct(clippedVal);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
      {/* 좌측 라벨 */}
      {label && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            fontSize: 12,
            color: "text.secondary",
            width: 52,
            flexShrink: 0,
          }}
        >
          {label}
        </Typography>
      )}

      {/* 게이지 트랙 */}
      <Box
        sx={{
          position: "relative",
          flex: 1,
          height,
          borderRadius: 2,
          overflow: "hidden",
          background: "rgba(0,0,0,0.03)",
        }}
      >
        {/* 3-Zone 배경: Normal → Check → NG */}
        {/* Normal zone (0 ~ checkLimit) */}
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: pct(checkLimit),
            background: "rgba(120,190,32,0.12)",
          }}
        />
        {/* Observe zone (checkLimit ~ ngLimit) */}
        <Box
          sx={{
            position: "absolute",
            left: pct(checkLimit),
            top: 0,
            bottom: 0,
            width: pct(ngLimit - checkLimit),
            background: "rgba(232,134,12,0.12)",
          }}
        />
        {/* Danger zone (ngLimit ~ max) */}
        <Box
          sx={{
            position: "absolute",
            left: pct(ngLimit),
            top: 0,
            bottom: 0,
            width: pct(max - ngLimit),
            background: "rgba(220,38,38,0.10)",
          }}
        />

        {/* CHECK 경계선 */}
        <Box
          sx={{
            position: "absolute",
            left: pct(checkLimit),
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: `1.5px dashed ${COLOR_CHECK}`,
            opacity: 0.5,
          }}
        />

        {/* NG 경계선 */}
        <Box
          sx={{
            position: "absolute",
            left: pct(ngLimit),
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: `1.5px solid ${COLOR_NG}`,
            opacity: 0.5,
          }}
        />

        {/* 0 라인 */}
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "1.5px",
            background: "rgba(0,0,0,0.15)",
          }}
        />

        {/* 값 마커 (삼각 + 수직선) */}
        <Box
          sx={{
            position: "absolute",
            left: markerLeft,
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: `2.5px solid ${zoneColor[zone]}`,
            transform: "translateX(-1.25px)",
            transition: "left 0.3s ease",
          }}
        />
        {/* 마커 삼각형 (하단) */}
        <Box
          sx={{
            position: "absolute",
            left: markerLeft,
            bottom: 0,
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderBottom: `6px solid ${zoneColor[zone]}`,
            transform: "translateX(-5px)",
            transition: "left 0.3s ease",
          }}
        />

        {/* Zone 라벨 (내부) */}
        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            left: 4,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 8,
            fontWeight: 700,
            color: "rgba(0,0,0,0.25)",
            pointerEvents: "none",
          }}
        >
          OK
        </Typography>
        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            left: `calc(${pct(checkLimit)} + 4px)`,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 8,
            fontWeight: 700,
            color: "rgba(0,0,0,0.20)",
            pointerEvents: "none",
          }}
        >
          CHK
        </Typography>
        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            left: `calc(${pct(ngLimit)} + 4px)`,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 8,
            fontWeight: 700,
            color: "rgba(0,0,0,0.18)",
            pointerEvents: "none",
          }}
        >
          NG
        </Typography>
      </Box>

      {/* 수치 + 판정 */}
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
          color: zoneColor[zone],
          width: 80,
          textAlign: "right",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {fmt2(absVal)} mm
      </Typography>
      <Box
        sx={{
          px: 0.8,
          py: 0.15,
          borderRadius: 1,
          background: zoneBg[zone],
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            fontSize: 10,
            color: zoneColor[zone],
          }}
        >
          {zoneLabel[zone]}
        </Typography>
      </Box>
    </Box>
  );
}
