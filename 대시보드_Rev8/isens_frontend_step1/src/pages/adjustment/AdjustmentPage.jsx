import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Button, Chip, CircularProgress, Divider, IconButton,
  Paper, Snackbar, Stack, Switch, Tooltip, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TuneIcon from "@mui/icons-material/Tune";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import BuildIcon from "@mui/icons-material/Build";

import useAppStore from "../../store/useAppStore";
import useThresholdStore from "../../store/useThresholdStore";
import { getSheetDetail } from "../../api/step1";
import { getRecommendedOffsets } from "../../api/adjustment";
import { getProcessData } from "../../api/margin";
import { simulateAll, computeAllRecommended } from "../../utils/simulationEngine";
import WheelSlider from "./WheelSlider";
import BeforeAfterChart from "./BeforeAfterChart";
import {
  CI_PRIMARY, CI_GREEN, COLOR_NG, COLOR_CHECK,
  STATUS_STYLES, CARD_RADIUS, BORDER_LIGHT, TRACK_BG,
} from "../../components/shared/colors";

const fmt3 = (v) => (v == null || !Number.isFinite(v) ? "-" : v.toFixed(3));
const fmt2 = (v) => (v == null || !Number.isFinite(v) ? "-" : v.toFixed(2));
const fmt1 = (v) => (v == null || !Number.isFinite(v) ? "-" : v.toFixed(1));
const sign3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const sign2 = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);

const ZERO_OFFSETS = {
  printing_x: 0, printing_y: 0,
  slitter_y: Array(12).fill(0),
  assembly_x: Array(12).fill(0),
  assembly_y: Array(12).fill(0),
};

// ── 적용 모드 상수 ──
const MODE = {
  MANUAL: "사용자 수동 조정",
  ALL_REC: "절연+슬리터+조립기 추천값 적용",
  GLOBAL_REC: "전역 보정 추천값 적용",
  ASSEMBLY_REC: "조립기 추천값 적용",
  ASSEMBLY_STANDALONE: "조립기 단독 추천값 적용",
};

function statusBg(st) { return STATUS_STYLES[st === "MUST" ? "NG" : st]?.bg ?? STATUS_STYLES.OK.bg; }
function statusText(st) { return STATUS_STYLES[st === "MUST" ? "NG" : st]?.text ?? STATUS_STYLES.OK.text; }
function scoreColor(s) { return s >= 80 ? CI_GREEN : s >= 40 ? COLOR_CHECK : COLOR_NG; }

// ═══════════════════════════════════════════════════════════════
function ScoreDashboard({ before, after, marginInfo, offsets }) {
  const delta = (after?.score ?? 0) - (before?.score ?? 0);
  const improved = delta > 0;
  return (
    <Paper variant="outlined" sx={{
      p: 2, borderRadius: CARD_RADIUS,
      background: "linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)",
      border: `1px solid ${BORDER_LIGHT}`,
    }}>
      <Stack direction="row" alignItems="stretch" spacing={2} flexWrap="wrap">
        <Box sx={{ flex: 6, minWidth: 300 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            {[{ label: "BEFORE", data: before }, { label: "AFTER", data: after }].map((item, idx) => (
              <React.Fragment key={item.label}>
                {idx === 1 && (
                  <Box sx={{ textAlign: "center", px: 0.5 }}>
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: improved ? CI_GREEN : delta < 0 ? COLOR_NG : "text.disabled" }}>
                      {delta > 0 ? "▶" : delta < 0 ? "◀" : "━"}
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, color: improved ? CI_GREEN : delta < 0 ? COLOR_NG : "text.disabled" }}>
                      {delta > 0 ? "+" : ""}{fmt1(delta)}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ textAlign: "center", minWidth: 80 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{item.label}</Typography>
                  <Typography sx={{ fontSize: 32, fontWeight: 900, color: scoreColor(item.data?.score ?? 0), lineHeight: 1.1 }}>
                    {fmt1(item.data?.score)}
                  </Typography>
                  <Chip label={item.data?.status === "MUST" ? "NG" : (item.data?.status ?? "-")} size="small"
                    sx={{ mt: 0.3, fontWeight: 700, bgcolor: statusBg(item.data?.status), color: statusText(item.data?.status) }} />
                </Box>
              </React.Fragment>
            ))}
          </Stack>
          <Box sx={{ mt: 1 }}>
            {["Before", "After"].map((l) => {
              const v = l === "Before" ? (before?.score ?? 0) : (after?.score ?? 0);
              return (
                <Stack key={l} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.3 }}>
                  <Typography variant="caption" sx={{ width: 36, fontWeight: 600, color: "text.secondary", fontSize: 11 }}>{l}</Typography>
                  <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: TRACK_BG, overflow: "hidden" }}>
                    <Box sx={{ width: `${Math.min(100, Math.max(0, v))}%`, height: "100%", borderRadius: 4, bgcolor: scoreColor(v), transition: "width 0.4s ease" }} />
                  </Box>
                  <Typography variant="caption" sx={{ width: 28, fontWeight: 700, color: scoreColor(v), fontSize: 11 }}>{fmt1(v)}</Typography>
                </Stack>
              );
            })}
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* 공정별 이동 가능 거리 */}
        <Box sx={{ flex: 4, minWidth: 240 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", mb: 0.5, display: "block" }}>
            공정별 이동 가능 거리 (마진)
          </Typography>
          <MarginRow label="절연 X" used={Math.abs(offsets.printing_x)} total={marginInfo?.insulation_x} />
          <MarginRow label="카본 Y" used={Math.abs(offsets.printing_y)} total={marginInfo?.carbon_y} />
          <MarginRow label="슬리터 Y" used={Math.max(...offsets.slitter_y.map(Math.abs))} total={marginInfo?.slitter_y} />
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 9, mt: 0.5, display: "block" }}>
            사용량 = 슬라이더 이동 거리 · 잔여 = 최소마진 - 사용량
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function MarginRow({ label, used, total }) {
  const available = total != null ? Math.max(0, total - used) : null;
  const overMargin = total != null && used > total;
  const color = overMargin ? COLOR_NG : available != null && available < 0.03 ? COLOR_CHECK : CI_GREEN;
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.3 }}>
      <Typography variant="caption" sx={{ width: 52, fontWeight: 700, color: "text.secondary", flexShrink: 0, fontSize: 11 }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: 11 }}>사용 {fmt3(used)}</Typography>
      <Typography variant="caption" sx={{ color, fontWeight: 800, fontSize: 11 }}>→</Typography>
      <Typography variant="caption" sx={{ fontWeight: 800, color, fontFamily: "monospace", fontSize: 11 }}>잔여 {available != null ? fmt3(available) : "-"}mm</Typography>
      {total != null && <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 9 }}>(±{fmt2(total)})</Typography>}
      {overMargin && <Chip label="초과" size="small" sx={{ height: 14, fontSize: 8, fontWeight: 700, bgcolor: COLOR_NG, color: "#fff", "& .MuiChip-label": { px: 0.3 } }} />}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════
function StepCard({ title, subtitle, children, onApply, onReset, stretch, extraActions }) {
  return (
    <Paper variant="outlined" sx={{
      p: 2, borderRadius: CARD_RADIUS, border: `1px solid ${BORDER_LIGHT}`,
      ...(stretch && { flex: 1, display: "flex", flexDirection: "column" }),
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {extraActions}
          {onApply && <Tooltip title="추천값 적용"><IconButton size="small" onClick={onApply} sx={{ color: CI_PRIMARY }}><AutoFixHighIcon fontSize="small" /></IconButton></Tooltip>}
          {onReset && <Tooltip title="초기화"><IconButton size="small" onClick={onReset}><RestartAltIcon fontSize="small" /></IconButton></Tooltip>}
        </Stack>
      </Stack>
      {children}
    </Paper>
  );
}

// ═══════════════════════════════════════════════════════════════
function GlobalCorrectionStep({ offsets, liveRec, slitterAvailable, onToggle, onChange, onApplyRecommended, onReset, warnings, marginInfo }) {
  return (
    <StepCard title="전역 보정" subtitle="프린팅 (X/Y) + 슬리터 (Y)" onApply={onApplyRecommended} onReset={onReset}>
      <Stack spacing={1.5} sx={{ px: 1 }}>
        <WheelSlider label="절연 X" value={offsets.printing_x} recommended={liveRec?.printing_x}
          onChange={(v) => onChange({ printing_x: v })} warningZone={warnings?.printingX ?? "normal"}
          precision={3} step={0.001} wheelStep={0.001} marginLimit={marginInfo?.insulation_x} />
        <WheelSlider label="카본 Y" value={offsets.printing_y} recommended={liveRec?.printing_y}
          onChange={(v) => onChange({ printing_y: v })} warningZone={warnings?.printingY ?? "normal"}
          precision={3} step={0.001} wheelStep={0.001} marginLimit={marginInfo?.carbon_y} />
        <Divider sx={{ my: 0.5 }} />
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1, opacity: slitterAvailable ? 1 : 0.35, pointerEvents: slitterAvailable ? "auto" : "none" }}>
            <WheelSlider label="슬리터 Y" value={offsets.slitter_y[0] ?? 0}
              recommended={slitterAvailable ? (liveRec?.slitter_y?.[0] ?? 0) : 0}
              onChange={(v) => { const r2 = Math.round(v * 100) / 100; onChange({ slitter_y: Array(12).fill(r2) }); }}
              warningZone={warnings?.printingY ?? "normal"}
              precision={2} step={0.01} wheelStep={0.01} marginLimit={marginInfo?.slitter_y} />
          </Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, whiteSpace: "nowrap" }}>전일슬리팅</Typography>
            <Switch size="small" checked={!slitterAvailable} onChange={() => onToggle?.()} />
          </Stack>
        </Stack>
      </Stack>
    </StepCard>
  );
}

// ═══════════════════════════════════════════════════════════════
function AssemblyStep({ offsets, liveRec, onChange, onApplyRecommended, onApplyStandalone, onReset, warnings, adjustRows, recApplied }) {
  const renderRow = (i) => {
    const isAdjust = recApplied && adjustRows?.has(i);
    return (
      <Stack key={i} direction="row" spacing={0.5} alignItems="center"
        sx={{
          py: 0.4, px: 0.5, borderBottom: `1px solid ${BORDER_LIGHT}`,
          ...(isAdjust && { bgcolor: "rgba(120,120,120,0.06)", borderLeft: "3px solid #888", borderRadius: 1 }),
        }}>
        <Typography variant="caption" sx={{
          width: 36, fontWeight: 700, display: "flex", alignItems: "center", gap: 0.3, fontSize: 11,
          color: isAdjust ? "#555" : "text.secondary",
        }}>
          {isAdjust && <BuildIcon sx={{ fontSize: 11, color: "#888" }} />}
          R{i + 1}
        </Typography>
        <Box sx={{ flex: 1 }}>
          <WheelSlider label="X" value={offsets.assembly_x[i]} recommended={liveRec?.assembly_x?.[i]}
            onChange={(v) => { const r2 = Math.round(v * 100) / 100; const n = [...offsets.assembly_x]; n[i] = r2; onChange({ assembly_x: n }); }}
            warningZone={warnings?.perRowX?.[i] ?? "normal"} size="small" inline
            precision={2} step={0.01} wheelStep={0.01} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <WheelSlider label="Y" value={offsets.assembly_y[i]} recommended={liveRec?.assembly_y?.[i]}
            onChange={(v) => { const r2 = Math.round(v * 100) / 100; const n = [...offsets.assembly_y]; n[i] = r2; onChange({ assembly_y: n }); }}
            warningZone={warnings?.perRowY?.[i] ?? "normal"} size="small" inline
            precision={2} step={0.01} wheelStep={0.01} />
        </Box>
      </Stack>
    );
  };
  return (
    <StepCard title="자동조립기 (X+Y)" subtitle="Row별 개별 보정 · 소수점 2자리"
      onApply={onApplyRecommended} onReset={onReset} stretch
      extraActions={onApplyStandalone && (
        <Tooltip title="조립기 단독 추천값 (프린팅/슬리터 무관)">
          <IconButton size="small" onClick={onApplyStandalone} sx={{ color: "#666" }}><BuildIcon fontSize="small" /></IconButton>
        </Tooltip>
      )}>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {Array.from({ length: 12 }, (_, i) => renderRow(i))}
      </Box>
    </StepCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
export default function AdjustmentPage() {
  const { sheetKey: rawKey } = useParams();
  const navigate = useNavigate();
  const sheetKey = rawKey ? decodeURIComponent(rawKey) : null;
  const pageRef = useRef(null);

  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const jobId = useAppStore((s) => s.jobId);
  const setSelectedSheet = useAppStore((s) => s.setSelectedSheet);
  const sortedSheetKeys = useAppStore((s) => s.sortedSheetKeys);

  const [originalRows, setOriginalRows] = useState([]);
  const [offsets, setOffsets] = useState({ ...ZERO_OFFSETS });
  const [serverRec, setServerRec] = useState(null);
  const [slitterAvailable, setSlitterAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [processData, setProcessData] = useState(null);
  const [snackMsg, setSnackMsg] = useState("");
  const [modeLabel, setModeLabel] = useState(MODE.MANUAL);
  const [recApplied, setRecApplied] = useState(false);

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!jobId || !sheetKey) return;
    setSelectedSheet(sheetKey);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [detail, rec, proc] = await Promise.all([
          getSheetDetail(jobId, sheetKey),
          getRecommendedOffsets(jobId, sheetKey, slitterAvailable),
          getProcessData(jobId).catch(() => null),
        ]);
        if (cancelled) return;
        setOriginalRows(detail?.rows ?? []);
        setServerRec(rec);
        setProcessData(proc);
        setOffsets({
          printing_x: rec?.printing_x ?? 0,
          printing_y: rec?.printing_y ?? 0,
          slitter_y: Array(12).fill(0),
          assembly_x: Array(12).fill(0),
          assembly_y: Array(12).fill(0),
        });
        setModeLabel(MODE.MANUAL);
        setRecApplied(false);
      } catch (e) { console.error("Load failed:", e); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [jobId, sheetKey]); // eslint-disable-line

  // 슬리터 토글 → 서버 추천값 re-fetch
  useEffect(() => {
    if (!jobId || !sheetKey) return;
    let cancelled = false;
    (async () => {
      try {
        const rec = await getRecommendedOffsets(jobId, sheetKey, slitterAvailable);
        if (!cancelled) setServerRec(rec);
      } catch (e) { console.error(e); }
    })();
    return () => { cancelled = true; };
  }, [slitterAvailable]); // eslint-disable-line

  // ── 공정 마진 정보 ──
  const marginInfo = useMemo(() => {
    if (!processData) return null;
    const minMovable = (rows, key) => {
      if (!rows || rows.length === 0) return null;
      const vals = rows.map((r) => r[key]).filter((v) => v != null && Number.isFinite(v));
      return vals.length > 0 ? Math.min(...vals) : null;
    };
    return {
      insulation_x: minMovable(processData.insulation, "X이동가능(mm)"),
      carbon_y: minMovable(processData.carbon, "Y이동가능(mm)"),
      slitter_y: minMovable(processData.slitter, "이동가능(mm)"),
    };
  }, [processData]);

  // ── 실시간 시뮬레이션 ──
  const simResult = useMemo(() => simulateAll(originalRows, offsets, storeT), [originalRows, offsets, storeT]);

  // ── 상호 연동 추천값 ──
  const liveRec = useMemo(
    () => computeAllRecommended(originalRows, offsets, slitterAvailable),
    [originalRows, offsets, slitterAvailable]
  );

  // ── 슬라이더 경고 ──
  const sliderWarnings = useMemo(() => {
    const pr = simResult?.perRow || [];
    const wx = Math.max(0, ...pr.map((r) => r.afterX ?? 0));
    const wy = Math.max(0, ...pr.map((r) => r.afterY ?? 0));
    return {
      printingX: wx >= storeT.ng ? "ng" : wx >= storeT.check ? "check" : "normal",
      printingY: wy >= storeT.ng ? "ng" : wy >= storeT.check ? "check" : "normal",
      perRowX: pr.map((r) => (r.afterX ?? 0) >= storeT.ng ? "ng" : (r.afterX ?? 0) >= storeT.check ? "check" : "normal"),
      perRowY: pr.map((r) => (r.afterY ?? 0) >= storeT.ng ? "ng" : (r.afterY ?? 0) >= storeT.check ? "check" : "normal"),
    };
  }, [simResult, storeT]);

  // ── 조정 우선순위 Row ──
  const adjustRows = useMemo(() => {
    if (!recApplied || !liveRec) return new Set();
    const scored = Array.from({ length: 12 }, (_, i) => ({
      idx: i,
      movement: Math.max(Math.abs(liveRec.assembly_x?.[i] ?? 0), Math.abs(liveRec.assembly_y?.[i] ?? 0)),
    }));
    scored.sort((a, b) => b.movement - a.movement);
    return new Set(scored.filter((s) => s.movement > 0.01).slice(0, 5).map((s) => s.idx));
  }, [recApplied, liveRec]);

  // ── Handlers ──
  const handleOffsetChange = useCallback((patch) => {
    setOffsets((prev) => ({ ...prev, ...patch }));
    setModeLabel(MODE.MANUAL);
  }, []);

  const handleSlitterToggle = useCallback(() => {
    setSlitterAvailable((prev) => {
      const next = !prev;
      if (!next) setOffsets((o) => ({ ...o, slitter_y: Array(12).fill(0) }));
      return next;
    });
  }, []);

  const applyAllRecommended = useCallback(() => {
    if (!serverRec) return;
    setOffsets({
      printing_x: serverRec.printing_x ?? 0,
      printing_y: serverRec.printing_y ?? 0,
      slitter_y: slitterAvailable ? (serverRec.slitter_y ?? Array(12).fill(0)) : Array(12).fill(0),
      assembly_x: (serverRec.assembly_x ?? Array(12).fill(0)).map((v) => Math.round(v * 100) / 100),
      assembly_y: (serverRec.assembly_y ?? Array(12).fill(0)).map((v) => Math.round(v * 100) / 100),
    });
    setModeLabel(MODE.ALL_REC);
    setRecApplied(true);
  }, [serverRec, slitterAvailable]);

  const applyGlobalRecommended = useCallback(() => {
    if (!liveRec) return;
    setOffsets((o) => ({
      ...o,
      printing_x: liveRec.printing_x ?? 0,
      printing_y: liveRec.printing_y ?? 0,
      slitter_y: slitterAvailable ? liveRec.slitter_y.map((v) => Math.round(v * 100) / 100) : Array(12).fill(0),
    }));
    setModeLabel(MODE.GLOBAL_REC);
    setRecApplied(true);
  }, [liveRec, slitterAvailable]);

  const applyAssemblyRecommended = useCallback(() => {
    if (!liveRec) return;
    setOffsets((o) => ({
      ...o,
      assembly_x: liveRec.assembly_x.map((v) => Math.round(v * 100) / 100),
      assembly_y: liveRec.assembly_y.map((v) => Math.round(v * 100) / 100),
    }));
    setModeLabel(MODE.ASSEMBLY_REC);
    setRecApplied(true);
  }, [liveRec]);

  const applyAssemblyStandalone = useCallback(() => {
    if (!serverRec) return;
    setOffsets((o) => ({
      ...o,
      assembly_x: (serverRec.assembly_x_standalone ?? Array(12).fill(0)).map((v) => Math.round(v * 100) / 100),
      assembly_y: (serverRec.assembly_y_standalone ?? Array(12).fill(0)).map((v) => Math.round(v * 100) / 100),
    }));
    setModeLabel(MODE.ASSEMBLY_STANDALONE);
    setRecApplied(true);
  }, [serverRec]);

  const resetAll = useCallback(() => {
    setOffsets({ ...ZERO_OFFSETS });
    setModeLabel(MODE.MANUAL);
    setRecApplied(false);
  }, []);

  // ── 클립보드 복사 ──
  const copyToClipboard = useCallback(() => {
    const lines = [`시트: ${sheetKey}`, `모드: ${modeLabel}`, "",
      `절연 X: ${sign3(offsets.printing_x)}`, `카본 Y: ${sign3(offsets.printing_y)}`];
    if (slitterAvailable) lines.push(`슬리터 Y: ${sign2(offsets.slitter_y[0] ?? 0)}`);
    lines.push("", "자동조립기:", "Row\tX\tY");
    for (let i = 0; i < 12; i++) {
      const mark = adjustRows.has(i) ? " 🔧" : "";
      lines.push(`R${String(i + 1).padStart(2)}\t${sign2(offsets.assembly_x[i])}\t${sign2(offsets.assembly_y[i])}${mark}`);
    }
    const al = [...adjustRows].map((i) => `R${i + 1}`).join(", ");
    if (al) lines.push(`\n🔧 주요 조정: ${al}`);
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => setSnackMsg("클립보드에 복사됨"))
      .catch(() => setSnackMsg("복사 실패"));
  }, [offsets, sheetKey, slitterAvailable, adjustRows, modeLabel]);

  // ── PDF 저장 ──
  const savePdf = useCallback(async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const el = pageRef.current;
      if (!el) return;
      setSnackMsg("PDF 생성 중...");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      const name = (sheetKey ?? "adjustment").replace(/[|/\\]/g, "_");
      pdf.save(`${name}_보정값.pdf`);
      setSnackMsg("PDF 저장 완료");
    } catch (e) {
      console.error("PDF save failed:", e);
      setSnackMsg("PDF 저장 실패");
    }
  }, [sheetKey]);

  // Navigation
  const { prev, next, idx, total } = useMemo(() => {
    const keys = sortedSheetKeys;
    const i = keys.indexOf(sheetKey);
    return { prev: i > 0 ? keys[i - 1] : null, next: i < keys.length - 1 ? keys[i + 1] : null, idx: i, total: keys.length };
  }, [sheetKey, sortedSheetKeys]);
  const goTo = (key) => { if (!key) return; setSelectedSheet(key); navigate(`/adjustment/${encodeURIComponent(key)}`); };

  if (!jobId) return <Box sx={{ p: 4, textAlign: "center" }}><Typography color="text.secondary">CSV를 먼저 업로드하세요.</Typography></Box>;
  if (!sheetKey) return <Box sx={{ p: 4, textAlign: "center" }}><Typography color="text.secondary">Explorer에서 시트를 선택하세요.</Typography></Box>;
  if (loading && originalRows.length === 0) return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 8 }}>
      <Stack alignItems="center" spacing={1.5}><CircularProgress size={32} /><Typography variant="body2" color="text.secondary">로딩 중...</Typography></Stack>
    </Box>
  );

  return (
    <Box ref={pageRef} sx={{ maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: CARD_RADIUS, border: `1px solid ${BORDER_LIGHT}` }}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <IconButton size="small" onClick={() => navigate(-1)}><ArrowBackIcon fontSize="small" /></IconButton>
          <TuneIcon sx={{ color: CI_PRIMARY }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: CI_PRIMARY }}>Adjustment Simulation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>{sheetKey}</Typography>
          <Box sx={{ flex: 1 }} />
          {/* 모드 라벨 */}
          <Chip label={modeLabel} size="small" variant="outlined"
            sx={{ fontWeight: 600, fontSize: 10, borderColor: CI_PRIMARY, color: CI_PRIMARY }} />
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <IconButton size="small" disabled={!prev} onClick={() => goTo(prev)}><NavigateBeforeIcon /></IconButton>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{idx + 1} / {total}</Typography>
            <IconButton size="small" disabled={!next} onClick={() => goTo(next)}><NavigateNextIcon /></IconButton>
          </Stack>
          <Button variant="contained" size="small" startIcon={<AutoFixHighIcon />} onClick={applyAllRecommended} sx={{ ml: 1 }}>전체 추천값</Button>
          <Button variant="outlined" size="small" startIcon={<RestartAltIcon />} onClick={resetAll}>초기화</Button>
          <Tooltip title="보정값 복사"><IconButton size="small" onClick={copyToClipboard}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="PDF 저장">
            <IconButton size="small" onClick={savePdf}><SaveAltIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {loading ? <Typography color="text.secondary" sx={{ p: 4, textAlign: "center" }}>로딩 중...</Typography> : (
        <Stack spacing={2}>
          <ScoreDashboard before={simResult.before} after={simResult.after} marginInfo={marginInfo} offsets={offsets} />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" }, gap: 2, alignItems: "stretch" }}>
            <Stack spacing={2} sx={{ height: "100%" }}>
              <GlobalCorrectionStep offsets={offsets} liveRec={liveRec} slitterAvailable={slitterAvailable}
                onToggle={handleSlitterToggle} onChange={handleOffsetChange}
                onApplyRecommended={applyGlobalRecommended}
                onReset={() => { setOffsets((o) => ({ ...o, printing_x: 0, printing_y: 0, slitter_y: Array(12).fill(0) })); setModeLabel(MODE.MANUAL); }}
                warnings={sliderWarnings} marginInfo={marginInfo} />

              <Box sx={{ flex: 1, display: "flex" }}>
                <AssemblyStep offsets={offsets} liveRec={liveRec} onChange={handleOffsetChange} warnings={sliderWarnings}
                  adjustRows={adjustRows} recApplied={recApplied}
                  onApplyRecommended={applyAssemblyRecommended} onApplyStandalone={applyAssemblyStandalone}
                  onReset={() => { setOffsets((o) => ({ ...o, assembly_x: Array(12).fill(0), assembly_y: Array(12).fill(0) })); setModeLabel(MODE.MANUAL); setRecApplied(false); }} />
              </Box>
            </Stack>

            <Box><BeforeAfterChart perRow={simResult.perRow} modeLabel={modeLabel} /></Box>
          </Box>
        </Stack>
      )}

      <Snackbar open={!!snackMsg} autoHideDuration={2500} onClose={() => setSnackMsg("")}
        message={snackMsg} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Box>
  );
}
