import React from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { fmt2, asNumber } from "../../components/shared/fmt";
import { COLOR_NG, COLOR_CHECK, CI_PRIMARY as COLOR_NORMAL, STATUS_STYLES } from "../../components/shared/colors";
const CHECK = 0.10;
const NG_LIMIT = 0.15;
const SCALE = 0.20; // ±0.20mm 스케일

function miniBarColor(v) {
  const abs = Math.abs(Number(v ?? 0));
  if (abs >= NG_LIMIT) return COLOR_NG;
  if (abs >= CHECK) return COLOR_CHECK;
  return COLOR_NORMAL;
}

/**
 * 단일 미니 바: 0 중심, ±SCALE 범위, CHECK/NG 가이드라인
 */
function MiniBar({ value, label }) {
  const halfW = 40;
  const v = asNumber(value) ?? 0;
  const vClip = Math.max(-SCALE, Math.min(SCALE, v));
  const len = (Math.abs(vClip) / SCALE) * halfW;
  const isPos = vClip >= 0;
  const left = isPos ? halfW : halfW - len;
  const barW = Math.max(1, len);
  const color = miniBarColor(v);

  const checkPos = halfW + (CHECK / SCALE) * halfW;
  const checkNeg = halfW - (CHECK / SCALE) * halfW;
  const ngPos = halfW + (NG_LIMIT / SCALE) * halfW;
  const ngNeg = halfW - (NG_LIMIT / SCALE) * halfW;

  return (
    <Stack direction="row" spacing={0.3} alignItems="center" title={`${label}: ${fmt2(v)} mm`}>
      <Typography variant="caption" sx={{ width: 14, fontSize: 9, color: "text.secondary", textAlign: "right" }}>
        {label}
      </Typography>
      <Box
        sx={{
          position: "relative",
          width: halfW * 2,
          height: 8,
          borderRadius: 4,
          background: "rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* 0 line */}
        <Box sx={{ position: "absolute", left: halfW, top: 0, bottom: 0, width: "1px", background: "rgba(0,0,0,0.12)" }} />
        {/* CHECK lines */}
        <Box sx={{ position: "absolute", left: checkNeg, top: 1, bottom: 1, width: "1px", background: "rgba(232,134,12,0.25)" }} />
        <Box sx={{ position: "absolute", left: checkPos, top: 1, bottom: 1, width: "1px", background: "rgba(232,134,12,0.25)" }} />
        {/* NG lines */}
        <Box sx={{ position: "absolute", left: ngNeg, top: 0, bottom: 0, width: "1px", background: "rgba(220,38,38,0.30)" }} />
        <Box sx={{ position: "absolute", left: ngPos, top: 0, bottom: 0, width: "1px", background: "rgba(220,38,38,0.30)" }} />
        {/* bar */}
        <Box sx={{ position: "absolute", top: 1, height: 6, left, width: barW, borderRadius: 3, background: color, opacity: 0.85 }} />
      </Box>
    </Stack>
  );
}

/**
 * 행(Row) 상태 판정: 모든 값 중 |max| 기준
 */
function getRowStatus(row) {
  const fields = ["조립치우침L", "조립치우침R", "상하치우침L", "상하치우침C", "상하치우침R", "타발홀L", "타발홀R"];
  let worst = 0;
  for (const f of fields) {
    const v = Math.abs(asNumber(row?.[f]) ?? 0);
    if (v > worst) worst = v;
  }
  if (worst >= NG_LIMIT) return "NG";
  if (worst >= CHECK) return "CHECK";
  return "OK";
}

const STATUS_BG = {
  NG:    STATUS_STYLES.NG.bg,
  CHECK: STATUS_STYLES.CHECK.bg,
  OK:    "transparent",
};

export default function RowMiniCard({ row, index }) {
  const rowNum = row?.Row ?? index + 1;
  const status = getRowStatus(row);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        background: STATUS_BG[status],
        borderColor: status === "NG" ? "rgba(220,38,38,0.3)" : status === "CHECK" ? "rgba(232,134,12,0.3)" : "rgba(0,0,0,0.08)",
      }}
    >
      <CardContent sx={{ py: 0.8, px: 1.2, "&:last-child": { pb: 0.8 } }}>
        <Stack spacing={0.3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{ fontWeight: 900, fontSize: 11 }}>
              Row {rowNum}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                fontSize: 9,
                color: status === "NG" ? COLOR_NG : status === "CHECK" ? COLOR_CHECK : "text.secondary",
              }}
            >
              {status}
            </Typography>
          </Stack>

          {/* X 미니바 */}
          <Box>
            <Typography variant="caption" sx={{ fontSize: 8, color: "text.secondary", fontWeight: 700 }}>X</Typography>
            <MiniBar value={row?.["조립치우침L"]} label="L" />
            <MiniBar value={row?.["조립치우침R"]} label="R" />
          </Box>

          {/* Y 미니바 */}
          <Box>
            <Typography variant="caption" sx={{ fontSize: 8, color: "text.secondary", fontWeight: 700 }}>Y</Typography>
            <MiniBar value={row?.["상하치우침L"]} label="L" />
            <MiniBar value={row?.["상하치우침C"]} label="C" />
            <MiniBar value={row?.["상하치우침R"]} label="R" />
          </Box>

          {/* Punch 미니바 */}
          <Box>
            <Typography variant="caption" sx={{ fontSize: 8, color: "text.secondary", fontWeight: 700 }}>P</Typography>
            <MiniBar value={row?.["타발홀L"]} label="L" />
            <MiniBar value={row?.["타발홀R"]} label="R" />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
