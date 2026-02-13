import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import useAppStore from "../store/useAppStore";
import { getSheetDetail } from "../api/step1";

import DetailNavigation from "./detail/DetailNavigation.jsx";
import DetailHeader from "./detail/DetailHeader.jsx";
import CauseRecommendationBlock from "./detail/CauseRecommendationBlock.jsx";
import ProblemRowsTable from "./detail/ProblemRowsTable.jsx";
import YSpatialPanel from "./detail/YSpatialPanel.jsx";

/**
 * DetailPage — 시트 디테일 페이지 (Phase 1.6d)
 * URL: /#/detail/:sheetKey
 *
 * 단일 컬럼 레이아웃:
 *   Navigation → Header → CauseBlock → ProblemRows → 공간 분포 (3-Zone BullseyeCell)
 */
export default function DetailPage() {
  const { sheetKey } = useParams();
  const seqRef = useRef(0);
  const [loading, setLoading] = useState(false);

  const jobId = useAppStore((s) => s.jobId);
  const selectedDetail = useAppStore((s) => s.selectedDetail);
  const sheets = useAppStore((s) => s.sheets);
  const sortedSheetKeys = useAppStore((s) => s.sortedSheetKeys);
  const setSelectedSheet = useAppStore((s) => s.setSelectedSheet);
  const setSelectedDetail = useAppStore((s) => s.setSelectedDetail);
  const setBusy = useAppStore((s) => s.setBusy);
  const setMessage = useAppStore((s) => s.setMessage);
  const clearHighlightedRow = useAppStore((s) => s.clearHighlightedRow);

  // sheetKey가 바뀌면 디테일 로드 + 하이라이트 초기화
  useEffect(() => {
    if (!sheetKey || !jobId) return;

    const decodedKey = decodeURIComponent(sheetKey);
    setSelectedSheet(decodedKey);
    clearHighlightedRow();
    setSelectedDetail(null);  // 이전 시트 데이터 즉시 클리어

    const seq = ++seqRef.current;
    setLoading(true);
    setBusy(true);
    setMessage("시트 디테일 불러오는 중...");

    getSheetDetail(jobId, decodedKey)
      .then((d) => {
        if (seq !== seqRef.current) return;
        setSelectedDetail(d);
        setMessage("디테일 로드 완료");
      })
      .catch((e) => {
        if (seq !== seqRef.current) return;
        setMessage(`디테일 로드 실패: ${e?.message ?? e}`);
        setSelectedDetail(null);
      })
      .finally(() => {
        if (seq === seqRef.current) {
          setBusy(false);
          setLoading(false);
        }
      });
  }, [sheetKey, jobId, setSelectedSheet, setSelectedDetail, setBusy, setMessage, clearHighlightedRow]);

  // ── 모든 hooks는 여기 위에서 호출 완료 ──
  // 파생 데이터 (hooks 규칙: 항상 동일 순서로 호출)
  const decodedKey = sheetKey ? decodeURIComponent(sheetKey) : "";
  const selectedSummary = useMemo(
    () => sheets.find((s) => s.sheetKey === decodedKey) ?? null,
    [sheets, decodedKey]
  );
  const rank = useMemo(
    () => sortedSheetKeys.indexOf(decodedKey) + 1 || null,
    [sortedSheetKeys, decodedKey]
  );
  const root = selectedDetail ?? {};
  const allRows = useMemo(
    () => (Array.isArray(root?.rows) ? root.rows : []),
    [root]
  );

  // 아코디언 공통 스타일
  const accordionSx = {
    borderRadius: "12px !important",
    "&:before": { display: "none" },
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  };

  // ── 조건부 렌더링 (hooks 이후에만 early return) ──

  // jobId 없으면 안내
  if (!jobId) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.secondary" }}>
        <Typography variant="h6">CSV를 먼저 업로드하세요</Typography>
      </Box>
    );
  }

  // sheetKey 없으면 안내
  if (!sheetKey) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.secondary" }}>
        <Typography variant="h6">Explorer에서 시트를 선택해주세요</Typography>
      </Box>
    );
  }

  // 데이터 로딩 중이면 로딩 표시
  if (loading || !selectedDetail) {
    return (
      <Stack spacing={1.5} sx={{ pb: 3 }}>
        <DetailNavigation currentKey={decodedKey} />
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 8, color: "text.secondary" }}>
          <Stack alignItems="center" spacing={1.5}>
            <CircularProgress size={32} />
            <Typography variant="body2">시트 디테일 불러오는 중...</Typography>
          </Stack>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      {/* 네비게이션 */}
      <DetailNavigation currentKey={decodedKey} />

      {/* ① 헤더 카드 (항상 노출) */}
      <DetailHeader
        detail={selectedDetail}
        selected={selectedSummary}
        jobId={jobId}
        rank={rank}
      />

      {/* ② 원인태그 + 조정추천 (항상 노출) */}
      <CauseRecommendationBlock detail={selectedDetail} />

      {/* ③ Problem Rows (기본 펼침 아코디언) */}
      <Accordion defaultExpanded sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            원인 분석 & Problem Rows
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ProblemRowsTable detail={selectedDetail} />
        </AccordionDetails>
      </Accordion>

      {/* ④ 공간 분포 — 3-Zone BullseyeCell (Worst5 + Best5) */}
      <Accordion defaultExpanded sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            공간 분포
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <YSpatialPanel rows={allRows} />
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
