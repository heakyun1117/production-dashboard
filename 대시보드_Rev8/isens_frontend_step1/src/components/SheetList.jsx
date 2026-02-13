import React, { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { Box, Checkbox, Chip, Stack, Tooltip, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { fmt2, asText } from "./shared/fmt";
import DivergingBarCell from "./shared/DivergingBarCell";
import StatusChip from "./shared/StatusChip";
import useBasketStore from "../store/useBasketStore";
import { COLOR_NG, COLOR_CHECK, CI_PRIMARY, CI_GRAY } from "./shared/colors";
import { parseSheetKey } from "../utils/sheetKeyParser";

// 좌측 상태바 색상
const STATUS_BORDER = {
  NG:    COLOR_NG,
  CHECK: COLOR_CHECK,
  OK:    "transparent",
};

/**
 * MainCellRenderer — 1줄 카드형 메인 컬럼
 * [StatusChip] sheetKey(bold, 말줄임)
 * (메타 정보는 별도 컬럼으로 분리)
 */
function MainCellRenderer({ data }) {
  const status = data?.status ?? "-";
  const sheetKey = data?.sheetKey ?? "-";

  return (
    <Box sx={{ py: 0.3, lineHeight: 1.3 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <StatusChip status={status} />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
            flex: 1,
            minWidth: 0,
          }}
          title={sheetKey}
        >
          {sheetKey}
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * FlagCellRenderer — C_ASYM / diag 존재 여부 표시
 * 태그 배열에서 해당 항목이 있으면 체크 아이콘 표시
 */
function FlagCellRenderer({ data }) {
  const tags = Array.isArray(data?.tags) ? data.tags : [];

  const hasTag = (name) =>
    tags.some((t) => {
      const tagName = typeof t === "string" ? t : t?.name ?? t?.type ?? "";
      return tagName === name;
    });

  const hasCAsym = hasTag("C_ASYM");
  const hasDiag = hasTag("diag") || hasTag("TILT");

  return (
    <Stack spacing={0.3} alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
      {/* 중앙비대칭 */}
      <Stack direction="row" spacing={0.3} alignItems="center">
        <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 600, color: "text.secondary", width: 28 }}>
          비대칭
        </Typography>
        {hasCAsym ? (
          <CheckCircleOutlineIcon sx={{ fontSize: 14, color: COLOR_CHECK }} />
        ) : (
          <Typography variant="caption" sx={{ fontSize: 11, color: "rgba(0,0,0,0.15)" }}>—</Typography>
        )}
      </Stack>
      {/* 사선(기울기) */}
      <Stack direction="row" spacing={0.3} alignItems="center">
        <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 600, color: "text.secondary", width: 28 }}>
          사선
        </Typography>
        {hasDiag ? (
          <CheckCircleOutlineIcon sx={{ fontSize: 14, color: COLOR_CHECK }} />
        ) : (
          <Typography variant="caption" sx={{ fontSize: 11, color: "rgba(0,0,0,0.15)" }}>—</Typography>
        )}
      </Stack>
    </Stack>
  );
}

/**
 * MetricsCellRenderer — 지표 컬럼
 * WorstX/Y 미니바 + 태그 (저채도)
 */
function MetricsCellRenderer({ data }) {
  const tags = Array.isArray(data?.tags) ? data.tags : [];

  return (
    <Box sx={{ py: 0.3 }}>
      <Stack spacing={0.2}>
        {/* WorstX */}
        <Stack direction="row" spacing={0.3} alignItems="center">
          <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 700, color: "text.secondary", width: 14 }}>
            X
          </Typography>
          <DivergingBarCell value={data?.worstX} axis="X" compact />
        </Stack>

        {/* WorstY */}
        <Stack direction="row" spacing={0.3} alignItems="center">
          <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 700, color: "text.secondary", width: 14 }}>
            Y
          </Typography>
          <DivergingBarCell value={data?.worstY} axis="Y" compact />
        </Stack>
      </Stack>

      {/* 태그 */}
      {tags.length > 0 && (
        <Stack direction="row" spacing={0.3} sx={{ mt: 0.3, flexWrap: "wrap" }}>
          {tags.slice(0, 3).map((t, idx) => (
            <Chip
              key={`${t}-${idx}`}
              size="small"
              label={typeof t === "string" ? t : asText(t)}
              sx={{
                height: 16,
                fontSize: 9,
                fontWeight: 600,
                background: "rgba(83,86,90,0.08)",
                color: CI_GRAY,
              }}
            />
          ))}
          {tags.length > 3 && (
            <Chip
              size="small"
              label={`+${tags.length - 3}`}
              sx={{ height: 16, fontSize: 9, background: "rgba(83,86,90,0.06)" }}
            />
          )}
        </Stack>
      )}
    </Box>
  );
}

export default function SheetList({ sheets, rankMap, selectedKey, onSelect, onDoubleClick }) {
  const basketItems = useBasketStore((s) => s.basketItems);
  const addToBasket = useBasketStore((s) => s.addToBasket);
  const removeFromBasket = useBasketStore((s) => s.removeFromBasket);

  const rows = useMemo(
    () => (sheets ?? []).map((s) => {
      const parsed = parseSheetKey(s.sheetKey);
      return {
        ...s,
        id: s.sheetKey,
        rank: rankMap?.[s.sheetKey] ?? "-",
        // meta 필드 우선, 없으면 파싱값 사용
        col_일자: s.meta?.일자 ?? s.meta?.날짜 ?? parsed.일자,
        col_라인: s.meta?.라인명 ?? parsed.라인,
        col_구분: parsed.구분,
        col_lot: s.meta?.로트명 ?? parsed.lot,
        col_sn: parsed.sn,
      };
    }),
    [sheets, rankMap]
  );

  const colDefs = useMemo(
    () => [
      // 담기 체크박스
      {
        headerName: "",
        field: "__basket",
        width: 52,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (p) => {
          const key = p.data?.sheetKey;
          const inBasket = basketItems.includes(key);
          const full = basketItems.length >= 6 && !inBasket;
          return (
            <Tooltip title={full ? "바구니 최대 6개" : inBasket ? "바구니에서 제거" : "비교 바구니에 담기"} arrow>
              <Checkbox
                size="small"
                checked={inBasket}
                disabled={full}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  if (inBasket) removeFromBasket(key);
                  else addToBasket(key);
                }}
                sx={{ p: 0 }}
              />
            </Tooltip>
          );
        },
      },
      // Rank
      {
        headerName: "#",
        field: "rank",
        width: 48,
        sortable: true,
        filter: false,
        cellRenderer: (p) => (
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, fontSize: 12, color: "text.secondary", lineHeight: "68px" }}
          >
            #{p.data?.rank}
          </Typography>
        ),
      },
      // 스코어
      {
        headerName: "스코어",
        field: "qualityScore",
        width: 60,
        sortable: true,
        filter: false,
        cellRenderer: (p) => {
          const score = p.data?.qualityScore;
          if (score == null) return null;
          return (
            <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
              <Chip
                size="small"
                label={`${Math.round(score)}`}
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  background: `${CI_PRIMARY}0F`,
                  color: CI_PRIMARY,
                  "& .MuiChip-label": { px: 0.5 },
                }}
              />
            </Box>
          );
        },
      },
      // 시트 (1줄 — StatusChip + sheetKey)
      {
        headerName: "시트",
        field: "sheetKey",
        flex: 1,
        minWidth: 180,
        cellRenderer: (p) => <MainCellRenderer data={p.data} />,
        sortable: true,
      },
      // 일자
      {
        headerName: "일자",
        field: "col_일자",
        width: 90,
        sortable: true,
        cellRenderer: (p) => (
          <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", lineHeight: "68px" }}>
            {p.data?.col_일자 || "-"}
          </Typography>
        ),
      },
      // 라인
      {
        headerName: "라인",
        field: "col_라인",
        width: 80,
        sortable: true,
        cellRenderer: (p) => (
          <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", lineHeight: "68px" }}>
            {p.data?.col_라인 || "-"}
          </Typography>
        ),
      },
      // 구분 (생산/샘플)
      {
        headerName: "구분",
        field: "col_구분",
        width: 72,
        sortable: true,
        cellRenderer: (p) => {
          const v = p.data?.col_구분;
          if (!v) return <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", lineHeight: "68px" }}>-</Typography>;
          return (
            <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
              <Chip
                size="small"
                label={v}
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 600,
                  background: v === "생산" ? "rgba(120,190,32,0.10)" : "rgba(23,28,143,0.08)",
                  color: v === "생산" ? "#4a7c10" : CI_PRIMARY,
                  "& .MuiChip-label": { px: 0.5 },
                }}
              />
            </Box>
          );
        },
      },
      // Lot
      {
        headerName: "Lot",
        field: "col_lot",
        width: 100,
        sortable: true,
        cellRenderer: (p) => (
          <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", lineHeight: "68px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }} title={p.data?.col_lot || ""}>
            {p.data?.col_lot || "-"}
          </Typography>
        ),
      },
      // S/N
      {
        headerName: "S/N",
        field: "col_sn",
        width: 70,
        sortable: true,
        cellRenderer: (p) => (
          <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", lineHeight: "68px" }}>
            {p.data?.col_sn || "-"}
          </Typography>
        ),
      },
      // 비대칭 / 사선 플래그
      {
        headerName: "패턴",
        field: "__flags",
        width: 80,
        sortable: false,
        filter: false,
        cellRenderer: (p) => <FlagCellRenderer data={p.data} />,
      },
      // 지표 (WorstX/Y + 태그)
      {
        headerName: "지표",
        field: "worstX",
        width: 320,
        cellRenderer: (p) => <MetricsCellRenderer data={p.data} />,
        sortable: false,
      },
      // 메모
      {
        headerName: "메모",
        field: "memo",
        width: 140,
        sortable: false,
        filter: "agTextColumnFilter",
        valueGetter: (p) => p.data?.meta?.메모 ?? "",
        cellRenderer: (p) => {
          const memo = p.data?.meta?.메모 ?? "";
          if (!memo) return null;
          return (
            <Typography
              variant="caption"
              sx={{
                fontSize: 11,
                color: "text.secondary",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
                lineHeight: "68px",
              }}
              title={memo}
            >
              {memo}
            </Typography>
          );
        },
      },
    ],
    [basketItems, addToBasket, removeFromBasket]
  );

  // 좌측 3px 상태바
  const getRowStyle = (params) => {
    const st = params.data?.status;
    const borderColor = STATUS_BORDER[st] ?? "transparent";
    return {
      borderLeft: `3px solid ${borderColor}`,
    };
  };

  return (
    <Box sx={{ height: "100%", width: "100%" }} className="ag-theme-alpine">
      <AgGridReact
        theme="legacy"
        rowData={rows}
        columnDefs={colDefs}
        defaultColDef={{
          resizable: true,
          filter: true,
          valueFormatter: (p) => {
            const v = p.value;
            if (v === null || v === undefined) return "";
            if (typeof v === "object") {
              try { return JSON.stringify(v); } catch { return String(v); }
            }
            return String(v);
          },
        }}
        rowSelection={undefined}
        getRowId={(p) => p.data.id}
        getRowStyle={getRowStyle}
        onRowClicked={(e) => {
          onSelect?.(e.data);
        }}
        onRowDoubleClicked={(e) => onDoubleClick?.(e.data)}
        rowHeight={68}
        headerHeight={36}
        suppressCellFocus={true}
      />
    </Box>
  );
}
