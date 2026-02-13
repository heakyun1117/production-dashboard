import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import useAppStore from "../../store/useAppStore";
import useThresholdStore from "../../store/useThresholdStore";
import { getSheetDetail } from "../../api/step1";
import { simulateAll } from "../../utils/simulationEngine";
import { CARD_RADIUS, BORDER_LIGHT, CI_PRIMARY } from "../../components/shared/colors";
import SignedLineChart from "./SignedLineChart";
import GroupedVerticalBarChart from "./GroupedVerticalBarChart";

/**
 * ChartDraftPage — 그래프 시안 비교 페이지
 * 탭으로 전환하여 2가지 시안을 비교
 *   탭 A: 범위밴드 선 차트 (SignedLineChart)
 *   탭 B: L/C/R 그룹 세로 막대 (GroupedVerticalBarChart)
 */

const ZERO_OFFSETS = {
  printing_x: 0,
  printing_y: 0,
  slitter_y: Array(12).fill(0),
  assembly_x: Array(12).fill(0),
  assembly_y: Array(12).fill(0),
};

export default function ChartDraftPage() {
  const { sheetKey: paramKey } = useParams();
  const jobId = useAppStore((s) => s.jobId);
  const storeKey = useAppStore((s) => s.selectedSheetKey);
  const sheetKey = paramKey || storeKey;
  const storeT = useThresholdStore((s) => s.thresholds.assembly);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);

  /* 데이터 로드 */
  useEffect(() => {
    if (!jobId || !sheetKey) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const detail = await getSheetDetail(jobId, sheetKey);
        if (!cancelled) setRows(detail?.rows ?? []);
      } catch (e) { console.error("ChartDraft load failed:", e); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [jobId, sheetKey]);

  /* 시뮬레이션 (offsets = 0, Before 데이터만) */
  const simResult = useMemo(
    () => simulateAll(rows, ZERO_OFFSETS, storeT),
    [rows, storeT],
  );

  const perRow = simResult?.perRow || [];
  const modeLabel = "시안 비교";

  if (!jobId || !sheetKey) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          시트를 먼저 선택해주세요 (Explorer 또는 Adjustment 탭에서)
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">로딩 중...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
        그래프 시안 비교
      </Typography>

      <Paper variant="outlined"
        sx={{ p: 2, borderRadius: CARD_RADIUS, border: `1px solid ${BORDER_LIGHT}` }}>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 36, mb: 2,
            "& .MuiTab-root": {
              minHeight: 36, fontSize: 13, fontWeight: 700,
              textTransform: "none", py: 0.5, px: 2,
            },
          }}
          TabIndicatorProps={{ sx: { bgcolor: CI_PRIMARY, height: 2.5 } }}
        >
          <Tab label="범위밴드 선 차트" />
          <Tab label="L/C/R 세로 막대" />
        </Tabs>

        {perRow.length > 0 ? (
          <>
            {tab === 0 && (
              <Stack spacing={2}>
                <SignedLineChart perRow={perRow} axis="x" modeLabel={modeLabel} />
                <SignedLineChart perRow={perRow} axis="y" modeLabel={modeLabel} />
              </Stack>
            )}
            {tab === 1 && (
              <Stack spacing={2}>
                <GroupedVerticalBarChart perRow={perRow} axis="x" />
                <GroupedVerticalBarChart perRow={perRow} axis="y" />
              </Stack>
            )}
          </>
        ) : (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            데이터가 없습니다
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
