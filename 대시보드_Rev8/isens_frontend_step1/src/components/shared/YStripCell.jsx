import React, { useRef, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { fmt2, asNumber } from "./fmt";
import { COLOR_NG, COLOR_CHECK, CI_PRIMARY, CI_GRAY, CI_GREEN } from "./colors";
import useThresholdStore from "../../store/useThresholdStore";

const COLOR_NORMAL = CI_PRIMARY;  // L marker default
const COLOR_GRAY = CI_GRAY;      // C marker default
const COLOR_GREEN = CI_GREEN;    // R marker default

/**
 * YStripCell — 3-트랙 Y 시각화 (BullseyeCell 대체)
 *
 * Y 편차값을 가로 방향 1D 트랙 3개로 표현 → 좌우 편향이 직접 보임
 * + 틸트 라인(SVG polyline)으로 L→C→R 패턴 시각화
 *
 * ┌─── L(▲) ───┬─── C(●) ───┬─── R(◆) ───┐
 * │   ──▲──     │   ──●──    │   ────◆──   │  ← 18px 트랙
 * └────────────┴────────────┴────────────┘
 *          ╲_______●_______╱                  ← 틸트 라인
 *   L: +0.05     C: -0.02     R: +0.12       ← 수치
 */
export default function YStripCell({ yL, yC, yR }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK_LIMIT = storeT.check;
  const NG_LIMIT = storeT.ng;
  const SCALE = storeT.scale;

  const containerRef = useRef(null);
  const [containerW, setContainerW] = useState(0);

  const vL = asNumber(yL) ?? 0;
  const vC = asNumber(yC) ?? 0;
  const vR = asNumber(yR) ?? 0;

  // 컨테이너 폭 측정 (SVG 좌표 계산용)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setContainerW(e.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 트랙 3등분 계산
  const trackW = containerW / 3;
  const TRACK_H = 18;
  const TILT_H = 16;
  const LABEL_H = 18;
  const TOTAL_H = TRACK_H + TILT_H + LABEL_H;

  // 편차 → 퍼센트 위치 (0.5 = center)
  const toPercent = (v) => {
    const clipped = Math.max(-SCALE, Math.min(SCALE, v));
    return 50 + (clipped / SCALE) * 50;
  };

  // 색상 판정
  const getColor = (v, defaultColor) => {
    const abs = Math.abs(v);
    if (abs >= NG_LIMIT) return COLOR_NG;
    if (abs >= CHECK_LIMIT) return COLOR_CHECK;
    return defaultColor;
  };

  const getStatus = (v) => {
    const abs = Math.abs(v);
    if (abs >= NG_LIMIT) return "NG";
    if (abs >= CHECK_LIMIT) return "CHECK";
    return "OK";
  };

  // 틸트 라인 SVG 좌표 계산
  const tiltPoints = containerW > 0 ? [
    { x: trackW * 0.5, y: TILT_H / 2 + ((TILT_H / 2 - 2) * (vL / SCALE) * -1) },
    { x: trackW * 1.5, y: TILT_H / 2 + ((TILT_H / 2 - 2) * (vC / SCALE) * -1) },
    { x: trackW * 2.5, y: TILT_H / 2 + ((TILT_H / 2 - 2) * (vR / SCALE) * -1) },
  ] : [];

  const tiltSvgPoints = tiltPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // 틸트 라인 색상
  const maxAbs = Math.max(Math.abs(vL), Math.abs(vC), Math.abs(vR));
  const tiltColor = maxAbs >= NG_LIMIT
    ? "rgba(220,38,38,0.4)"
    : maxAbs >= CHECK_LIMIT
      ? "rgba(232,134,12,0.4)"
      : "rgba(23,28,143,0.3)";

  return (
    <Box ref={containerRef} sx={{ width: "100%" }}>
      {containerW > 0 && (
        <Box sx={{ position: "relative", height: TOTAL_H }}>
          {/* 3-트랙 영역 */}
          <Box sx={{ display: "flex", height: TRACK_H }}>
            <Track value={vL} marker="triangle" color={getColor(vL, COLOR_NORMAL)} limits={{ CHECK_LIMIT, NG_LIMIT, SCALE }} />
            <Track value={vC} marker="circle" color={getColor(vC, COLOR_GRAY)} limits={{ CHECK_LIMIT, NG_LIMIT, SCALE }} />
            <Track value={vR} marker="diamond" color={getColor(vR, COLOR_GREEN)} limits={{ CHECK_LIMIT, NG_LIMIT, SCALE }} />
          </Box>

          {/* 틸트 라인 */}
          <Box sx={{ position: "relative", height: TILT_H }}>
            <svg
              width={containerW}
              height={TILT_H}
              style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
            >
              {/* 중앙 기준선 */}
              <line
                x1={0}
                y1={TILT_H / 2}
                x2={containerW}
                y2={TILT_H / 2}
                stroke="rgba(0,0,0,0.06)"
                strokeWidth={1}
              />
              {/* 틸트 polyline */}
              <polyline
                points={tiltSvgPoints}
                fill="none"
                stroke={tiltColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 꼭짓점 원 */}
              {tiltPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={[
                    getColor(vL, COLOR_NORMAL),
                    getColor(vC, COLOR_GRAY),
                    getColor(vR, COLOR_GREEN),
                  ][i]}
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
            </svg>
          </Box>

          {/* 수치 라벨 */}
          <Box sx={{ display: "flex", height: LABEL_H }}>
            <ValueLabel marker="▲" markerColor={getColor(vL, COLOR_NORMAL)} value={vL} status={getStatus(vL)} />
            <ValueLabel marker="●" markerColor={getColor(vC, COLOR_GRAY)} value={vC} status={getStatus(vC)} />
            <ValueLabel marker="◆" markerColor={getColor(vR, COLOR_GREEN)} value={vR} status={getStatus(vR)} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** 개별 트랙 (1/3 폭) */
function Track({ value, marker, color, limits }) {
  const { CHECK_LIMIT, NG_LIMIT, SCALE } = limits;
  const v = asNumber(value) ?? 0;
  const pct = 50 + (Math.max(-SCALE, Math.min(SCALE, v)) / SCALE) * 50;

  // CHECK/NG 기준 퍼센트
  const checkPctNeg = 50 - (CHECK_LIMIT / SCALE) * 50;
  const checkPctPos = 50 + (CHECK_LIMIT / SCALE) * 50;
  const ngPctNeg = 50 - (NG_LIMIT / SCALE) * 50;
  const ngPctPos = 50 + (NG_LIMIT / SCALE) * 50;

  const TRACK_H = 18;
  const DOT_SIZE = 9;

  return (
    <Box
      sx={{
        flex: 1,
        position: "relative",
        height: TRACK_H,
        borderRadius: 999,
        background: "rgba(0,0,0,0.03)",
        mx: 0.25,
        overflow: "hidden",
      }}
    >
      {/* 중앙선 */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: "1px",
          background: "rgba(0,0,0,0.10)",
        }}
      />

      {/* CHECK 기준선 */}
      <Box sx={{ position: "absolute", left: `${checkPctNeg}%`, top: 3, bottom: 3, width: 0, borderLeft: "1px dashed rgba(232,134,12,0.30)" }} />
      <Box sx={{ position: "absolute", left: `${checkPctPos}%`, top: 3, bottom: 3, width: 0, borderLeft: "1px dashed rgba(232,134,12,0.30)" }} />

      {/* NG 기준선 */}
      <Box sx={{ position: "absolute", left: `${ngPctNeg}%`, top: 2, bottom: 2, width: 0, borderLeft: "1px dashed rgba(220,38,38,0.20)" }} />
      <Box sx={{ position: "absolute", left: `${ngPctPos}%`, top: 2, bottom: 2, width: 0, borderLeft: "1px dashed rgba(220,38,38,0.20)" }} />

      {/* 마커 */}
      {marker === "circle" && (
        <Box
          sx={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: "50%",
            background: color,
            border: "1.5px solid #fff",
            boxShadow: `0 0 0 1px ${color}40`,
            transition: "left 0.2s ease",
          }}
        />
      )}
      {marker === "triangle" && (
        <Box
          sx={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 0,
            height: 0,
            borderLeft: `${DOT_SIZE / 2}px solid transparent`,
            borderRight: `${DOT_SIZE / 2}px solid transparent`,
            borderBottom: `${DOT_SIZE}px solid ${color}`,
            filter: "drop-shadow(0 0 1px rgba(0,0,0,0.25))",
            transition: "left 0.2s ease",
          }}
        />
      )}
      {marker === "diamond" && (
        <Box
          sx={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%) rotate(45deg)",
            width: DOT_SIZE - 1,
            height: DOT_SIZE - 1,
            background: color,
            border: "1.5px solid #fff",
            boxShadow: `0 0 0 1px ${color}40`,
            transition: "left 0.2s ease",
          }}
        />
      )}
    </Box>
  );
}

/** 수치 라벨 (1/3 폭) */
function ValueLabel({ marker, markerColor, value, status }) {
  const statusColorMap = { NG: "#DC2626", CHECK: "#E8860C", OK: "text.secondary" };
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.3,
      }}
    >
      <Typography variant="caption" sx={{ fontSize: 10, color: markerColor, fontWeight: 700 }}>
        {marker}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          fontSize: 10,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
        }}
      >
        {value >= 0 ? "+" : ""}{fmt2(value)}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 700, color: statusColorMap[status] }}>
        {status}
      </Typography>
    </Box>
  );
}
