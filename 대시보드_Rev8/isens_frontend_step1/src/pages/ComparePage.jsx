import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

import useAppStore from "../store/useAppStore";
import useThresholdStore from "../store/useThresholdStore";
import useBasketStore from "../store/useBasketStore";
import { getSheetDetail } from "../api/step1";
import { getProcessData } from "../api/margin";
import StatusChip from "../components/shared/StatusChip";
import BarCell from "../components/shared/BarCell";
import BullseyeCell from "../components/shared/BullseyeCell";
import FourPointDeviationViz from "../components/margin/GridDistortionViz";
import { fmt2, asNumber, asText } from "../components/shared/fmt";
import {
  CI_PRIMARY,
  CI_GREEN,
  COLOR_NG,
  COLOR_CHECK,
  CARD_RADIUS,
  BORDER_LIGHT,
  STATUS_STYLES,
  HIGHLIGHT_BG,
} from "../components/shared/colors";

/**
 * ComparePage — 바구니에 담긴 시트들을 나란히 비교
 * 3탭: 조립시트 / 프린팅 / 타발
 */
export default function ComparePage() {
  const navigate = useNavigate();
  const basketItems = useBasketStore((s) => s.basketItems);
  const jobId = useAppStore((s) => s.jobId);
  const sheets = useAppStore((s) => s.sheets);

  // 각 시트의 디테일 데이터 + 공정 데이터
  const [details, setDetails] = useState({});
  const [processData, setProcessData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tabIdx, setTabIdx] = useState(0);

  useEffect(() => {
    if (!jobId || basketItems.length === 0) return;

    setLoading(true);
    const detailPromises = basketItems.map((key) =>
      getSheetDetail(jobId, key)
        .then((d) => ({ key, data: d }))
        .catch(() => ({ key, data: null }))
    );

    const processPromise = getProcessData(jobId).catch(() => null);

    Promise.all([Promise.all(detailPromises), processPromise]).then(([results, procData]) => {
      const map = {};
      results.forEach((r) => {
        if (r.data) map[r.key] = r.data;
      });
      setDetails(map);
      setProcessData(procData);
      setLoading(false);
    });
  }, [jobId, basketItems]);

  // 전체 시트 기준 rankMap
  const rankMap = useMemo(() => {
    const map = {};
    const all = Array.isArray(sheets) ? [...sheets] : [];
    all.sort(
      (a, b) =>
        (Number(b?.qualityScore ?? -1)) - (Number(a?.qualityScore ?? -1))
    );
    all.forEach((s, idx) => {
      map[s.sheetKey] = idx + 1;
    });
    return map;
  }, [sheets]);

  const hasPrinting = !!(processData?.printingCalc);
  const slitterByFile = processData?.slitterByFile ?? {};
  const slitterFileKeys = Object.keys(slitterByFile);
  const hasSlitter = slitterFileKeys.length > 0 || !!(processData?.slitter?.length);

  if (!jobId) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "text.secondary",
        }}
      >
        <Typography variant="h6">CSV 파일을 업로드하세요</Typography>
      </Box>
    );
  }

  if (basketItems.length === 0) {
    return (
      <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ height: "100%", color: "text.secondary" }}>
        <Typography variant="h6">비교 바구니가 비어있습니다</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/explorer")}
          variant="outlined"
          size="small"
        >
          Explorer로 돌아가기
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ height: "100%" }}>
      {/* 상단 네비 */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/explorer")}
          sx={{ color: "text.secondary" }}
        >
          Explorer
        </Button>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: CI_PRIMARY }}>
          시트 비교 ({basketItems.length}개)
        </Typography>
        {loading && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            데이터 불러오는 중...
          </Typography>
        )}
      </Stack>

      {/* 탭 */}
      <Tabs
        value={tabIdx}
        onChange={(_, v) => setTabIdx(v)}
        sx={{
          minHeight: 36,
          "& .MuiTab-root": { minHeight: 36, fontSize: 13, fontWeight: 700, textTransform: "none", py: 0.5, px: 2 },
        }}
        TabIndicatorProps={{ sx: { bgcolor: CI_PRIMARY, height: 2.5 } }}
      >
        <Tab label="조립시트" />
        <Tab label="프린팅" disabled={!hasPrinting} />
        <Tab label="타발" disabled={!hasSlitter} />
      </Tabs>

      {/* 탭 0 — 조립시트 (기존) */}
      {tabIdx === 0 && (
        <>
          <Box sx={{ flex: 1, overflowY: "auto", pb: 2 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
              {basketItems.map((key) => {
                const summary = sheets.find((s) => s.sheetKey === key);
                const detail = details[key];
                return (
                  <CompareCard
                    key={key}
                    sheetKey={key}
                    summary={summary}
                    detail={detail}
                    rank={rankMap[key]}
                    onNavigate={() => navigate(`/detail/${encodeURIComponent(key)}`)}
                  />
                );
              })}
              {Array.from({ length: Math.max(0, 6 - basketItems.length) }, (_, i) => (
                <EmptySlot key={`empty-${i}`} />
              ))}
            </Box>
          </Box>

          <CompareSummaryTable
            basketItems={basketItems}
            sheets={sheets}
            details={details}
            rankMap={rankMap}
          />
        </>
      )}

      {/* 탭 1 — 프린팅 (FourPointDeviationViz 2×2) */}
      {tabIdx === 1 && (
        <Box sx={{ flex: 1, overflowY: "auto", pb: 2 }}>
          {hasPrinting ? (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: CI_PRIMARY, mb: 0.5 }}>
                4포인트 편차 시각화
              </Typography>
              {processData?.printingFilenames?.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: "wrap" }} alignItems="center">
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                    분석 파일:
                  </Typography>
                  {processData.printingFilenames.map((fname, i) => (
                    <Chip key={i} size="small" label={fname.replace(/\.[^.]+$/, "")}
                      sx={{ fontWeight: 600, fontSize: 10, height: 20, bgcolor: `${CI_PRIMARY}0A` }} />
                  ))}
                </Stack>
              )}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2 }}>
                {processData?.carbon?.length > 0 && (
                  <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: CI_PRIMARY, mb: 1 }}>
                        카본 프린팅
                      </Typography>
                      <FourPointDeviationViz printingCalc={processData.printingCalc} isInterference={false} />
                    </CardContent>
                  </Card>
                )}
                {processData?.insulation?.length > 0 && (
                  <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: CI_PRIMARY, mb: 1 }}>
                        절연 프린팅
                      </Typography>
                      <FourPointDeviationViz printingCalc={processData.printingCalc} isInterference={false} />
                    </CardContent>
                  </Card>
                )}
                {processData?.interference?.length > 0 && (
                  <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: CI_PRIMARY, mb: 1 }}>
                        간섭 (카본기준)
                      </Typography>
                      <FourPointDeviationViz printingCalc={processData.printingCalc} isInterference={true} />
                    </CardContent>
                  </Card>
                )}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              프린팅 데이터가 없습니다. Margin 페이지에서 프린팅 CSV를 업로드하세요.
            </Typography>
          )}
        </Box>
      )}

      {/* 탭 2 — 타발 (파일별 3컬럼 비교) */}
      {tabIdx === 2 && (
        <Box sx={{ flex: 1, overflowY: "auto", pb: 2 }}>
          {hasSlitter ? (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: CI_PRIMARY, mb: 1.5 }}>
                타발폭 비교 {slitterFileKeys.length > 0 && `(${slitterFileKeys.length}개 파일)`}
              </Typography>
              <SlitterCompareGrid
                slitterByFile={slitterByFile}
                slitterFilenames={processData?.slitterFilenames ?? []}
                fallbackRows={processData?.slitter}
              />
            </>
          ) : (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              타발 데이터가 없습니다. Margin 페이지에서 슬리터 CSV를 업로드하세요.
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );
}

// ─── 타발 비교 그리드 (파일별 3컬럼) ───
function SlitterCompareGrid({ slitterByFile, slitterFilenames, fallbackRows }) {
  const mp = useThresholdStore((s) => s.thresholds.marginPrinting ?? s.thresholds.assembly);

  // 파일별 데이터가 있으면 사용, 없으면 fallback
  const fileKeys = slitterFilenames?.length > 0
    ? slitterFilenames.filter((k) => slitterByFile[k]?.length > 0)
    : Object.keys(slitterByFile);

  // fallback: 파일별 데이터 없으면 기존 flat 배열 1컬럼으로
  if (fileKeys.length === 0 && fallbackRows?.length > 0) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
        <SlitterFileColumn fname="타발폭 데이터" rows={fallbackRows} mp={mp} />
      </Box>
    );
  }

  if (fileKeys.length === 0) return null;

  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: `repeat(${Math.min(fileKeys.length, 3)}, 1fr)`,
      gap: 2,
    }}>
      {fileKeys.map((fname) => (
        <SlitterFileColumn key={fname} fname={fname} rows={slitterByFile[fname] ?? []} mp={mp} />
      ))}
    </Box>
  );
}

// ─── 타발 파일 1컬럼 ───
function SlitterFileColumn({ fname, rows, mp }) {
  // 파일명에서 보기 좋은 이름 추출
  const displayName = useMemo(() => {
    const base = fname.replace(/\.[^.]+$/, ""); // 확장자 제거
    // SET_N 패턴 추출 시도
    const setMatch = base.match(/SET[_\s]*(\d+)/i);
    const suffix = base.split("_").slice(-1)[0]; // 마지막 토큰 (1차조정, 보정후 등)
    if (setMatch) {
      const setNum = setMatch[1];
      const extra = suffix !== `SET${setNum}` && suffix !== setNum ? ` ${suffix}` : "";
      return `SET ${setNum}${extra}`;
    }
    return base.length > 24 ? base.slice(-24) : base;
  }, [fname]);

  if (!rows?.length) return null;

  return (
    <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
      <CardContent sx={{ py: 1.5 }}>
        {/* 파일 헤더 */}
        <Typography variant="subtitle2" sx={{
          fontWeight: 800, color: CI_PRIMARY, mb: 0.3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }} title={fname}>
          {displayName}
        </Typography>
        <Typography variant="caption" sx={{
          color: "text.secondary", display: "block", mb: 1, fontSize: 10,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }} title={fname}>
          {fname}
        </Typography>
        <Divider sx={{ mb: 1 }} />

        {/* R1~R12 간소화 목록 */}
        <Stack spacing={0.3}>
          {rows.map((r) => {
            const judge = r?.["판정"] ?? "-";
            const isOk = judge === "양호";
            const isDanger = judge === "조정 비권장" || judge === "이상" || judge === "교체/폐기 권장";
            return (
              <Box key={r.Row} sx={{
                display: "flex", alignItems: "center", gap: 0.5,
                py: 0.3, px: 0.5,
                borderRadius: 1,
                bgcolor: isDanger ? "rgba(220,38,38,0.04)"
                  : !isOk && judge !== "-" ? "rgba(232,134,12,0.03)" : "transparent",
              }}>
                <Typography sx={{
                  fontWeight: 700, fontSize: 11, width: 28,
                  color: "text.secondary", flexShrink: 0,
                }}>
                  R{r.Row}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <BarCell
                    value={r["Y쏠림(mm)"]}
                    axis="Y"
                    hideStatus
                    ngLimit={mp?.ng}
                    checkLimit={mp?.check}
                  />
                </Box>
                <Chip
                  size="small"
                  label={isOk ? "정상" : "비정상"}
                  sx={{
                    height: 18, fontSize: 10, fontWeight: 700,
                    flexShrink: 0,
                    background: isOk ? STATUS_STYLES.OK.bg
                      : isDanger ? STATUS_STYLES.NG.bg
                      : STATUS_STYLES.CHECK.bg,
                    color: isOk ? CI_GREEN
                      : isDanger ? COLOR_NG
                      : COLOR_CHECK,
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── 개별 시트 비교 카드 ───
function CompareCard({ sheetKey, summary, detail, rank, onNavigate }) {
  const root = detail ?? {};
  const d = root?.detail ?? root;
  const diagnosis = d?.diagnosis ?? {};
  const rows = useMemo(() => (Array.isArray(root?.rows) ? root.rows : []), [root]);
  const tags = Array.isArray(diagnosis?.tags) ? diagnosis.tags : [];

  const worstX =
    asNumber(diagnosis?.worstX?.value ?? diagnosis?.worstX) ??
    asNumber(root?.worstX) ??
    asNumber(summary?.worstX);
  const worstY =
    asNumber(diagnosis?.worstY?.value ?? diagnosis?.worstY) ??
    asNumber(root?.worstY) ??
    asNumber(summary?.worstY);
  const status = diagnosis?.sheetStatus ?? summary?.status ?? "-";
  const score =
    root?.qualityScore ?? summary?.qualityScore ?? diagnosis?.qualityScore;

  // Punch worst
  const punchWorst = useMemo(() => {
    let worst = 0;
    for (const r of rows) {
      const pL = asNumber(r?.["타발홀L"]) ?? 0;
      const pR = asNumber(r?.["타발홀R"]) ?? 0;
      if (Math.abs(pL) > Math.abs(worst)) worst = pL;
      if (Math.abs(pR) > Math.abs(worst)) worst = pR;
    }
    return worst;
  }, [rows]);

  // Worst row (by XY score)
  const worstRow = useMemo(() => {
    if (rows.length === 0) return null;
    let maxScore = 0;
    let best = null;
    for (const r of rows) {
      const s = Math.max(
        Math.abs(asNumber(r?.["상하치우침L"]) ?? 0),
        Math.abs(asNumber(r?.["상하치우침C"]) ?? 0),
        Math.abs(asNumber(r?.["상하치우침R"]) ?? 0),
        Math.abs(asNumber(r?.["조립치우침L"]) ?? 0),
        Math.abs(asNumber(r?.["조립치우침R"]) ?? 0)
      );
      if (s > maxScore) {
        maxScore = s;
        best = r;
      }
    }
    return best;
  }, [rows]);

  // 메타
  const meta = summary?.meta ?? root?.meta ?? {};
  const metaParts = [];
  if (meta?.일자 || meta?.날짜) metaParts.push(asText(meta.일자 ?? meta.날짜));
  if (meta?.라인명) metaParts.push(`라인: ${asText(meta.라인명)}`);
  if (meta?.로트명) metaParts.push(`Lot: ${asText(meta.로트명)}`);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: CARD_RADIUS,
        height: "100%",
        transition: "all 0.2s",
        "&:hover": { borderColor: CI_PRIMARY, boxShadow: "0 2px 8px rgba(23,28,143,0.12)" },
      }}
    >
      <CardContent sx={{ py: 1.5 }}>
        {/* 헤더 */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
          <StatusChip status={status} />
          {rank != null && (
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              #{rank}
            </Typography>
          )}
          <Chip
            size="small"
            label={`Score: ${fmt2(score)}`}
            sx={{ fontWeight: 700, background: `${CI_PRIMARY}0F`, color: CI_PRIMARY, height: 20, fontSize: 11 }}
          />
        </Stack>

        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.3 }} noWrap title={sheetKey}>
          {asText(sheetKey)}
        </Typography>

        {metaParts.length > 0 && (
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
            {metaParts.join(" · ")}
          </Typography>
        )}

        <Divider sx={{ my: 1 }} />

        {/* WorstX / WorstY / Punch 바 */}
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ fontWeight: 800, width: 44, fontSize: 11, color: "text.secondary" }}>
              WorstX
            </Typography>
            {worstX != null ? (
              <BarCell value={worstX} axis="X" hideStatus />
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>-</Typography>
            )}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ fontWeight: 800, width: 44, fontSize: 11, color: "text.secondary" }}>
              WorstY
            </Typography>
            {worstY != null ? (
              <BarCell value={worstY} axis="Y" hideStatus />
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>-</Typography>
            )}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ fontWeight: 800, width: 44, fontSize: 11, color: "text.secondary" }}>
              Punch
            </Typography>
            <BarCell value={punchWorst} axis="P" hideStatus />
          </Stack>
        </Stack>

        <Divider sx={{ my: 1 }} />

        {/* Worst Row BullseyeCell */}
        {worstRow ? (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, color: "text.secondary", mb: 0.5, display: "block" }}>
              Worst Row: R{worstRow?.Row}
            </Typography>
            <BullseyeCell
              yL={worstRow?.["상하치우침L"]}
              yC={worstRow?.["상하치우침C"]}
              yR={worstRow?.["상하치우침R"]}
              xL={worstRow?.["조립치우침L"]}
              xR={worstRow?.["조립치우침R"]}
              height={80}
            />
          </Box>
        ) : (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            디테일 로딩 중...
          </Typography>
        )}

        <Divider sx={{ my: 1 }} />

        {/* 진단 태그 */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {tags.length > 0 ? (
            tags.map((t, i) => {
              const name = typeof t === "string" ? t : t?.name ?? "";
              return (
                <Chip
                  key={i}
                  size="small"
                  label={name}
                  sx={{
                    height: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    background: "rgba(83,86,90,0.08)",
                    color: "text.secondary",
                  }}
                />
              );
            })
          ) : (
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
              태그 없음
            </Typography>
          )}
        </Stack>

        {/* Detail 보기 버튼 */}
        <Button
          size="small"
          variant="outlined"
          fullWidth
          onClick={onNavigate}
          sx={{ mt: 1.5, fontWeight: 700, fontSize: 12 }}
        >
          Detail 보기
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── 하단 비교 요약 테이블 ───
function CompareSummaryTable({ basketItems, sheets, details, rankMap }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const rows = useMemo(() => {
    return basketItems.map((key) => {
      const summary = sheets.find((s) => s.sheetKey === key);
      const detail = details[key] ?? {};
      const d = detail?.detail ?? detail;
      const diagnosis = d?.diagnosis ?? {};

      const worstX =
        asNumber(diagnosis?.worstX?.value ?? diagnosis?.worstX) ??
        asNumber(detail?.worstX) ??
        asNumber(summary?.worstX);
      const worstY =
        asNumber(diagnosis?.worstY?.value ?? diagnosis?.worstY) ??
        asNumber(detail?.worstY) ??
        asNumber(summary?.worstY);
      const status = diagnosis?.sheetStatus ?? summary?.status ?? "-";
      const score =
        detail?.qualityScore ?? summary?.qualityScore ?? diagnosis?.qualityScore;

      return {
        key,
        status,
        score,
        rank: rankMap[key],
        worstX,
        worstY,
      };
    });
  }, [basketItems, sheets, details, rankMap]);

  return (
    <Card variant="outlined" sx={{ borderRadius: CARD_RADIUS }}>
      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 11, color: CI_PRIMARY, mb: 0.5, display: "block" }}>
          비교 요약
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 700, color: "#53565A" }}>시트</th>
                <th style={{ textAlign: "center", padding: "4px 8px", fontWeight: 700, color: "#53565A" }}>상태</th>
                <th style={{ textAlign: "center", padding: "4px 8px", fontWeight: 700, color: "#53565A" }}>Rank</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700, color: "#53565A" }}>Score</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700, color: "#53565A" }}>WorstX</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700, color: "#53565A" }}>WorstY</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const xColor = cellColor(r.worstX, storeT.ng, storeT.check);
                const yColor = cellColor(r.worstY, storeT.ng, storeT.check);
                return (
                  <tr key={r.key} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <td style={{ padding: "4px 8px", fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {asText(r.key)}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                      <StatusChip status={r.status} />
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "center", fontWeight: 700, color: "#53565A" }}>
                      #{r.rank ?? "-"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {fmt2(r.score)}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: xColor }}>
                      {r.worstX != null ? `${r.worstX >= 0 ? "+" : ""}${fmt2(r.worstX)} mm` : "-"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: yColor }}>
                      {r.worstY != null ? `${r.worstY >= 0 ? "+" : ""}${fmt2(r.worstY)} mm` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── 빈 슬롯 (2×3 그리드 채움) ───
function EmptySlot() {
  return (
    <Box
      sx={{
        borderRadius: CARD_RADIUS,
        border: "2px dashed rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
      }}
    >
      <Typography variant="body2" sx={{ color: "text.disabled" }}>
        비어있음
      </Typography>
    </Box>
  );
}

function cellColor(val, ng, check) {
  if (val == null) return "#53565A";
  const abs = Math.abs(val);
  if (abs >= ng) return COLOR_NG;
  if (abs >= check) return COLOR_CHECK;
  return "#53565A";
}
