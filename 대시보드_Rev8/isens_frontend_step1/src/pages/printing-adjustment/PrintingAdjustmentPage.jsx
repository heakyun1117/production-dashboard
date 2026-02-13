import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box, Button, Card, CardContent, CircularProgress, IconButton,
  Snackbar, Stack, Tooltip, Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

import useAppStore from "../../store/useAppStore";
import { getProcessData } from "../../api/margin";
import { getRecommendedOffsets } from "../../api/adjustment";
import WheelSlider from "../adjustment/WheelSlider";
import { CI_PRIMARY } from "../../components/shared/colors";
import {
  parse4PointData,
  isValid4Point,
  applyQXY,
  maxNormScore,
  maxRadius,
  maxBox,
  optimizeSET1,
  optimizeSET2,
  optimizeSET3,
  optimizeForAssemblyTarget,
  Q_SWEEP_DEFAULT,
  POINTS,
} from "../../utils/printingOptimizationEngine";

import SetModeSelector from "./SetModeSelector";
import PrintingScoreDashboard from "./PrintingScoreDashboard";
import FourPointVizPanel from "./FourPointVizPanel";
import RangeSettings from "./RangeSettings";

const CARD_RADIUS = 3;
const ZERO_OFFSETS = { q: 0, x: 0, y: 0 };

// 기본 이동 범위 (슬라이더 min/max = 최적화 제약)
const DEFAULT_RANGES = {
  carbon: { qMin: -0.10, qMax: 0.10, xMin: -0.20, xMax: 0.20, yMin: -0.20, yMax: 0.20 },
  ins:    { qMin: -0.10, qMax: 0.10, xMin: -0.20, xMax: 0.20, yMin: -0.20, yMax: 0.20 },
};

const sign3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const sign4 = (v) => (v >= 0 ? "+" : "") + v.toFixed(4);

// maxNormScore → 100점 만점 변환 (기존 조립 페이지와 통일)
const toScore100 = (normScore) => Math.max(0, (1 - normScore) * 100);
const fmtScore = (normScore) => toScore100(normScore).toFixed(1);

export default function PrintingAdjustmentPage() {
  const jobId = useAppStore((s) => s.jobId);
  const selectedSheetKey = useAppStore((s) => s.selectedSheetKey);

  // 데이터 로딩
  const [processData, setProcessData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 모드 & 오프셋
  const [setMode, setSetMode] = useState("SET1");
  const [carbonOffsets, setCarbonOffsets] = useState({ ...ZERO_OFFSETS });
  const [insOffsets, setInsOffsets] = useState({ ...ZERO_OFFSETS });
  const [snackMsg, setSnackMsg] = useState("");

  // G6: 조립 추천값
  const [assemblyRec, setAssemblyRec] = useState(null);

  // 이동 범위 제약 (슬라이더 범위 = 최적화 제약)
  const [ranges, setRanges] = useState(DEFAULT_RANGES);

  // ── 데이터 로딩 ──
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProcessData(jobId)
      .then((data) => {
        if (!cancelled) setProcessData(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "로딩 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [jobId]);

  // G6: 조립 추천값 로딩
  useEffect(() => {
    if (!jobId || !selectedSheetKey) { setAssemblyRec(null); return; }
    let cancelled = false;
    getRecommendedOffsets(jobId, selectedSheetKey, true)
      .then((rec) => { if (!cancelled) setAssemblyRec(rec); })
      .catch(() => { if (!cancelled) setAssemblyRec(null); });
    return () => { cancelled = true; };
  }, [jobId, selectedSheetKey]);

  // ── 4포인트 파싱 (타발기준) ──
  const originalDevs = useMemo(() => {
    if (!processData?.printingCalc) return null;
    const parsed = parse4PointData(processData.printingCalc, "타발기준");
    if (!isValid4Point(parsed.carbon) || !isValid4Point(parsed.insulation)) return null;
    return parsed;
  }, [processData]);

  // G8: 카본기준 파싱 (카본 대비 절연 간섭)
  const carbonRefDevs = useMemo(() => {
    if (!processData?.printingCalc) return null;
    const parsed = parse4PointData(processData.printingCalc, "카본기준");
    if (!isValid4Point(parsed.insulation)) return null;
    return parsed;
  }, [processData]);

  // ── 추천값 계산 (범위 제약 적용) ──
  const recommended = useMemo(() => {
    if (!originalDevs) return null;
    try {
      const cc = ranges.carbon;
      const ic = ranges.ins;
      switch (setMode) {
        case "SET1": return optimizeSET1(originalDevs.carbon, originalDevs.insulation, cc, ic);
        case "SET2": return optimizeSET2(originalDevs.carbon, originalDevs.insulation, cc, ic);
        case "SET3": return optimizeSET3(originalDevs.carbon, originalDevs.insulation, cc, ic);
        default: return null;
      }
    } catch {
      return null;
    }
  }, [originalDevs, setMode, ranges]);

  // ── 실시간 시뮬레이션 ──
  const simResult = useMemo(() => {
    if (!originalDevs) return null;
    const carbonAfter = applyQXY(
      originalDevs.carbon, carbonOffsets.q, carbonOffsets.x, carbonOffsets.y,
      Q_SWEEP_DEFAULT.carbon
    );
    const insAfter = applyQXY(
      originalDevs.insulation, insOffsets.q, insOffsets.x, insOffsets.y,
      Q_SWEEP_DEFAULT.ins
    );
    return {
      carbonBefore: originalDevs.carbon,
      carbonAfter,
      insBefore: originalDevs.insulation,
      insAfter,
      carbonScore: { before: maxNormScore(originalDevs.carbon), after: maxNormScore(carbonAfter) },
      insScore: { before: maxNormScore(originalDevs.insulation), after: maxNormScore(insAfter) },
    };
  }, [originalDevs, carbonOffsets, insOffsets]);

  // G8: 간섭 차이 after (ins - carbon after simulation)
  const diffAfter = useMemo(() => {
    if (!simResult) return null;
    const diff = {};
    for (const pt of POINTS) {
      diff[pt] = {
        x: simResult.insAfter[pt].x - simResult.carbonAfter[pt].x,
        y: simResult.insAfter[pt].y - simResult.carbonAfter[pt].y,
      };
    }
    return diff;
  }, [simResult]);

  // G6: 조립 추천 단순 적용 시뮬레이션
  const assemblySimResult = useMemo(() => {
    if (!originalDevs || !assemblyRec) return null;
    const ax = assemblyRec.printing_x ?? 0;
    const ay = assemblyRec.printing_y ?? 0;
    const carbonAssembly = applyQXY(originalDevs.carbon, 0, ax, ay, Q_SWEEP_DEFAULT.carbon);
    const insAssembly = applyQXY(originalDevs.insulation, 0, ax, ay, Q_SWEEP_DEFAULT.ins);
    return {
      carbonAssembly,
      insAssembly,
      carbonScore: maxNormScore(carbonAssembly),
      insScore: maxNormScore(insAssembly),
      printingX: ax,
      printingY: ay,
    };
  }, [originalDevs, assemblyRec]);

  // G6-ext: 조립 추천 기반 최적화 (제약 + 자유)
  const assemblyOptResult = useMemo(() => {
    if (!originalDevs || !assemblyRec) return null;
    const ax = assemblyRec.printing_x ?? 0;
    const ay = assemblyRec.printing_y ?? 0;
    try {
      return optimizeForAssemblyTarget(originalDevs.carbon, originalDevs.insulation, ax, ay,
        ranges.carbon, ranges.ins);
    } catch {
      return null;
    }
  }, [originalDevs, assemblyRec, ranges]);

  // ── 추천값 적용 ──
  const applyRecommended = useCallback(() => {
    if (!recommended) return;
    setCarbonOffsets({
      q: Math.round(recommended.carbon.q * 10000) / 10000,
      x: Math.round(recommended.carbon.x * 1000) / 1000,
      y: Math.round(recommended.carbon.y * 1000) / 1000,
    });
    setInsOffsets({
      q: Math.round(recommended.ins.q * 10000) / 10000,
      x: Math.round(recommended.ins.x * 1000) / 1000,
      y: Math.round(recommended.ins.y * 1000) / 1000,
    });
    setSnackMsg("추천값이 적용되었습니다");
  }, [recommended]);

  // ── 범위 변경 시 현재 오프셋 clamp ──
  useEffect(() => {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    setCarbonOffsets((prev) => ({
      q: clamp(prev.q, ranges.carbon.qMin, ranges.carbon.qMax),
      x: clamp(prev.x, ranges.carbon.xMin, ranges.carbon.xMax),
      y: clamp(prev.y, ranges.carbon.yMin, ranges.carbon.yMax),
    }));
    setInsOffsets((prev) => ({
      q: clamp(prev.q, ranges.ins.qMin, ranges.ins.qMax),
      x: clamp(prev.x, ranges.ins.xMin, ranges.ins.xMax),
      y: clamp(prev.y, ranges.ins.yMin, ranges.ins.yMax),
    }));
  }, [ranges]);

  // ── 초기화 ──
  const resetAll = useCallback(() => {
    setCarbonOffsets({ ...ZERO_OFFSETS });
    setInsOffsets({ ...ZERO_OFFSETS });
    setSnackMsg("초기화되었습니다");
  }, []);

  // ── 클립보드 복사 (G5: 방향 용어) ──
  const copyToClipboard = useCallback(() => {
    const modeLabel = setMode === "SET1" ? "SET1 - 타발 최적" :
      setMode === "SET2" ? "SET2 - 차이 최적 (절연)" : "SET3 - 차이 최적 (양쪽)";
    const lines = [
      `[프린팅 위치 조정] ${modeLabel}`,
      "",
      `카본 (Carbon):`,
      `  Q (시계방향): ${sign4(carbonOffsets.q)}`,
      `  좌우: ${sign3(carbonOffsets.x)}`,
      `  상하: ${sign3(carbonOffsets.y)}`,
      "",
      `절연 (Insulation):`,
      `  Q (시계방향): ${sign4(insOffsets.q)}`,
      `  좌우: ${sign3(insOffsets.x)}`,
      `  상하: ${sign3(insOffsets.y)}`,
    ];
    if (simResult) {
      lines.push("");
      lines.push(`Score: 카본 ${fmtScore(simResult.carbonScore.before)} → ${fmtScore(simResult.carbonScore.after)} | 절연 ${fmtScore(simResult.insScore.before)} → ${fmtScore(simResult.insScore.after)}`);
    }
    // G6: 조립 추천 정보 추가
    if (assemblySimResult) {
      lines.push("");
      lines.push(`[조립 추천 프린팅 이동]`);
      lines.push(`  좌우(절연이동): ${sign3(assemblySimResult.printingX)} / 상하(카본이동): ${sign3(assemblySimResult.printingY)}`);
    }
    if (assemblyOptResult) {
      const c = assemblyOptResult.constrained;
      const f = assemblyOptResult.free;
      lines.push(`  Q 최적화 (좌우/상하 고정):`);
      lines.push(`    카본: Q(시계방향) ${sign4(c.carbon.q)}`);
      lines.push(`    절연: Q(시계방향) ${sign4(c.ins.q)}`);
      lines.push(`  자유 최적화 (Q/좌우/상하 전부):`);
      lines.push(`    카본: Q ${sign4(f.carbon.q)} / 좌우 ${sign3(f.carbon.x)} / 상하 ${sign3(f.carbon.y)}`);
      lines.push(`    절연: Q ${sign4(f.ins.q)} / 좌우 ${sign3(f.ins.x)} / 상하 ${sign3(f.ins.y)}`);
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setSnackMsg("보정값이 클립보드에 복사되었습니다");
  }, [setMode, carbonOffsets, insOffsets, simResult, assemblySimResult, assemblyOptResult]);

  // ── 오프셋 핸들러 ──
  const handleCarbonChange = useCallback((key) => (v) => {
    setCarbonOffsets((prev) => ({ ...prev, [key]: v }));
  }, []);

  const handleInsChange = useCallback((key) => (v) => {
    setInsOffsets((prev) => ({ ...prev, [key]: v }));
  }, []);

  // SET2에서 카본 비활성화
  const carbonDisabled = setMode === "SET2";

  // ── 렌더 ──
  if (!jobId) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 2 }}>
        <PrintIcon sx={{ fontSize: 64, color: CI_PRIMARY, opacity: 0.3 }} />
        <Typography variant="h6" sx={{ color: "text.secondary" }}>CSV를 먼저 업로드하세요</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>프린팅 데이터 불러오는 중...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 2 }}>
        <Typography variant="h6" color="error">{error}</Typography>
      </Box>
    );
  }

  if (!originalDevs) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 2 }}>
        <PrintIcon sx={{ fontSize: 64, color: CI_PRIMARY, opacity: 0.3 }} />
        <Typography variant="h6" sx={{ color: "text.secondary" }}>프린팅 데이터 업로드 필요</Typography>
        <Typography variant="body2" sx={{ color: "text.disabled" }}>
          Margin 탭에서 프린팅 CSV를 먼저 업로드해주세요
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", pb: 3 }}>
      {/* ── 헤더 ── */}
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <PrintIcon sx={{ mr: 1, color: CI_PRIMARY }} />
        <Typography variant="h6" sx={{ fontWeight: 900, color: CI_PRIMARY }}>
          프린팅 위치 조정
        </Typography>

        <SetModeSelector mode={setMode} onChange={(m) => {
          setSetMode(m);
          resetAll();
        }} />

        <Box sx={{ flex: 1 }} />

        <Tooltip title="추천값 적용" arrow>
          <Button
            variant="contained"
            size="small"
            startIcon={<AutoFixHighIcon />}
            onClick={applyRecommended}
            disabled={!recommended}
            sx={{ mr: 1 }}
          >
            추천값 적용
          </Button>
        </Tooltip>

        <Tooltip title="초기화" arrow>
          <IconButton size="small" onClick={resetAll} sx={{ mr: 1 }}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="클립보드 복사" arrow>
          <IconButton size="small" onClick={copyToClipboard}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ── 점수 대시보드 (G8: carbonRefDevs, diffAfter 전달) ── */}
      <PrintingScoreDashboard
        simResult={simResult}
        setMode={setMode}
        carbonRefDevs={carbonRefDevs}
        diffAfter={diffAfter}
      />

      {/* ── 메인 영역: 슬라이더 + 시각화 ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: 2 }}>
        {/* 좌측: 슬라이더 */}
        <Stack spacing={2}>
          {/* 카본 슬라이더 */}
          <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS, opacity: carbonDisabled ? 0.5 : 1 }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#EC4899", mb: 0.5 }}>
                카본 (Carbon)
              </Typography>
              <RangeSettings
                ranges={ranges.carbon}
                onChange={(updated) => setRanges((prev) => ({ ...prev, carbon: updated }))}
              />
              <Stack spacing={1}>
                <WheelSlider
                  label="Q (시계방향 +)"
                  value={carbonOffsets.q}
                  onChange={handleCarbonChange("q")}
                  min={ranges.carbon.qMin}
                  max={ranges.carbon.qMax}
                  step={0.0001}
                  wheelStep={0.0001}
                  precision={4}
                  recommended={recommended?.carbon?.q}
                  disabled={carbonDisabled}
                />
                <WheelSlider
                  label="좌우 (X)"
                  value={carbonOffsets.x}
                  onChange={handleCarbonChange("x")}
                  min={ranges.carbon.xMin}
                  max={ranges.carbon.xMax}
                  step={0.001}
                  wheelStep={0.001}
                  recommended={recommended?.carbon?.x}
                  disabled={carbonDisabled}
                />
                <WheelSlider
                  label="상하 (Y)"
                  value={carbonOffsets.y}
                  onChange={handleCarbonChange("y")}
                  min={ranges.carbon.yMin}
                  max={ranges.carbon.yMax}
                  step={0.001}
                  wheelStep={0.001}
                  recommended={recommended?.carbon?.y}
                  disabled={carbonDisabled}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* 절연 슬라이더 (G5: 방향 용어) */}
          <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#22C55E", mb: 0.5 }}>
                절연 (Insulation)
              </Typography>
              <RangeSettings
                ranges={ranges.ins}
                onChange={(updated) => setRanges((prev) => ({ ...prev, ins: updated }))}
              />
              <Stack spacing={1}>
                <WheelSlider
                  label="Q (시계방향 +)"
                  value={insOffsets.q}
                  onChange={handleInsChange("q")}
                  min={ranges.ins.qMin}
                  max={ranges.ins.qMax}
                  step={0.0001}
                  wheelStep={0.0001}
                  precision={4}
                  recommended={recommended?.ins?.q}
                />
                <WheelSlider
                  label="좌우 (X)"
                  value={insOffsets.x}
                  onChange={handleInsChange("x")}
                  min={ranges.ins.xMin}
                  max={ranges.ins.xMax}
                  step={0.001}
                  wheelStep={0.001}
                  recommended={recommended?.ins?.x}
                />
                <WheelSlider
                  label="상하 (Y)"
                  value={insOffsets.y}
                  onChange={handleInsChange("y")}
                  min={ranges.ins.yMin}
                  max={ranges.ins.yMax}
                  step={0.001}
                  wheelStep={0.001}
                  recommended={recommended?.ins?.y}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* 추천값 카드 (G5: 방향 용어) */}
          {recommended && (
            <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS, bgcolor: "#F8FAFC" }}>
              <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.5 }}>
                  추천 보정값
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", color: "#EC4899" }}>
                  카본: Q(시계방향) {sign4(recommended.carbon.q)} / 좌우 {sign3(recommended.carbon.x)} / 상하 {sign3(recommended.carbon.y)}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", color: "#22C55E" }}>
                  절연: Q(시계방향) {sign4(recommended.ins.q)} / 좌우 {sign3(recommended.ins.x)} / 상하 {sign3(recommended.ins.y)}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* G6: 조립 추천 프린팅 이동 카드 */}
          {assemblySimResult && (
            <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS, bgcolor: "#EFF6FF" }}>
              <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: CI_PRIMARY, display: "block", mb: 0.5 }}>
                  조립 추천 프린팅 이동
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block" }}>
                  좌우(절연이동): {sign3(assemblySimResult.printingX)} / 상하(카본이동): {sign3(assemblySimResult.printingY)}
                </Typography>

                {/* G6-ext: 제약 최적화 (X/Y 고정, Q 최적화) */}
                {assemblyOptResult && (
                  <>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#6366F1", display: "block", mt: 0.5 }}>
                      Q 최적화 (좌우/상하 고정):
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", color: "#6366F1", fontSize: 10 }}>
                      카본 Q(시계) {sign4(assemblyOptResult.constrained.carbon.q)}
                      {" | "}절연 Q(시계) {sign4(assemblyOptResult.constrained.ins.q)}
                    </Typography>

                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#8B5CF6", display: "block", mt: 0.3 }}>
                      자유 최적화 (Q/좌우/상하 전부):
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", color: "#8B5CF6", fontSize: 10 }}>
                      카본 Q {sign4(assemblyOptResult.free.carbon.q)} / 좌우 {sign3(assemblyOptResult.free.carbon.x)} / 상하 {sign3(assemblyOptResult.free.carbon.y)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", color: "#8B5CF6", fontSize: 10 }}>
                      절연 Q {sign4(assemblyOptResult.free.ins.q)} / 좌우 {sign3(assemblyOptResult.free.ins.x)} / 상하 {sign3(assemblyOptResult.free.ins.y)}
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </Stack>

        {/* 우측: 4포인트 시각화 (G6: 조립 추천 데이터 전달) */}
        <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
          <CardContent>
            {simResult && (
              <FourPointVizPanel
                carbonBefore={simResult.carbonBefore}
                carbonAfter={simResult.carbonAfter}
                insBefore={simResult.insBefore}
                insAfter={simResult.insAfter}
                carbonAssembly={assemblySimResult?.carbonAssembly}
                insAssembly={assemblySimResult?.insAssembly}
                carbonAssemblyOpt={assemblyOptResult?.constrained?.carbon?.after}
                insAssemblyOpt={assemblyOptResult?.constrained?.ins?.after}
              />
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ── 푸터 바: 현재 보정값 요약 (G5: 방향 용어) ── */}
      <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS, mt: 2, bgcolor: "#F8FAFC" }}>
        <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 600, color: "#EC4899" }}>
              카본: Q(시계) {sign4(carbonOffsets.q)} / 좌우 {sign3(carbonOffsets.x)} / 상하 {sign3(carbonOffsets.y)}
              {simResult && ` / Score ${fmtScore(simResult.carbonScore.after)}`}
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 600, color: "#22C55E" }}>
              절연: Q(시계) {sign4(insOffsets.q)} / 좌우 {sign3(insOffsets.x)} / 상하 {sign3(insOffsets.y)}
              {simResult && ` / Score ${fmtScore(simResult.insScore.after)}`}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Snackbar */}
      <Snackbar
        open={!!snackMsg}
        autoHideDuration={2000}
        onClose={() => setSnackMsg("")}
        message={snackMsg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
