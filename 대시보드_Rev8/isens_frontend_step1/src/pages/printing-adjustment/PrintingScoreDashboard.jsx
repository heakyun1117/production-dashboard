import React from "react";
import { Box, Card, CardContent, Stack, Typography, Chip } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { CI_PRIMARY, CI_GREEN, COLOR_NG, COLOR_CHECK, STATUS_STYLES } from "../../components/shared/colors";
import { maxRadius, maxBox, trendWord, classifyPoint, POINTS } from "../../utils/printingOptimizationEngine";

const TREND_COLOR = { "개선": CI_GREEN, "악화": COLOR_NG, "동일": "#9CA3AF" };

// ── 상태 표시 헬퍼 (MUST → NG 매핑) ──
const displayStatus = (st) => st === "MUST" ? "NG" : st;

function chipStyle(st) {
  const key = st === "MUST" ? "NG" : st;
  return { bgcolor: STATUS_STYLES[key]?.bg, color: STATUS_STYLES[key]?.text };
}

function MetricRow({ label, before, after }) {
  const trend = trendWord(before, after);
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="caption" sx={{ width: 80, fontWeight: 600, color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
        {before.toFixed(3)}
      </Typography>
      <ArrowForwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
      <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
        {after.toFixed(3)}
      </Typography>
      <Chip
        size="small"
        label={trend}
        sx={{
          height: 18, fontSize: 10, fontWeight: 700,
          bgcolor: TREND_COLOR[trend] + "18",
          color: TREND_COLOR[trend],
        }}
      />
    </Stack>
  );
}

function PointStatusRow({ label, devsBefore, devsAfter, color }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Typography variant="caption" sx={{ width: 40, fontWeight: 700, color }}>
        {label}
      </Typography>
      {POINTS.map((pt) => {
        const bStatus = devsBefore ? classifyPoint(devsBefore[pt].x, devsBefore[pt].y) : "OK";
        const aStatus = devsAfter ? classifyPoint(devsAfter[pt].x, devsAfter[pt].y) : "OK";
        return (
          <Stack key={pt} alignItems="center" spacing={0} sx={{ mx: 0.3 }}>
            <Typography variant="caption" sx={{ fontSize: 8, color: "text.disabled" }}>P{pt}</Typography>
            <Stack direction="row" alignItems="center" spacing={0.3}>
              <Chip size="small" label={displayStatus(bStatus)}
                sx={{ height: 16, fontSize: 8, fontWeight: 700, ...chipStyle(bStatus) }} />
              <ArrowForwardIcon sx={{ fontSize: 8, color: "text.disabled" }} />
              <Chip size="small" label={displayStatus(aStatus)}
                sx={{ height: 16, fontSize: 8, fontWeight: 700, ...chipStyle(aStatus) }} />
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}

export default function PrintingScoreDashboard({ simResult, setMode, carbonRefDevs, diffAfter }) {
  if (!simResult) return null;

  const { carbonBefore, carbonAfter, insBefore, insAfter } = simResult;

  const bMaxR_C = maxRadius(carbonBefore);
  const aMaxR_C = maxRadius(carbonAfter);
  const bMaxR_I = maxRadius(insBefore);
  const aMaxR_I = maxRadius(insAfter);

  const bMaxB_C = maxBox(carbonBefore);
  const aMaxB_C = maxBox(carbonAfter);
  const bMaxB_I = maxBox(insBefore);
  const aMaxB_I = maxBox(insAfter);

  // G8: 카본기준 간섭 메트릭
  const hasDiff = !!(carbonRefDevs?.insulation && diffAfter);
  const bDiffR = hasDiff ? maxRadius(carbonRefDevs.insulation) : 0;
  const aDiffR = hasDiff ? maxRadius(diffAfter) : 0;
  const bDiffB = hasDiff ? maxBox(carbonRefDevs.insulation) : 0;
  const aDiffB = hasDiff ? maxBox(diffAfter) : 0;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" spacing={4} flexWrap="wrap">
          {/* 카본 메트릭 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#EC4899", mb: 0.5, display: "block" }}>
              카본 (Carbon)
            </Typography>
            <MetricRow label="maxR" before={bMaxR_C} after={aMaxR_C} />
            <MetricRow label="max|x|,|y|" before={bMaxB_C} after={aMaxB_C} />
            <PointStatusRow label="C" devsBefore={carbonBefore} devsAfter={carbonAfter} color="#EC4899" />
          </Box>

          {/* 절연 메트릭 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#22C55E", mb: 0.5, display: "block" }}>
              절연 (Insulation)
            </Typography>
            <MetricRow label="maxR" before={bMaxR_I} after={aMaxR_I} />
            <MetricRow label="max|x|,|y|" before={bMaxB_I} after={aMaxB_I} />
            <PointStatusRow label="I" devsBefore={insBefore} devsAfter={insAfter} color="#22C55E" />
          </Box>

          {/* G8: 카본기준 간섭 (C↔I) 메트릭 */}
          {hasDiff && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: CI_PRIMARY, mb: 0.5, display: "block" }}>
                카본기준 간섭 (C↔I)
              </Typography>
              <MetricRow label="maxR" before={bDiffR} after={aDiffR} />
              <MetricRow label="max|x|,|y|" before={bDiffB} after={aDiffB} />
            </Box>
          )}

          {/* SET 모드 표시 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: CI_PRIMARY, mb: 0.5, display: "block" }}>
              모드
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {setMode === "SET1" ? "SET1 - 타발 최적" :
               setMode === "SET2" ? "SET2 - 차이 최적 (절연)" :
               "SET3 - 차이 최적 (양쪽)"}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {setMode === "SET1" ? "카본/절연 각각 독립 펀치기준 최적화" :
               setMode === "SET2" ? "카본 고정, 절연만 조정하여 차이 최소화" :
               "카본+절연 동시 조정하여 차이 최소화"}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
