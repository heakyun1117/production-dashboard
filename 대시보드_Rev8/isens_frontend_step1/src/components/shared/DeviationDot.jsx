import React from "react";
import { Box, Typography } from "@mui/material";
import { fmt2, asNumber } from "./fmt";
import StatusChip from "./StatusChip";
import { COLOR_NG, COLOR_CHECK, CI_PRIMARY, TRACK_BG, REF_LINE } from "./colors";
import useThresholdStore from "../../store/useThresholdStore";

/**
 * DeviationDot — 1D 편차 트랙 (도트 기반)
 * 바 대신 8px 원형 점으로 편차 위치 표시
 *
 * @param {number}  value   - 측정값 (mm)
 * @param {string}  axis    - "X" | "Y" | "P"
 * @param {number}  trackW  - 트랙 전체 폭 (default 200, fluid=true일 때 무시)
 * @param {boolean} fluid   - true이면 width:100% + 퍼센트 좌표 (default false)
 * @param {boolean} showText - 우측 텍스트 표시 여부 (default true)
 * @param {boolean} compact  - 컴팩트 모드 (default false)
 */
export default function DeviationDot({
  value,
  axis = "X",
  trackW = 200,
  fluid = false,
  showText = true,
  compact = false,
}) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const NG_LIMIT = storeT.ng;
  const CHECK_LIMIT = storeT.check;
  const SCALE = storeT.scale;

  const DOT_SIZE = compact ? 7 : 8;

  const v = asNumber(value) ?? 0;
  const absV = Math.abs(v);
  const vClip = Math.max(-SCALE, Math.min(SCALE, v));

  // 색상/상태
  const dotColor = absV >= NG_LIMIT ? COLOR_NG : absV >= CHECK_LIMIT ? COLOR_CHECK : CI_PRIMARY;
  const status = absV >= NG_LIMIT ? "NG" : absV >= CHECK_LIMIT ? "CHECK" : "OK";

  // 방향 텍스트
  const dirText =
    axis === "X" || axis === "P"
      ? v >= 0 ? "우측" : "좌측"
      : v >= 0 ? "상측" : "하측";

  // ── fluid 모드: 퍼센트 기반 ──
  if (fluid) {
    const dotPct = 50 + (vClip / SCALE) * 50;
    const checkNegPct = 50 - (CHECK_LIMIT / SCALE) * 50; // 25%
    const checkPosPct = 50 + (CHECK_LIMIT / SCALE) * 50; // 75%
    const ngNegPct = 50 - (NG_LIMIT / SCALE) * 50;       // 12.5%
    const ngPosPct = 50 + (NG_LIMIT / SCALE) * 50;       // 87.5%

    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: compact ? 0.5 : 1 }}>
        {/* 트랙 (fluid width) */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: compact ? 14 : 18,
            borderRadius: 999,
            background: TRACK_BG,
            flexGrow: 1,
            minWidth: 0,
          }}
          title={`${dirText} · ${fmt2(v)} mm`}
        >
          {/* 0 중앙선 */}
          <Box sx={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: "rgba(0,0,0,0.12)" }} />

          {/* CHECK 기준선 */}
          <Box sx={{ position: "absolute", left: `${checkNegPct}%`, top: 2, bottom: 2, width: 0, borderLeft: `1px dashed ${REF_LINE.CHECK}` }} />
          <Box sx={{ position: "absolute", left: `${checkPosPct}%`, top: 2, bottom: 2, width: 0, borderLeft: `1px dashed ${REF_LINE.CHECK}` }} />

          {/* NG 기준선 */}
          <Box sx={{ position: "absolute", left: `${ngNegPct}%`, top: 1, bottom: 1, width: 0, borderLeft: `1px dashed ${REF_LINE.NG}` }} />
          <Box sx={{ position: "absolute", left: `${ngPosPct}%`, top: 1, bottom: 1, width: 0, borderLeft: `1px dashed ${REF_LINE.NG}` }} />

          {/* 도트 */}
          <Box
            sx={{
              position: "absolute",
              left: `${dotPct}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: "50%",
              background: dotColor,
              border: "1.5px solid #fff",
              boxShadow: `0 0 0 1px ${dotColor}40`,
              transition: "left 0.2s ease",
            }}
          />
        </Box>

        {/* 텍스트 영역 */}
        {showText && (
          <>
            <Typography
              variant="caption"
              sx={{
                width: compact ? 24 : 36,
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
            <Typography
              variant="caption"
              sx={{
                width: compact ? 48 : 56,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                fontSize: compact ? 10 : 11,
                fontWeight: 600,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {v >= 0 ? "+" : ""}{fmt2(v)}
            </Typography>
            {!compact && (
              <Box sx={{ width: 42, flexShrink: 0 }}>
                <StatusChip status={status} />
              </Box>
            )}
          </>
        )}
      </Box>
    );
  }

  // ── 기존 픽셀 모드 (하위 호환) ──
  const halfW = trackW / 2;
  const dotCenter = halfW + (vClip / SCALE) * halfW;
  const checkPos = halfW + (CHECK_LIMIT / SCALE) * halfW;
  const checkNeg = halfW - (CHECK_LIMIT / SCALE) * halfW;
  const ngPos = halfW + (NG_LIMIT / SCALE) * halfW;
  const ngNeg = halfW - (NG_LIMIT / SCALE) * halfW;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: compact ? 0.5 : 1 }}>
      {/* 트랙 */}
      <Box
        sx={{
          position: "relative",
          width: trackW,
          height: compact ? 14 : 18,
          borderRadius: 999,
          background: TRACK_BG,
          flexShrink: 0,
        }}
        title={`${dirText} · ${fmt2(v)} mm`}
      >
        {/* 0 중앙선 */}
        <Box sx={{ position: "absolute", left: halfW, top: 0, bottom: 0, width: "1px", background: "rgba(0,0,0,0.12)" }} />

        {/* CHECK 기준선 */}
        <Box sx={{ position: "absolute", left: checkNeg, top: 2, bottom: 2, width: 0, borderLeft: `1px dashed ${REF_LINE.CHECK}` }} />
        <Box sx={{ position: "absolute", left: checkPos, top: 2, bottom: 2, width: 0, borderLeft: `1px dashed ${REF_LINE.CHECK}` }} />

        {/* NG 기준선 */}
        <Box sx={{ position: "absolute", left: ngNeg, top: 1, bottom: 1, width: 0, borderLeft: `1px dashed ${REF_LINE.NG}` }} />
        <Box sx={{ position: "absolute", left: ngPos, top: 1, bottom: 1, width: 0, borderLeft: `1px dashed ${REF_LINE.NG}` }} />

        {/* 도트 */}
        <Box
          sx={{
            position: "absolute",
            left: dotCenter - DOT_SIZE / 2,
            top: "50%",
            transform: "translateY(-50%)",
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: "50%",
            background: dotColor,
            border: "1.5px solid #fff",
            boxShadow: `0 0 0 1px ${dotColor}40`,
            transition: "left 0.2s ease",
          }}
        />
      </Box>

      {/* 텍스트 영역 */}
      {showText && (
        <>
          <Typography
            variant="caption"
            sx={{
              width: compact ? 24 : 36,
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
          <Typography
            variant="caption"
            sx={{
              width: compact ? 48 : 56,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              fontSize: compact ? 10 : 11,
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {v >= 0 ? "+" : ""}{fmt2(v)}
          </Typography>
          {!compact && (
            <Box sx={{ width: 42, flexShrink: 0 }}>
              <StatusChip status={status} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
