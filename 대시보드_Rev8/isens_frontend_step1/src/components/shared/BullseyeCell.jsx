import React from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { fmt2, asNumber } from "./fmt";
import { COLOR_NG, COLOR_CHECK, CI_PRIMARY, CI_GREEN, CI_GRAY, REF_LINE, BORDER_LIGHT } from "./colors";
import useThresholdStore from "../../store/useThresholdStore";

const COLOR_NORMAL = CI_PRIMARY;
const COLOR_GREEN = CI_GREEN;

const DOT_SIZE = 12;

// Zone 정의: L/C/R 각각의 마커, 색상
const ZONES = [
  { id: "L", label: "L", marker: "▲", defaultColor: COLOR_NORMAL },
  { id: "C", label: "C", marker: "●", defaultColor: CI_GRAY },
  { id: "R", label: "R", marker: "◆", defaultColor: COLOR_GREEN },
];

/**
 * BullseyeCell — 연속 3-Zone 2D 공간 분포 (Phase 1.6d+)
 *
 * L / C / R 을 하나의 연결된 Row로 표현 (구분선 최소화).
 * 각 Zone 사이 간격 없이 연속 배치 → 한 반제품 로우 느낌.
 * 우측 수치 제거 → 마커 호버 시 툴팁으로 정보 표시.
 *
 * [SPEC LOCK] CHECK ±0.10 / NG ±0.15 / SCALE ±0.20
 */
export default function BullseyeCell({
  yL,
  yC,
  yR,
  xL,
  xR,
  height = 100,
  scale = 0.20,
}) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK_LIMIT = storeT.check;
  const NG_LIMIT = storeT.ng;
  const vYL = asNumber(yL) ?? 0;
  const vYC = asNumber(yC) ?? 0;
  const vYR = asNumber(yR) ?? 0;
  const vXL = asNumber(xL) ?? 0;
  const vXR = asNumber(xR) ?? 0;
  const vXC = (vXL + vXR) / 2;

  // Zone별 X/Y값 매핑
  const zoneData = [
    { xVal: vXL, yVal: vYL },
    { xVal: vXC, yVal: vYC },
    { xVal: vXR, yVal: vYR },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        height,
        borderRadius: 2,
        background: "rgba(0,0,0,0.015)",
        border: `1px solid ${BORDER_LIGHT}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Zone 라벨 — 상단에 L / C / R 텍스트 (연속 배경 위에 오버레이) */}
      {ZONES.map((zone, i) => (
        <Typography
          key={`label-${zone.id}`}
          variant="caption"
          sx={{
            position: "absolute",
            top: 3,
            left: `${(i * 100) / 3 + 100 / 6}%`,
            transform: "translateX(-50%)",
            fontSize: 9,
            fontWeight: 700,
            color: zone.defaultColor,
            opacity: 0.6,
            userSelect: "none",
            zIndex: 3,
          }}
        >
          {zone.label}
        </Typography>
      ))}

      {/* 3개 Zone — 간격 없이 연속 배치 */}
      {ZONES.map((zone, i) => {
        const { xVal, yVal } = zoneData[i];
        const status = getStatus2D(xVal, yVal, NG_LIMIT, CHECK_LIMIT);
        const color = dotColor2D(xVal, yVal, NG_LIMIT, CHECK_LIMIT) ?? zone.defaultColor;

        // 방향 텍스트 생성 (종합 방향)
        const dirParts = [];
        if (yVal > 0.02) dirParts.push("상");
        else if (yVal < -0.02) dirParts.push("하");
        if (xVal > 0.02) dirParts.push("우");
        else if (xVal < -0.02) dirParts.push("좌");
        const combinedDir = dirParts.length > 0 ? `${dirParts.join("")}측 쏠림` : "정상";

        const tooltipContent = (
          <Box sx={{ p: 0.3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, mb: 0.3 }}>
              {zone.marker} {zone.label} ({zone.id === "L" ? "좌" : zone.id === "C" ? "중앙" : "우"})
            </Typography>
            <Typography sx={{ fontSize: 10 }}>
              X: {xVal >= 0 ? "+" : ""}{fmt2(xVal)} mm · Y: {yVal >= 0 ? "+" : ""}{fmt2(yVal)} mm
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 600, mt: 0.2 }}>
              {combinedDir}
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: status === "NG" ? COLOR_NG : status === "CHECK" ? COLOR_CHECK : COLOR_GREEN, mt: 0.3 }}>
              판정: {status}
            </Typography>
          </Box>
        );

        return (
          <SingleZone
            key={zone.id}
            xVal={xVal}
            yVal={yVal}
            marker={zone.marker}
            markerColor={color}
            height={height}
            scale={scale}
            isFirst={i === 0}
            isLast={i === ZONES.length - 1}
            tooltipContent={tooltipContent}
            ngLimit={NG_LIMIT}
            checkLimit={CHECK_LIMIT}
          />
        );
      })}
    </Box>
  );
}

// 2D 상태 판정
function getStatus2D(xVal, yVal, ngLimit, checkLimit) {
  const worst = Math.max(Math.abs(xVal), Math.abs(yVal));
  if (worst >= ngLimit) return "NG";
  if (worst >= checkLimit) return "CHECK";
  return "OK";
}

function dotColor2D(xVal, yVal, ngLimit, checkLimit) {
  const worst = Math.max(Math.abs(xVal), Math.abs(yVal));
  if (worst >= ngLimit) return COLOR_NG;
  if (worst >= checkLimit) return COLOR_CHECK;
  return null;
}

/**
 * SingleZone — 개별 L/C/R 좌표 영역 (구분선 최소화)
 * 연속 배치: 테두리 없이 미세한 세로 구분선만
 */
function SingleZone({ xVal, yVal, marker, markerColor, height, scale, isFirst, isLast, tooltipContent, ngLimit, checkLimit }) {
  const ngRatio = ngLimit / scale;       // 0.75
  const checkRatio = checkLimit / scale; // 0.50

  // 마커 위치 (% 기반)
  const clip = (v) => Math.max(-scale, Math.min(scale, v));
  const xPct = 50 + (clip(xVal) / scale) * 50;
  const yPct = 50 - (clip(yVal) / scale) * 50;

  const ngPctY = (1 - ngRatio) * 50;
  const chkPctY = (1 - checkRatio) * 50;

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        position: "relative",
        height: "100%",
        // Zone 사이 미세한 세로 구분선 (첫 번째 제외)
        ...(!isFirst && {
          borderLeft: "1px dashed rgba(0,0,0,0.06)",
        }),
      }}
    >
      {/* NG 경계 사각형 */}
      <Box
        sx={{
          position: "absolute",
          left: `${(1 - ngRatio) * 50}%`,
          right: `${(1 - ngRatio) * 50}%`,
          top: `${ngPctY}%`,
          bottom: `${ngPctY}%`,
          border: `1px dashed ${REF_LINE.NG}`,
          borderRadius: 0.5,
        }}
      />

      {/* CHECK 경계 사각형 */}
      <Box
        sx={{
          position: "absolute",
          left: `${(1 - checkRatio) * 50}%`,
          right: `${(1 - checkRatio) * 50}%`,
          top: `${chkPctY}%`,
          bottom: `${chkPctY}%`,
          border: `1px dashed ${REF_LINE.CHECK}`,
          borderRadius: 0.5,
        }}
      />

      {/* 중앙 가로선 */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: "1px",
          background: "rgba(0,0,0,0.05)",
        }}
      />
      {/* 중앙 세로선 */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: "1px",
          background: "rgba(0,0,0,0.05)",
        }}
      />

      {/* Y축 눈금 라벨 (가장 오른쪽 Zone만) */}
      {isLast && (
        <>
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              right: 2,
              top: `${ngPctY}%`,
              transform: "translateY(-50%)",
              fontSize: 7,
              color: "rgba(220,38,38,0.35)",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              userSelect: "none",
            }}
          >
            {fmt2(ngLimit)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              right: 2,
              bottom: `${ngPctY}%`,
              transform: "translateY(50%)",
              fontSize: 7,
              color: "rgba(220,38,38,0.35)",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              userSelect: "none",
            }}
          >
            -{fmt2(ngLimit)}
          </Typography>
        </>
      )}

      {/* 마커 렌더링 (Tooltip 포함) */}
      <MarkerDot
        marker={marker}
        color={markerColor}
        xPct={xPct}
        yPct={yPct}
        tooltipContent={tooltipContent}
      />
    </Box>
  );
}

/**
 * MarkerDot — 마커 렌더링 (▲/●/◆) + 호버 Tooltip
 */
function MarkerDot({ marker, color, xPct, yPct, tooltipContent }) {
  const half = DOT_SIZE / 2;

  const baseSx = {
    position: "absolute",
    left: `${xPct}%`,
    top: `${yPct}%`,
    transition: "left 0.2s ease, top 0.2s ease",
    zIndex: 2,
    filter: "drop-shadow(0 0 1.5px rgba(0,0,0,0.3))",
    cursor: "pointer",
    "&:hover": {
      transform: "scale(1.3)",
      filter: "drop-shadow(0 0 3px rgba(0,0,0,0.4))",
    },
  };

  let markerEl;

  if (marker === "▲") {
    markerEl = (
      <Box
        sx={{
          ...baseSx,
          ml: `-${half}px`,
          mt: `-${half}px`,
          width: 0,
          height: 0,
          borderLeft: `${half}px solid transparent`,
          borderRight: `${half}px solid transparent`,
          borderBottom: `${DOT_SIZE}px solid ${color}`,
        }}
      />
    );
  } else if (marker === "◆") {
    markerEl = (
      <Box
        sx={{
          ...baseSx,
          ml: `-${half}px`,
          mt: `-${half}px`,
          width: DOT_SIZE,
          height: DOT_SIZE,
          background: color,
          border: "1.5px solid #fff",
          boxShadow: "0 0 2px rgba(0,0,0,0.2)",
          transform: "rotate(45deg)",
          "&:hover": {
            transform: "rotate(45deg) scale(1.3)",
            filter: "drop-shadow(0 0 3px rgba(0,0,0,0.4))",
          },
        }}
      />
    );
  } else {
    markerEl = (
      <Box
        sx={{
          ...baseSx,
          ml: `-${half}px`,
          mt: `-${half}px`,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "50%",
          background: color,
          border: "1.5px solid #fff",
          boxShadow: "0 0 2px rgba(0,0,0,0.2)",
        }}
      />
    );
  }

  return (
    <Tooltip
      title={tooltipContent}
      arrow
      placement="top"
      enterDelay={100}
      leaveDelay={0}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: "rgba(255,255,255,0.97)",
            color: "text.primary",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 1.5,
            p: 0.75,
            "& .MuiTooltip-arrow": {
              color: "rgba(255,255,255,0.97)",
            },
          },
        },
      }}
    >
      {markerEl}
    </Tooltip>
  );
}
