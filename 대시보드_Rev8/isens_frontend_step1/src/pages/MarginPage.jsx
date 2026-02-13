import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import useAppStore from "../store/useAppStore";
import useThresholdStore from "../store/useThresholdStore";
import { uploadProcessFiles, getProcessData } from "../api/margin";
import BarCell from "../components/shared/BarCell";
// ThresholdSettingsPanel moved to AppShell (D2)
import FourPointDeviationViz from "../components/margin/GridDistortionViz";
import { fmt2, asText } from "../components/shared/fmt";
import {
  CI_PRIMARY,
  CI_GREEN,
  COLOR_NG,
  COLOR_CHECK,
  CARD_RADIUS,
  STATUS_STYLES,
} from "../components/shared/colors";

// 판정 → 색상/스타일 매핑 (5대 분석 전체)
const JUDGE_STYLES = {
  "양호":           { bg: STATUS_STYLES.OK.bg,    color: CI_GREEN,    label: "양호" },
  "관찰":           { bg: STATUS_STYLES.CHECK.bg, color: COLOR_CHECK, label: "관찰" },
  "조정 비권장":     { bg: STATUS_STYLES.NG.bg,    color: COLOR_NG,    label: "비권장" },
  "데이터없음":      { bg: "rgba(0,0,0,0.04)",     color: "#87898C",   label: "-" },
  "경계":           { bg: STATUS_STYLES.CHECK.bg, color: COLOR_CHECK, label: "경계" },
  "원단 이상":       { bg: STATUS_STYLES.NG.bg,    color: COLOR_NG,    label: "원단이상" },
  "교체/폐기 권장":  { bg: STATUS_STYLES.NG.bg,    color: COLOR_NG,    label: "교체권장" },
  "강관찰":         { bg: "#FFF3E0",              color: "#E65100",   label: "강관찰" },
  "이상":           { bg: STATUS_STYLES.NG.bg,    color: COLOR_NG,    label: "이상" },
};

// 판정 우선순위 (숫자 클수록 심각)
const JUDGE_ORDER = {
  "데이터없음": 0, "양호": 1, "경계": 2, "관찰": 3,
  "강관찰": 4, "조정 비권장": 5, "교체/폐기 권장": 6, "원단 이상": 7, "이상": 5,
};

// 상태 3단계 매핑
const STATUS_LEVEL = {
  "양호": "ok", "데이터없음": "ok",
  "경계": "warn", "관찰": "warn", "강관찰": "warn",
  "조정 비권장": "danger", "교체/폐기 권장": "danger", "원단 이상": "danger", "이상": "danger",
};

const STATUS_COLORS = {
  ok:     { bg: STATUS_STYLES.OK.bg, border: CI_GREEN, color: CI_GREEN, label: "양호" },
  warn:   { bg: STATUS_STYLES.CHECK.bg, border: COLOR_CHECK, color: COLOR_CHECK, label: "경계" },
  danger: { bg: STATUS_STYLES.NG.bg, border: COLOR_NG, color: COLOR_NG, label: "위험" },
};

/**
 * MarginPage — 공정마진 5대 분석
 * URL: /#/margin  또는 /#/margin/:sheetKey
 *
 * 탭 순서 (공정 흐름):
 *   원단 → 스텐실 → 카본프린팅 → 절연프린팅 → 간섭 → 타발폭 → 전체폭
 */
export default function MarginPage() {
  const { sheetKey } = useParams();
  const navigate = useNavigate();
  const printingRef = useRef(null);
  const slitterRef = useRef(null);

  const jobId = useAppStore((s) => s.jobId);
  const sortedSheetKeys = useAppStore((s) => s.sortedSheetKeys);
  const setSelectedSheet = useAppStore((s) => s.setSelectedSheet);
  const mp = useThresholdStore((s) => s.thresholds.marginPrinting);
  const mf = useThresholdStore((s) => s.thresholds.marginFabric);

  const [processData, setProcessData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [tabIdx, setTabIdx] = useState(0);
  const [error, setError] = useState(null);
  const [printingFiles, setPrintingFiles] = useState([]);
  const [slitterFiles, setSlitterFiles] = useState([]);

  const decodedKey = sheetKey ? decodeURIComponent(sheetKey) : null;

  const adjacentKeys = useMemo(() => {
    if (!decodedKey) return { prev: null, next: null, idx: -1, total: 0 };
    const keys = sortedSheetKeys;
    const idx = keys.indexOf(decodedKey);
    if (idx < 0) return { prev: null, next: null, idx: -1, total: keys.length };
    return {
      prev: idx > 0 ? keys[idx - 1] : null,
      next: idx < keys.length - 1 ? keys[idx + 1] : null,
      idx,
      total: keys.length,
    };
  }, [decodedKey, sortedSheetKeys]);

  useEffect(() => {
    if (!jobId) return;
    getProcessData(jobId)
      .then((d) => {
        if (d && (d.carbon?.length > 0 || d.slitter?.length > 0 || d.fabric?.length > 0)) {
          setProcessData(d);
        }
      })
      .catch(() => {});
  }, [jobId]);

  async function onRunAnalysis() {
    if (!jobId || (printingFiles.length === 0 && slitterFiles.length === 0)) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadProcessFiles(jobId, printingFiles, slitterFiles);
      setProcessData(res);
    } catch (e) {
      setError(e?.response?.data?.detail ?? e?.message ?? "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  if (!jobId) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.secondary" }}>
        <Typography variant="h6">CSV 파일을 업로드하세요</Typography>
      </Box>
    );
  }

  // 데이터 존재 여부
  const hasFabric       = processData?.fabric?.length > 0;
  const hasStencil      = processData?.stencilDetail?.length > 0;
  const hasCarbon       = processData?.carbon?.length > 0;
  const hasInsulation   = processData?.insulation?.length > 0;
  const hasInterference = processData?.interference?.length > 0;
  const hasSlitter      = processData?.slitter?.length > 0;
  const hasSlitterTotal = processData?.slitterTotal?.length > 0;
  const hasData = hasFabric || hasStencil || hasCarbon || hasInsulation || hasInterference || hasSlitter || hasSlitterTotal;

  // 탭 구성 (공정 흐름 순서)
  const tabs = [];
  if (hasFabric)       tabs.push({ label: "원단",         data: processData.fabric,        type: "fabric",       tabKey: "fabric" });
  if (hasStencil)      tabs.push({ label: "스텐실",       data: { detail: processData.stencilDetail, summary: processData.stencilSummary }, type: "stencil", tabKey: "stencil" });
  if (hasCarbon)       tabs.push({ label: "카본 프린팅",   data: processData.carbon,        type: "printing",     tabKey: "carbon" });
  if (hasInsulation)   tabs.push({ label: "절연 프린팅",   data: processData.insulation,    type: "printing",     tabKey: "insulation" });
  if (hasInterference) tabs.push({ label: "레이어간 간섭", data: processData.interference,  type: "printing",     tabKey: "interference" });
  if (hasSlitter)      tabs.push({ label: "타발폭",       data: processData.slitter,       type: "slitter",      tabKey: "slitter" });
  if (hasSlitterTotal) tabs.push({ label: "전체폭",       data: processData.slitterTotal,  type: "slitterTotal", tabKey: "slitterTotal" });

  const safeTabIdx = Math.min(tabIdx, Math.max(0, tabs.length - 1));
  const currentTab = tabs[safeTabIdx] ?? null;

  // 상태 카드 데이터 빌드 (ProcessFlowCard 로직 재사용)
  const summaryStages = buildSummaryStages(processData);

  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      {/* 네비게이션 */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate("/explorer")} sx={{ color: "text.secondary" }}>
          Explorer
        </Button>
        {decodedKey && (
          <>
            <Button size="small" disabled={!adjacentKeys.prev} onClick={() => { setSelectedSheet(adjacentKeys.prev); navigate(`/margin/${encodeURIComponent(adjacentKeys.prev)}`); }} sx={{ minWidth: 32 }}>
              <NavigateBeforeIcon fontSize="small" />
            </Button>
            {adjacentKeys.idx >= 0 && (
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", fontSize: 12 }}>
                {adjacentKeys.idx + 1} / {adjacentKeys.total}
              </Typography>
            )}
            <Button size="small" disabled={!adjacentKeys.next} onClick={() => { setSelectedSheet(adjacentKeys.next); navigate(`/margin/${encodeURIComponent(adjacentKeys.next)}`); }} sx={{ minWidth: 32 }}>
              <NavigateNextIcon fontSize="small" />
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" onClick={() => navigate(`/detail/${encodeURIComponent(decodedKey)}`)}>
              Detail 보기
            </Button>
          </>
        )}
      </Stack>

      {/* 헤더 */}
      <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>공정마진 분석</Typography>
            {decodedKey && <Chip size="small" label={asText(decodedKey)} sx={{ fontWeight: 700, maxWidth: 300 }} />}
            {hasData && (
              <Chip size="small" icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />} label="데이터 로드됨"
                sx={{ fontWeight: 600, background: STATUS_STYLES.OK.bg, color: CI_GREEN }} />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* 업로드 영역 */}
      <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS, borderStyle: hasData ? "solid" : "dashed", borderColor: hasData ? "rgba(0,0,0,0.12)" : CI_PRIMARY, background: hasData ? "transparent" : "rgba(23,28,143,0.02)" }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap" }}>
              <Button variant="outlined" size="small" startIcon={<UploadFileIcon />} disabled={uploading} onClick={() => printingRef.current?.click()}
                sx={{ borderColor: printingFiles.length > 0 ? CI_GREEN : undefined, color: printingFiles.length > 0 ? CI_GREEN : undefined }}>
                프린팅 CSV
              </Button>
              <input ref={printingRef} type="file" hidden multiple accept=".csv,text/csv"
                onChange={(e) => { setPrintingFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              {printingFiles.length > 0 && <Chip size="small" label={printingFiles.map((f) => f.name).join(", ")} onDelete={() => setPrintingFiles([])} sx={{ fontWeight: 600, fontSize: 11, maxWidth: 300 }} />}
              <Divider orientation="vertical" flexItem />
              <Button variant="outlined" size="small" startIcon={<UploadFileIcon />} disabled={uploading} onClick={() => slitterRef.current?.click()}
                sx={{ borderColor: slitterFiles.length > 0 ? CI_GREEN : undefined, color: slitterFiles.length > 0 ? CI_GREEN : undefined }}>
                슬리터 CSV
              </Button>
              <input ref={slitterRef} type="file" hidden multiple accept=".csv,text/csv"
                onChange={(e) => { setSlitterFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              {slitterFiles.length > 0 && <Chip size="small" label={slitterFiles.map((f) => f.name).join(", ")} onDelete={() => setSlitterFiles([])} sx={{ fontWeight: 600, fontSize: 11, maxWidth: 300 }} />}
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="contained" size="small" startIcon={<PlayArrowIcon />}
                disabled={uploading || (printingFiles.length === 0 && slitterFiles.length === 0)} onClick={onRunAnalysis}>
                {uploading ? "분석 중..." : "분석 실행"}
              </Button>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {uploading ? "파일 업로드 및 마진 계산 중..."
                  : hasData ? `원단: ${hasFabric?"✓":"✗"} · 스텐실: ${hasStencil?"✓":"✗"} · 카본: ${hasCarbon?"✓":"✗"} · 절연: ${hasInsulation?"✓":"✗"} · 간섭: ${hasInterference?"✓":"✗"} · 슬리터: ${hasSlitter?"✓":"✗"} · 파일: ${(processData?.printingFilenames?.length ?? 0)+(processData?.slitterFilenames?.length ?? 0)}개`
                  : printingFiles.length === 0 && slitterFiles.length === 0 ? "프린팅 CSV와 슬리터 CSV를 각각 선택하세요"
                  : `프린팅 ${printingFiles.length}개, 슬리터 ${slitterFiles.length}개 선택됨`}
              </Typography>
            </Stack>
          </Stack>
          {error && <Typography variant="caption" sx={{ color: COLOR_NG, mt: 0.5, display: "block" }}>{error}</Typography>}
        </CardContent>
      </Card>

      {/* 데이터: 상태카드 + 탭 + 테이블 + 격자변형 + 흐름 */}
      {hasData && (
        <>
          {/* ── A1: 상단 프로세스 상태 카드 (현장 요약) ── */}
          {summaryStages.length > 0 && (
            <Box sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 1,
            }}>
              {summaryStages.map((s, i) => {
                const level = STATUS_LEVEL[s.judge] ?? "ok";
                const sc = STATUS_COLORS[level];
                // 해당 탭 인덱스 찾기
                const targetIdx = tabs.findIndex((t) => t.tabKey === s.tabKey);
                return (
                  <Paper
                    key={i}
                    variant="outlined"
                    onClick={() => { if (targetIdx >= 0) setTabIdx(targetIdx); }}
                    sx={{
                      p: 1.5,
                      borderRadius: CARD_RADIUS,
                      borderLeft: `3px solid ${sc.border}`,
                      cursor: targetIdx >= 0 ? "pointer" : "default",
                      transition: "all 0.2s",
                      "&:hover": targetIdx >= 0 ? { boxShadow: "0 2px 8px rgba(0,0,0,0.08)" } : {},
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "text.primary", fontSize: 12, display: "block", mb: 0.3 }}>
                      {s.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={sc.label}
                      sx={{
                        fontWeight: 700,
                        fontSize: 10,
                        height: 20,
                        background: sc.bg,
                        color: sc.color,
                        mb: 0.5,
                      }}
                    />
                    <Typography variant="caption" sx={{ display: "block", fontWeight: 700, color: sc.color, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {s.value}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontSize: 10, mt: 0.2 }}>
                      {s.detail}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          )}

          {/* ── 탭 + 테이블 ── */}
          <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
            <CardContent sx={{ py: 1.5 }}>
              <Tabs value={safeTabIdx} onChange={(_, v) => setTabIdx(v)} sx={{ minHeight: 36, mb: 1.5 }}
                variant="scrollable" scrollButtons="auto" TabIndicatorProps={{ sx: { height: 2.5 } }}>
                {tabs.map((t, i) => (
                  <Tab key={i} label={t.label} sx={{ minHeight: 36, fontWeight: 700, fontSize: 13 }} />
                ))}
              </Tabs>
              {currentTab && <MarginTable data={currentTab.data} type={currentTab.type} mp={mp} mf={mf} tabKey={currentTab.tabKey} />}
            </CardContent>
          </Card>

          {/* ── D3+D4: 4포인트 편차 시각화 (카본/절연/간섭만) ── */}
          {currentTab && currentTab.type === "printing" && processData?.printingCalc && (
            <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: CI_PRIMARY, mb: 1 }}>
                  4포인트 편차 시각화
                </Typography>
                <FourPointDeviationViz
                  printingCalc={processData.printingCalc}
                  isInterference={currentTab.tabKey === "interference"}
                />
              </CardContent>
            </Card>
          )}

        </>
      )}
    </Stack>
  );
}

// ── 상태 카드 데이터 빌드 ──
function buildSummaryStages(processData) {
  if (!processData) return [];
  const stages = [];

  if (processData.fabric?.length > 0) {
    const worstVal = Math.max(...processData.fabric.map((r) => Math.abs(r["|편차|(mm)"] ?? 0)));
    const judge = worstJudgment(processData.fabric);
    stages.push({ name: "원단", value: `${fmt2(worstVal)}mm`, judge, tabKey: "fabric", detail: `최대 편차 ${fmt2(worstVal)}mm` });
  }
  if (processData.stencilDetail?.length > 0) {
    const worstDiff = Math.max(...processData.stencilDetail.map((r) => r["레이어간 차이(mm)"] ?? 0));
    const allJudges = [...(processData.stencilDetail || []), ...(processData.stencilSummary || [])];
    const judge = worstJudgment(allJudges);
    stages.push({ name: "스텐실", value: `${fmt2(worstDiff)}mm`, judge, tabKey: "stencil", detail: `레이어차이 ${fmt2(worstDiff)}mm` });
  }
  if (processData.carbon?.length > 0) {
    const minRate = Math.min(...processData.carbon.map((r) => Math.min(r["X잔여율(%)"] ?? 100, r["Y잔여율(%)"] ?? 100)));
    const judge = worstJudgment(processData.carbon);
    stages.push({ name: "카본", value: `${fmt2(minRate)}%`, judge, tabKey: "carbon", detail: `최소 잔여율 ${fmt2(minRate)}%` });
  }
  if (processData.insulation?.length > 0) {
    const minRate = Math.min(...processData.insulation.map((r) => Math.min(r["X잔여율(%)"] ?? 100, r["Y잔여율(%)"] ?? 100)));
    const judge = worstJudgment(processData.insulation);
    stages.push({ name: "절연", value: `${fmt2(minRate)}%`, judge, tabKey: "insulation", detail: `최소 잔여율 ${fmt2(minRate)}%` });
  }
  if (processData.interference?.length > 0) {
    const minRate = Math.min(...processData.interference.map((r) => Math.min(r["X잔여율(%)"] ?? 100, r["Y잔여율(%)"] ?? 100)));
    const judge = worstJudgment(processData.interference);
    stages.push({ name: "간섭", value: `${fmt2(minRate)}%`, judge, tabKey: "interference", detail: `최소 잔여율 ${fmt2(minRate)}%` });
  }
  if (processData.slitter?.length > 0) {
    const minRate = Math.min(...processData.slitter.map((r) => r["잔여율(%)"] ?? 100));
    const judge = worstJudgment(processData.slitter);
    stages.push({ name: "타발폭", value: `${fmt2(minRate)}%`, judge, tabKey: "slitter", detail: `최소 잔여율 ${fmt2(minRate)}%` });
  }
  if (processData.slitterTotal?.length > 0) {
    const worstRange = Math.max(...processData.slitterTotal.map((r) => r["Range(mm)"] ?? 0));
    const judge = worstJudgment(processData.slitterTotal);
    stages.push({ name: "전체폭", value: `R${fmt2(worstRange)}`, judge, tabKey: "slitterTotal", detail: `Range ${fmt2(worstRange)}mm` });
  }

  return stages;
}

// ─── 판정 배지 ───
function JudgeBadge({ judge }) {
  const js = JUDGE_STYLES[judge] ?? JUDGE_STYLES["데이터없음"];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontWeight: 700, fontSize: 10, background: js.bg, color: js.color }}>
      {js.label}
    </span>
  );
}

// ─── 통합 마진 테이블 (BarCell 사용) ───
function MarginTable({ data, type, mp, mf, tabKey }) {
  if (!data) return null;

  if (type === "fabric") return <FabricTable rows={data} mf={mf} />;
  if (type === "stencil") return <StencilTable detail={data.detail} summary={data.summary} mp={mp} />;
  if (type === "printing") return <PrintingTable rows={data} mp={mp} tabKey={tabKey} />;
  if (type === "slitter") return <SlitterTable rows={data} mp={mp} />;
  if (type === "slitterTotal") return <SlitterTotalTable rows={data} mf={mf} />;
  return null;
}

// ── 원단 테이블 ──
function FabricTable({ rows, mf }) {
  if (!rows?.length) return null;
  const judge = worstJudgment(rows);
  return (
    <Stack spacing={1.5}>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.12)" }}>
              <th style={thStyle}>방향</th>
              <th style={thStyle}>축</th>
              <th style={thRStyle}>기준값</th>
              <th style={thRStyle}>측정값</th>
              <th style={{ ...thStyle, minWidth: 200 }}>편차</th>
              <th style={{ ...thStyle, minWidth: 200 }}>|편차|</th>
              <th style={thCStyle}>판정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={rowBg(r["판정"])}>
                <td style={tdStyle}>{r["방향"]}</td>
                <td style={tdStyle}>{r["축"]}</td>
                <td style={tdNumStyle}>{numFmt(r["기준값(mm)"])}</td>
                <td style={tdNumStyle}>{numFmt(r["측정값(mm)"])}</td>
                <td style={tdStyle}>
                  <BarCell value={r["편차(mm)"]} axis="Y" hideStatus ngLimit={mf.ng} checkLimit={mf.check} scale={mf.scale} dirTextMode="margin" />
                </td>
                <td style={tdStyle}>
                  <BarCell value={r["|편차|(mm)"]} axis="Y" hideStatus ngLimit={mf.ng} checkLimit={mf.check} scale={mf.scale} dirTextMode="margin" />
                </td>
                <td style={tdCStyle}><JudgeBadge judge={r["판정"]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <AnalysisBox type="fabric" judge={judge} />
    </Stack>
  );
}

// ── 스텐실 분석 텍스트 생성 ──
function generateStencilAnalysis(detail, summary) {
  const detailJudges = (detail ?? []).map(r => r["판정"]);
  const summaryJudges = (summary ?? []).map(r => r["판정"]);
  const allJudges = [...detailJudges, ...summaryJudges];

  // 모든 항목이 정상이면 텍스트 표시하지 않음
  const allOk = allJudges.every(j => j === "양호" || j === "데이터없음");
  if (allOk) return null;

  const parts = [];

  // 레이어간 차이 분석
  const hasLayerIssue = detailJudges.some(
    j => j !== "양호" && j !== "데이터없음"
  );
  if (hasLayerIssue) {
    const worstDetail = worstJudgment(detail ?? []);
    if ((JUDGE_ORDER[worstDetail] ?? 0) >= (JUDGE_ORDER["조정 비권장"] ?? 5)) {
      parts.push("스텐실 교체 또는 재작업 검토 필요");
    } else if ((JUDGE_ORDER[worstDetail] ?? 0) >= (JUDGE_ORDER["관찰"] ?? 3)) {
      parts.push("카본 절연 스텐실간 거리가 서로 안맞아서 주기적인 관찰 필요");
    }
  }

  // 비대칭 분석
  const hasAsymIssue = summaryJudges.some(
    j => j !== "양호" && j !== "데이터없음"
  );
  if (hasAsymIssue) {
    parts.push("비대칭 패턴이 감지되었습니다. 상세 확인 필요");
  }

  return parts.length > 0 ? parts.join(". ") + "." : null;
}

// ── 스텐실 테이블 ──
function StencilTable({ detail, summary, mp }) {
  const allRows = [...(detail ?? []), ...(summary ?? [])];
  const judge = worstJudgment(allRows.length > 0 ? allRows : [{ "판정": "양호" }]);
  return (
    <Stack spacing={2}>
      {detail?.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: CI_PRIMARY, mb: 0.5, display: "block" }}>레이어간 차이</Typography>
          <Box sx={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.12)" }}>
                  <th style={thStyle}>방향</th>
                  <th style={{ ...thStyle, minWidth: 200 }}>카본 편차</th>
                  <th style={{ ...thStyle, minWidth: 200 }}>절연 편차</th>
                  <th style={{ ...thStyle, minWidth: 200 }}>레이어간 차이</th>
                  <th style={thCStyle}>판정</th>
                </tr>
              </thead>
              <tbody>
                {detail.map((r, i) => (
                  <tr key={i} style={rowBg(r["판정"])}>
                    <td style={tdStyle}>{r["방향"]}</td>
                    <td style={tdStyle}>
                      <BarCell value={r["카본 편차(mm)"]} axis="Y" hideStatus ngLimit={mp.ng} checkLimit={mp.check} dirTextMode="margin" />
                    </td>
                    <td style={tdStyle}>
                      <BarCell value={r["절연 편차(mm)"]} axis="Y" hideStatus ngLimit={mp.ng} checkLimit={mp.check} dirTextMode="margin" />
                    </td>
                    <td style={tdStyle}>
                      <BarCell value={r["레이어간 차이(mm)"]} axis="Y" hideStatus ngLimit={mp.ng} checkLimit={mp.check} dirTextMode="interference" />
                    </td>
                    <td style={tdCStyle}><JudgeBadge judge={r["판정"]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      )}
      {summary?.length > 0 && (() => {
        const allNormal = summary.every(r => (r["판정"] === "양호" || r["판정"] === "데이터없음"));
        if (allNormal) return null;
        const worstJ = worstJudgment(summary);
        const isMinor = (JUDGE_ORDER[worstJ] ?? 0) <= (JUDGE_ORDER["관찰"] ?? 3);
        return (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: CI_PRIMARY, mb: 0.5, display: "block" }}>비대칭 분석</Typography>
            <Chip
              size="small"
              label={isMinor ? "약한 비대칭 형상 보이나 사용 가능" : "비정상 — 상세 확인 필요"}
              sx={{
                fontWeight: 700, fontSize: 11,
                background: isMinor ? STATUS_STYLES.CHECK.bg : STATUS_STYLES.NG.bg,
                color: isMinor ? COLOR_CHECK : COLOR_NG,
              }}
            />
          </Box>
        );
      })()}
      {/* 스텐실 분석 종합 텍스트 */}
      {generateStencilAnalysis(detail, summary) ? (
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(0,0,0,0.02)" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: CI_PRIMARY, mb: 0.5, display: "block" }}>분석 종합</Typography>
          <Typography variant="body2" sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.6 }}>
            {generateStencilAnalysis(detail, summary)}
          </Typography>
        </Box>
      ) : (
        <AnalysisBox type="stencil" judge={judge} />
      )}
    </Stack>
  );
}

// ── 프린팅/간섭 테이블 ──
function PrintingTable({ rows, mp, tabKey }) {
  if (!rows?.length) return null;
  const judge = worstJudgment(rows);
  const analysisType = tabKey === "interference" ? "interference" : tabKey === "insulation" ? "insulation" : "carbon";
  return (
    <Stack spacing={1.5}>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.12)" }}>
              <th style={thStyle}>Row</th>
              <th style={{ ...thStyle, minWidth: 200 }}>X편차</th>
              <th style={thRStyle}>X이동가능</th>
              <th style={thRStyle}>X잔여율</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Y편차</th>
              <th style={thRStyle}>Y이동가능</th>
              <th style={thRStyle}>Y잔여율</th>
              <th style={thCStyle}>판정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={rowBg(r["판정"])}>
                <td style={tdStyle}>R{r.Row}</td>
                <td style={tdStyle}>
                  <BarCell value={r["X쏠림(mm)"]} axis="X" hideStatus ngLimit={mp.ng} checkLimit={mp.check} dirTextMode="margin" />
                </td>
                <td style={tdNumStyle}>{numCell(r["X이동가능(mm)"], mp.ng, mp.check)}</td>
                <td style={tdNumStyle}>{pctCell(r["X잔여율(%)"])}</td>
                <td style={tdStyle}>
                  <BarCell value={r["Y쏠림(mm)"]} axis="Y" hideStatus ngLimit={mp.ng} checkLimit={mp.check} dirTextMode="margin" />
                </td>
                <td style={tdNumStyle}>{numCell(r["Y이동가능(mm)"], mp.ng, mp.check)}</td>
                <td style={tdNumStyle}>{pctCell(r["Y잔여율(%)"])}</td>
                <td style={tdCStyle}><JudgeBadge judge={r["판정"]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <AnalysisBox type={analysisType} judge={judge} />
    </Stack>
  );
}

// ── 슬리터 타발폭 테이블 (기본 쏠림 모드) ──
function SlitterTable({ rows, mp }) {
  if (!rows?.length) return null;
  const judge = worstJudgment(rows);
  return (
    <Stack spacing={1.5}>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.12)" }}>
              <th style={thStyle}>Row</th>
              <th style={thStyle}>쏠림방향</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Y쏠림</th>
              <th style={thRStyle}>이동가능</th>
              <th style={thRStyle}>잔여율</th>
              <th style={thStyle}>Pos</th>
              <th style={thCStyle}>판정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={rowBg(r["판정"])}>
                <td style={tdStyle}>R{r.Row}</td>
                <td style={tdStyle}>{r["쏠림방향"]}</td>
                <td style={tdStyle}>
                  <BarCell value={r["Y쏠림(mm)"]} axis="Y" hideStatus ngLimit={mp.ng} checkLimit={mp.check} />
                </td>
                <td style={tdNumStyle}>{numCell(r["이동가능(mm)"], mp.ng, mp.check)}</td>
                <td style={tdNumStyle}>{pctCell(r["잔여율(%)"])}</td>
                <td style={tdStyle}>{r["Pos(worst)"]}</td>
                <td style={tdCStyle}><JudgeBadge judge={r["판정"]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <AnalysisBox type="slitter" judge={judge} />
    </Stack>
  );
}

// ── 슬리터 전체폭 균일성 테이블 (margin 모드) ──
function SlitterTotalTable({ rows, mf }) {
  if (!rows?.length) return null;
  const judge = worstJudgment(rows);
  return (
    <Stack spacing={1.5}>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.12)" }}>
              <th style={thStyle}>Row</th>
              <th style={thRStyle}>좌(dev)</th>
              <th style={thRStyle}>중(dev)</th>
              <th style={thRStyle}>우(dev)</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Range</th>
              <th style={thRStyle}>Std</th>
              <th style={thCStyle}>판정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={rowBg(r["판정"])}>
                <td style={tdStyle}>R{r.Row}</td>
                <td style={tdNumStyle}>{numFmt(r["좌(dev)"])}</td>
                <td style={tdNumStyle}>{numFmt(r["중(dev)"])}</td>
                <td style={tdNumStyle}>{numFmt(r["우(dev)"])}</td>
                <td style={tdStyle}>
                  <BarCell value={r["Range(mm)"]} axis="Y" hideStatus ngLimit={mf.ng} checkLimit={mf.check} scale={mf.scale} dirTextMode="margin" />
                </td>
                <td style={tdNumStyle}>{numFmt(r["Std(mm)"])}</td>
                <td style={tdCStyle}><JudgeBadge judge={r["판정"]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <AnalysisBox type="slitterTotal" judge={judge} />
    </Stack>
  );
}

// ── 분석 텍스트 통합 (모든 탭) ──
const ANALYSIS_TEXT = {
  fabric: {
    ok: "원단 편차가 기준 이내입니다. 정상 범위.",
    warn: "원단 편차가 관찰 수준으로 검출되었습니다. 모니터링 권장.",
    danger: "원단 편차가 기준을 초과합니다. 확인 필요.",
  },
  stencil: {
    ok: "레이어간 차이가 기준 이내입니다. 정상.",
    warn: "레이어간 차이가 관찰 수준입니다. 주기적 확인 필요.",
    danger: "레이어간 차이가 기준 초과. 스텐실 확인 필요.",
  },
  carbon: {
    ok: "카본 프린팅 잔여율이 양호합니다.",
    warn: "잔여율이 관찰 수준입니다. 프린팅 상태 모니터링 필요.",
    danger: "잔여율이 부족합니다. 프린팅 위치 조정 필요.",
  },
  insulation: {
    ok: "절연 프린팅 잔여율이 양호합니다.",
    warn: "잔여율이 관찰 수준입니다. 프린팅 상태 모니터링 필요.",
    danger: "잔여율이 부족합니다. 프린팅 위치 조정 필요.",
  },
  interference: {
    ok: "카본-절연 간 간섭이 정상 범위입니다.",
    warn: "간섭 수준이 관찰 단계입니다. 주기적 확인 필요.",
    danger: "간섭이 과다합니다. 레이어 정합 조정 필요.",
  },
  slitter: {
    ok: "타발폭 마진이 충분합니다.",
    warn: "타발폭 마진 여유가 부족합니다. 관찰 필요.",
    danger: "타발폭 마진이 초과되었습니다. 슬리터 조정 필요.",
  },
  slitterTotal: {
    ok: "전체폭 균일성이 양호합니다.",
    warn: "균일성 편차가 관찰 수준입니다.",
    danger: "균일성 편차가 기준을 초과합니다. 확인 필요.",
  },
};

function AnalysisBox({ type, judge }) {
  const texts = ANALYSIS_TEXT[type];
  if (!texts) return null;
  const level = STATUS_LEVEL[judge] ?? "ok";
  const text = texts[level] ?? texts.ok;
  const color = level === "danger" ? COLOR_NG : level === "warn" ? COLOR_CHECK : CI_GREEN;
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(0,0,0,0.02)" }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: CI_PRIMARY, mb: 0.3, display: "block" }}>분석 종합</Typography>
      <Typography variant="body2" sx={{ fontSize: 12, color, lineHeight: 1.6, fontWeight: 600 }}>
        {text}
      </Typography>
    </Box>
  );
}

// ─── 테이블 스타일 ───
const thStyle  = { textAlign: "left", padding: "6px 8px", fontWeight: 700, color: "#53565A", fontSize: 11, whiteSpace: "nowrap" };
const thRStyle = { ...thStyle, textAlign: "right" };
const thCStyle = { ...thStyle, textAlign: "center" };
const tdStyle  = { padding: "5px 8px", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" };
const tdNumStyle = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 };
const tdCStyle = { ...tdStyle, textAlign: "center" };

function rowBg(judge) {
  if (judge === "조정 비권장" || judge === "교체/폐기 권장" || judge === "원단 이상" || judge === "이상") return { borderBottom: "1px solid rgba(0,0,0,0.04)", background: "rgba(220,38,38,0.04)" };
  if (judge === "관찰" || judge === "경계" || judge === "강관찰") return { borderBottom: "1px solid rgba(0,0,0,0.04)", background: "rgba(232,134,12,0.03)" };
  return { borderBottom: "1px solid rgba(0,0,0,0.04)" };
}

function numFmt(v) {
  if (v == null) return "-";
  return fmt2(Number(v));
}

function numCell(v, ngLimit, checkLimit) {
  if (v == null) return "-";
  const n = Number(v);
  const color = Math.abs(n) >= ngLimit ? COLOR_NG : Math.abs(n) >= checkLimit ? COLOR_CHECK : "inherit";
  return <span style={{ color }}>{n >= 0 ? "+" : ""}{fmt2(n)}</span>;
}

function pctCell(v) {
  if (v == null) return "-";
  const n = Number(v);
  const color = n <= 0 ? COLOR_NG : n < 20 ? COLOR_CHECK : CI_GREEN;
  return <span style={{ color, fontWeight: 700 }}>{fmt2(n)}%</span>;
}

function worstJudgment(rows) {
  let worst = "데이터없음";
  for (const r of rows) {
    const j = r["판정"] ?? r["판정(레이어차이)"] ?? "데이터없음";
    if ((JUDGE_ORDER[j] ?? 0) > (JUDGE_ORDER[worst] ?? 0)) worst = j;
  }
  return worst;
}
