import React from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import BulletGauge from "../../components/shared/BulletGauge";
import {
  CI_GREEN,
  COLOR_NG,
  COLOR_CHECK,
  CARD_RADIUS,
  BORDER_LIGHT,
} from "../../components/shared/colors";

const fmt3 = (v) => (v == null || !Number.isFinite(v) ? "-" : v.toFixed(3));
const fmt2 = (v) => (v == null || !Number.isFinite(v) ? "-" : v.toFixed(2));

/**
 * 값 변화 표시 (현재 → 보정후)
 */
function ValueTransition({ label, before, after }) {
  const improved = (after ?? 0) < (before ?? 0);
  const worse = (after ?? 0) > (before ?? 0);
  const arrowColor = improved ? CI_GREEN : worse ? COLOR_NG : "text.secondary";

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", width: 52 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontFamily: "monospace",
          color: "text.secondary",
          fontSize: 13,
        }}
      >
        {fmt3(before)}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          color: arrowColor,
          fontSize: 14,
        }}
      >
        →
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          fontFamily: "monospace",
          color: improved ? CI_GREEN : worse ? COLOR_NG : "text.primary",
          fontSize: 13,
        }}
      >
        {fmt3(after)} mm
      </Typography>
      {improved && (
        <Typography variant="caption" sx={{ fontWeight: 700, color: CI_GREEN }}>
          ▼{fmt3(Math.abs((before ?? 0) - (after ?? 0)))}
        </Typography>
      )}
      {worse && (
        <Typography variant="caption" sx={{ fontWeight: 700, color: COLOR_NG }}>
          ▲{fmt3(Math.abs((after ?? 0) - (before ?? 0)))}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * 이동 가능 마진 표시
 */
function MarginBudget({ label, marginMm, zone }) {
  const zoneColor =
    zone === "ng" ? COLOR_NG : zone === "check" ? COLOR_CHECK : CI_GREEN;
  const zoneLabel = zone === "ng" ? "NG" : zone === "check" ? "CHECK" : "OK";

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontSize: 11 }}
      >
        이동가능:
      </Typography>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontFamily: "monospace",
          color: zoneColor,
          fontSize: 12,
        }}
      >
        {marginMm != null ? `±${fmt2(marginMm)} mm` : "- mm"}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
        ({label})
      </Typography>
    </Stack>
  );
}

/**
 * DeviationSummaryCard — 현재 편차 + 이동 가능 마진 표시
 *
 * - BulletGauge 로 현재 편차 시각화 (OK/CHECK/NG 3-zone)
 * - 현재 → 보정후 값 변화 표시
 * - 이동 가능 마진 (프린팅 절연/카본 기준)
 *
 * @param {Object} simResult   - { before: { worstX, worstY }, after: { worstX, worstY } }
 * @param {Object} marginData  - 마진 API 응답 (null 허용)
 */
export default function DeviationSummaryCard({ simResult, marginData }) {
  const before = simResult?.before;
  const after = simResult?.after;

  // 마진 데이터에서 이동 가능 범위 추출
  const marginX = marginData?.assembly?.x?.margin_mm ?? null;
  const marginY = marginData?.assembly?.y?.margin_mm ?? null;
  const zoneX = marginData?.assembly?.x?.zone ?? "normal";
  const zoneY = marginData?.assembly?.y?.zone ?? "normal";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: CARD_RADIUS,
        border: `1px solid ${BORDER_LIGHT}`,
        background: "linear-gradient(135deg, #fafbff 0%, #f5f7ff 100%)",
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        현재 편차 & 이동 가능 마진
      </Typography>

      <Stack spacing={2}>
        {/* X(좌우) */}
        <Box>
          <ValueTransition
            label="X(좌우)"
            before={before?.worstX}
            after={after?.worstX}
          />
          <Box sx={{ mt: 0.5 }}>
            <BulletGauge
              value={after?.worstX ?? 0}
              label="보정후 X"
              ngLimit={0.15}
              checkLimit={0.10}
              max={0.20}
              height={24}
            />
          </Box>
          <Box sx={{ mt: 0.5, pl: 0.5 }}>
            <MarginBudget
              label="프린팅 절연 기준"
              marginMm={marginX}
              zone={zoneX}
            />
          </Box>
        </Box>

        {/* Y(상하) */}
        <Box>
          <ValueTransition
            label="Y(상하)"
            before={before?.worstY}
            after={after?.worstY}
          />
          <Box sx={{ mt: 0.5 }}>
            <BulletGauge
              value={after?.worstY ?? 0}
              label="보정후 Y"
              ngLimit={0.15}
              checkLimit={0.10}
              max={0.20}
              height={24}
            />
          </Box>
          <Box sx={{ mt: 0.5, pl: 0.5 }}>
            <MarginBudget
              label="프린팅 카본 기준"
              marginMm={marginY}
              zone={zoneY}
            />
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}
