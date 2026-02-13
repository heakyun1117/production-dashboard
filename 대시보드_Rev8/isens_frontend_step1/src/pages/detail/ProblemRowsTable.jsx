import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";

import { fmt2, asText, asNumber } from "../../components/shared/fmt";
import BarCell from "../../components/shared/BarCell";
import useAppStore from "../../store/useAppStore";
import useThresholdStore from "../../store/useThresholdStore";

const HIGHLIGHT_BG = "rgba(23,28,143,0.10)";

/**
 * ProblemRowsTable — X/Y 탭 + Top5/All 토글 + 문제Row 필터 + 하이라이트/스크롤
 */
export default function ProblemRowsTable({ detail }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK = storeT.check;
  const NG = storeT.ng;

  const [axisTab, setAxisTab] = useState(0); // 0=X, 1=Y, 2=Punch
  const [showAll, setShowAll] = useState(false);
  const [problemOnly, setProblemOnly] = useState(false);

  const highlightedRowId = useAppStore((s) => s.highlightedRowId);
  const setHighlightedRowId = useAppStore((s) => s.setHighlightedRowId);

  // Row ref Map (rowId → DOM)
  const rowRefsMap = useRef(new Map());

  const root = detail ?? {};
  const d = root?.detail ?? root;

  const top5 = useMemo(() => d?.problemRowsTop5 ?? [], [d]);
  const punchTop3 = useMemo(() => d?.punchTop3 ?? [], [d]);
  const allRows = useMemo(() => (Array.isArray(root?.rows) ? root.rows : []), [root]);

  const top5X = useMemo(() => top5.filter((r) => String(r?.axis ?? "").toUpperCase() === "X"), [top5]);
  const top5Y = useMemo(() => top5.filter((r) => String(r?.axis ?? "").toUpperCase() === "Y"), [top5]);

  const currentTop5 = axisTab === 0 ? top5X : axisTab === 1 ? top5Y : punchTop3;
  const axisLabel = axisTab === 0 ? "X (좌우)" : axisTab === 1 ? "Y (상하)" : "Punch (타발)";

  // 문제 Row 필터
  const filteredRows = useMemo(() => {
    if (!problemOnly) return allRows;
    return allRows.filter((r) => {
      if (axisTab === 0) {
        const aL = Math.abs(asNumber(r?.["조립치우침L"]) ?? 0);
        const aR = Math.abs(asNumber(r?.["조립치우침R"]) ?? 0);
        return aL >= CHECK || aR >= CHECK;
      } else if (axisTab === 1) {
        const yL = Math.abs(asNumber(r?.["상하치우침L"]) ?? 0);
        const yC = Math.abs(asNumber(r?.["상하치우침C"]) ?? 0);
        const yR = Math.abs(asNumber(r?.["상하치우침R"]) ?? 0);
        return yL >= CHECK || yC >= CHECK || yR >= CHECK;
      } else {
        const pL = Math.abs(asNumber(r?.["타발홀L"]) ?? 0);
        const pR = Math.abs(asNumber(r?.["타발홀R"]) ?? 0);
        return pL >= CHECK || pR >= CHECK;
      }
    });
  }, [allRows, problemOnly, axisTab, CHECK]);

  // Row 클릭 → 하이라이트
  const onRowClick = useCallback(
    (rowId) => {
      setHighlightedRowId(rowId);
    },
    [setHighlightedRowId]
  );

  // highlightedRowId 변경 시 자동 스크롤
  useEffect(() => {
    if (highlightedRowId == null) return;
    const el = rowRefsMap.current.get(highlightedRowId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightedRowId]);

  // ref 콜백
  const setRowRef = useCallback((rowId, el) => {
    if (el) rowRefsMap.current.set(rowId, el);
    else rowRefsMap.current.delete(rowId);
  }, []);

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ flexWrap: "wrap" }}>
        <Tabs value={axisTab} onChange={(_, v) => setAxisTab(v)} sx={{ minHeight: 36 }}>
          <Tab label="X (좌우)" sx={{ minHeight: 36, fontWeight: 700 }} />
          <Tab label="Y (상하)" sx={{ minHeight: 36, fontWeight: 700 }} />
          <Tab label="Punch (타발)" sx={{ minHeight: 36, fontWeight: 700 }} />
        </Tabs>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
          }
          label={showAll ? "전체 12 Row" : "Top5만"}
          sx={{ userSelect: "none" }}
        />

        {showAll && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={problemOnly}
                onChange={(e) => setProblemOnly(e.target.checked)}
                color="warning"
              />
            }
            label="문제 Row만"
            sx={{ userSelect: "none" }}
          />
        )}
      </Stack>

      {showAll ? (
        /* 전체 12 Row 테이블 */
        filteredRows.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {problemOnly ? "문제 Row 없음 (모두 정상)" : "전체 Row 데이터가 없습니다."}
          </Typography>
        ) : (
          <Box sx={{ overflow: "auto", maxHeight: 440 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900, width: 70 }}>Row</TableCell>
                  {axisTab === 0 ? (
                    <>
                      <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>조립치우침L</TableCell>
                      <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>조립치우침R</TableCell>
                    </>
                  ) : axisTab === 1 ? (
                    <>
                      <TableCell sx={{ fontWeight: 900, minWidth: 260 }}>상하치우침L</TableCell>
                      <TableCell sx={{ fontWeight: 900, minWidth: 260 }}>상하치우침C</TableCell>
                      <TableCell sx={{ fontWeight: 900, minWidth: 260 }}>상하치우침R</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>타발홀L</TableCell>
                      <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>타발홀R</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((r, idx) => {
                  const rowId = r.Row ?? idx + 1;
                  const isHighlighted = highlightedRowId === rowId;
                  return (
                    <TableRow
                      key={`${rowId}-${idx}`}
                      ref={(el) => setRowRef(rowId, el)}
                      onClick={() => onRowClick(rowId)}
                      sx={{
                        cursor: "pointer",
                        background: isHighlighted ? HIGHLIGHT_BG : "transparent",
                        transition: "background 0.3s ease",
                        "&:hover": { background: isHighlighted ? HIGHLIGHT_BG : "rgba(0,0,0,0.02)" },
                      }}
                    >
                      <TableCell sx={{ fontWeight: 900 }}>{asText(rowId)}</TableCell>
                      {axisTab === 0 ? (
                        <>
                          <TableCell><BarCell value={r["조립치우침L"]} axis="X" /></TableCell>
                          <TableCell><BarCell value={r["조립치우침R"]} axis="X" /></TableCell>
                        </>
                      ) : axisTab === 1 ? (
                        <>
                          <TableCell><BarCell value={r["상하치우침L"]} axis="Y" /></TableCell>
                          <TableCell><BarCell value={r["상하치우침C"]} axis="Y" /></TableCell>
                          <TableCell><BarCell value={r["상하치우침R"]} axis="Y" /></TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell><BarCell value={r["타발홀L"]} axis="P" /></TableCell>
                          <TableCell><BarCell value={r["타발홀R"]} axis="P" /></TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )
      ) : (
        /* Top5 테이블 */
        currentTop5.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {axisLabel} Problem Row 없음
          </Typography>
        ) : (
          <Box sx={{ overflow: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900, width: 70 }}>Row</TableCell>
                  <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>값</TableCell>
                  <TableCell sx={{ fontWeight: 900, width: 100 }}>Side</TableCell>
                  <TableCell sx={{ fontWeight: 900, width: 100 }}>방향</TableCell>
                  <TableCell sx={{ fontWeight: 900, width: 100 }}>판정</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentTop5.map((it, idx) => {
                  const rowId = it.rowId ?? it.Row;
                  const isHighlighted = highlightedRowId === rowId;
                  return (
                    <TableRow
                      key={`${rowId}-${it.side}-${idx}`}
                      ref={(el) => setRowRef(rowId, el)}
                      onClick={() => onRowClick(rowId)}
                      sx={{
                        cursor: "pointer",
                        background: isHighlighted ? HIGHLIGHT_BG : "transparent",
                        transition: "background 0.3s ease",
                        "&:hover": { background: isHighlighted ? HIGHLIGHT_BG : "rgba(0,0,0,0.02)" },
                      }}
                    >
                      <TableCell sx={{ fontWeight: 900 }}>{asText(rowId)}</TableCell>
                      <TableCell>
                        <BarCell value={it.value} axis={axisTab === 0 ? "X" : axisTab === 1 ? "Y" : "P"} />
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{asText(it.side)}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{asText(it.direction)}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>
                        {asText(it.rowStatus ?? it.severity)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )
      )}
    </Stack>
  );
}
