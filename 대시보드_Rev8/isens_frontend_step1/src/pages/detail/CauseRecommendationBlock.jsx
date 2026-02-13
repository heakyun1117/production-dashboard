import React, { useMemo } from "react";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

import { asText } from "../../components/shared/fmt";
import { generateRecommendation, CAUSE_MAP } from "../../utils/diagnosisHelpers";
import useAppStore from "../../store/useAppStore";
import useThresholdStore from "../../store/useThresholdStore";
import { STATUS_STYLES, CI_PRIMARY, CI_GRAY } from "../../components/shared/colors";

// 원인태그 색상
const TAG_COLORS = {
  X_NG:        { bg: STATUS_STYLES.NG.bg,    color: STATUS_STYLES.NG.text },
  Y_NG:        { bg: STATUS_STYLES.NG.bg,    color: STATUS_STYLES.NG.text },
  PUNCH_NG:    { bg: STATUS_STYLES.NG.bg,    color: STATUS_STYLES.NG.text },
  X_CHECK:     { bg: STATUS_STYLES.CHECK.bg, color: STATUS_STYLES.CHECK.text },
  Y_CHECK:     { bg: STATUS_STYLES.CHECK.bg, color: STATUS_STYLES.CHECK.text },
  PUNCH_CHECK: { bg: STATUS_STYLES.CHECK.bg, color: STATUS_STYLES.CHECK.text },
  C_ASYM:      { bg: "#E8E8F4",              color: CI_PRIMARY },
  TILT:        { bg: "#E8E8F4",              color: CI_PRIMARY },
  BOW:         { bg: "#E8E8F4",              color: CI_PRIMARY },
};
const DEFAULT_TAG = { bg: `${CI_GRAY}14`, color: CI_GRAY };

/**
 * CauseRecommendationBlock — 원인태그 + 조정추천 + 근거Row (항상 노출, 아코디언 아님)
 */
export default function CauseRecommendationBlock({ detail }) {
  const setHighlightedRowId = useAppStore((s) => s.setHighlightedRowId);
  const storeT = useThresholdStore((s) => s.thresholds.assembly);

  const root = detail ?? {};
  const d = root?.detail ?? root;
  const diagnosis = d?.diagnosis ?? {};
  const rows = useMemo(() => (Array.isArray(root?.rows) ? root.rows : []), [root]);

  const { causeTags, recommendation, evidenceRows } = useMemo(
    () => generateRecommendation(diagnosis, rows, storeT),
    [diagnosis, rows, storeT]
  );

  if (!detail) return null;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={1.5}>
          {/* 원인 태그 */}
          {causeTags.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", mb: 0.5, display: "block" }}>
                원인 태그
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                {causeTags.map((tag, i) => {
                  const colors = TAG_COLORS[tag] ?? DEFAULT_TAG;
                  return (
                    <Chip
                      key={`${tag}-${i}`}
                      size="small"
                      label={CAUSE_MAP[tag] ?? tag}
                      sx={{
                        background: colors.bg,
                        color: colors.color,
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* 조정 추천 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", mb: 0.3, display: "block" }}>
              조정 추천
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>
              {recommendation}
            </Typography>
          </Box>

          {/* 근거 Row */}
          {evidenceRows.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", mb: 0.5, display: "block" }}>
                근거 Row
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                {evidenceRows.map((ev, i) => (
                  <Chip
                    key={`ev-${ev.rowId}-${ev.axis}-${i}`}
                    size="small"
                    label={`Row ${ev.rowId} · ${ev.axis}-${ev.side}`}
                    onClick={() => setHighlightedRowId(ev.rowId)}
                    sx={{
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 11,
                      background: "rgba(23,28,143,0.06)",
                      color: CI_PRIMARY,
                      "&:hover": { background: "rgba(23,28,143,0.12)" },
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* 요약 텍스트 (기존 diagnosis.summary) */}
          {diagnosis?.summary && (
            <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>
              {asText(diagnosis.summary)}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
