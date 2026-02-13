import React, { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import { fmt2, asText, asNumber } from "../../components/shared/fmt";
import StatusChip from "../../components/shared/StatusChip";
import BarCell from "../../components/shared/BarCell";
import { CI_PRIMARY, CARD_RADIUS } from "../../components/shared/colors";

/**
 * DetailHeader — 막대바 중심 헤더 카드 (Phase 1.5)
 *
 * Row 1: sheetKey(bold) | StatusChip | #Rank | Score뱃지
 * Row 2: 일자 · 라인 · Lot · 메모 (caption)
 * ─────────────────────────────────
 * Row 3: WorstX [===Primary Bar===] 방향 값 판정
 * Row 4: WorstY [===Primary Bar===] 방향 값 판정
 * Row 5: Punch  [===Primary Bar===] 방향 값 판정
 */
export default function DetailHeader({ detail, selected, jobId, rank }) {
  const root = detail ?? {};
  const d = root?.detail ?? root;
  const diagnosis = d?.diagnosis ?? {};

  const worstX = asNumber(diagnosis?.worstX?.value ?? diagnosis?.worstX) ?? asNumber(root?.worstX);
  const worstY = asNumber(diagnosis?.worstY?.value ?? diagnosis?.worstY) ?? asNumber(root?.worstY);
  const status = diagnosis?.sheetStatus ?? selected?.status ?? "-";
  const score = root?.qualityScore ?? selected?.qualityScore ?? diagnosis?.qualityScore;

  // Punch worst: rows에서 계산
  const allRows = useMemo(() => (Array.isArray(root?.rows) ? root.rows : []), [root]);
  const punchWorst = useMemo(() => {
    let worst = 0;
    let worstVal = 0;
    for (const r of allRows) {
      const pL = asNumber(r?.["타발홀L"]) ?? 0;
      const pR = asNumber(r?.["타발홀R"]) ?? 0;
      if (Math.abs(pL) > Math.abs(worst)) { worst = pL; worstVal = pL; }
      if (Math.abs(pR) > Math.abs(worst)) { worst = pR; worstVal = pR; }
    }
    return worstVal;
  }, [allRows]);

  // 메타
  const meta = selected?.meta ?? root?.meta ?? {};
  const metaParts = [];
  if (meta?.일자 || meta?.날짜) metaParts.push(asText(meta.일자 ?? meta.날짜));
  if (meta?.라인명) metaParts.push(`라인: ${asText(meta.라인명)}`);
  if (meta?.로트명) metaParts.push(`Lot: ${asText(meta.로트명)}`);
  if (meta?.메모) metaParts.push(asText(meta.메모));

  return (
    <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
      <CardContent sx={{ py: 1.5 }}>
        {/* Row 1: sheetKey + badges */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }} noWrap>
            {asText(selected?.sheetKey ?? root?.sheetKey ?? "시트")}
          </Typography>
          <StatusChip status={status} />
          {rank != null && (
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              #{rank}
            </Typography>
          )}
          <Chip
            size="small"
            label={`Score: ${fmt2(score)}`}
            sx={{ fontWeight: 700, background: `${CI_PRIMARY}0F`, color: CI_PRIMARY }}
          />
        </Stack>

        {/* Row 2: 메타 정보 */}
        {metaParts.length > 0 && (
          <Typography variant="caption" sx={{ color: "text.secondary", mb: 1, display: "block" }}>
            {metaParts.join(" · ")}
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Row 3-5: 축별 Primary Bar */}
        <Stack spacing={1.5}>
          {/* WorstX */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, width: 52, fontSize: 12, color: "text.secondary" }}
            >
              WorstX
            </Typography>
            {worstX != null ? (
              <BarCell value={worstX} axis="X" variant="large" />
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>-</Typography>
            )}
          </Stack>

          {/* WorstY */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, width: 52, fontSize: 12, color: "text.secondary" }}
            >
              WorstY
            </Typography>
            {worstY != null ? (
              <BarCell value={worstY} axis="Y" variant="large" />
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>-</Typography>
            )}
          </Stack>

          {/* Punch */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, width: 52, fontSize: 12, color: "text.secondary" }}
            >
              Punch
            </Typography>
            <BarCell value={punchWorst} axis="P" variant="large" />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
