import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
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

export default function CauseRecommendation({ detail }) {
  const [axisTab, setAxisTab] = useState(0); // 0=X, 1=Y
  const [showAll, setShowAll] = useState(false);

  const root = detail ?? {};
  const d = root?.detail ?? root;

  const top5 = useMemo(() => d?.problemRowsTop5 ?? [], [d]);
  const allRows = useMemo(() => (Array.isArray(root?.rows) ? root.rows : []), [root]);

  const top5X = useMemo(() => top5.filter((r) => String(r?.axis ?? "").toUpperCase() === "X"), [top5]);
  const top5Y = useMemo(() => top5.filter((r) => String(r?.axis ?? "").toUpperCase() === "Y"), [top5]);

  const currentTop5 = axisTab === 0 ? top5X : top5Y;
  const axisLabel = axisTab === 0 ? "X (좌우)" : "Y (상하)";

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Tabs value={axisTab} onChange={(_, v) => setAxisTab(v)} sx={{ minHeight: 36 }}>
          <Tab label="X (좌우)" sx={{ minHeight: 36, fontWeight: 700 }} />
          <Tab label="Y (상하)" sx={{ minHeight: 36, fontWeight: 700 }} />
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
      </Stack>

      {showAll ? (
        /* 전체 12 Row 테이블 */
        allRows.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            전체 Row 데이터(rows)가 없습니다.
          </Typography>
        ) : (
          <Box sx={{ overflow: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900, width: 70 }}>Row</TableCell>
                  {axisTab === 0 ? (
                    <>
                      <TableCell sx={{ fontWeight: 900, minWidth: 260 }}>조립치우침L</TableCell>
                      <TableCell sx={{ fontWeight: 900, minWidth: 260 }}>조립치우침R</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell sx={{ fontWeight: 900, minWidth: 220 }}>상하치우침L</TableCell>
                      <TableCell sx={{ fontWeight: 900, minWidth: 220 }}>상하치우침C</TableCell>
                      <TableCell sx={{ fontWeight: 900, minWidth: 220 }}>상하치우침R</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {allRows.map((r, idx) => (
                  <TableRow key={`${r.Row ?? idx}-${idx}`}>
                    <TableCell sx={{ fontWeight: 900 }}>{asText(r.Row ?? idx + 1)}</TableCell>
                    {axisTab === 0 ? (
                      <>
                        <TableCell><BarCell value={r["조립치우침L"]} axis="X" /></TableCell>
                        <TableCell><BarCell value={r["조립치우침R"]} axis="X" /></TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell><BarCell value={r["상하치우침L"]} axis="Y" /></TableCell>
                        <TableCell><BarCell value={r["상하치우침C"]} axis="Y" /></TableCell>
                        <TableCell><BarCell value={r["상하치우침R"]} axis="Y" /></TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
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
                  <TableCell sx={{ fontWeight: 900, minWidth: 260 }}>값</TableCell>
                  <TableCell sx={{ fontWeight: 900, width: 100 }}>Side</TableCell>
                  <TableCell sx={{ fontWeight: 900, width: 100 }}>방향</TableCell>
                  <TableCell sx={{ fontWeight: 900, width: 100 }}>판정</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentTop5.map((it, idx) => (
                  <TableRow key={`${it.rowId}-${it.side}-${idx}`}>
                    <TableCell sx={{ fontWeight: 900 }}>{asText(it.rowId)}</TableCell>
                    <TableCell>
                      <BarCell value={it.value} axis={axisTab === 0 ? "X" : "Y"} />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{asText(it.side)}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{asText(it.direction)}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>
                      {asText(it.rowStatus ?? it.severity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )
      )}
    </Stack>
  );
}
