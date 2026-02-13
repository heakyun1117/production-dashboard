import React, { useEffect, useMemo, useState } from "react";
import useThresholdStore from "../store/useThresholdStore";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
  FormControlLabel,
  Switch,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";

// [SPEC LOCK] 소수점 2자리(표시만)
function fmt2(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  const x = Math.round(Number(v) * 100) / 100;
  return (Object.is(x, -0) ? 0 : x).toFixed(2);
}

// ✅ 어떤 타입이 와도 React child로 안전하게 렌더링되도록 문자열로 변환
function asText(x) {
  if (x === null || x === undefined) return "-";
  const t = typeof x;
  if (t === "string" || t === "number" || t === "boolean") return String(x);
  if (Array.isArray(x)) return x.map(asText).join(", ");
  if (t === "object") {
    if ("summary" in x) return asText(x.summary);
    if ("text" in x) return asText(x.text);
    if ("name" in x) return asText(x.name);
    if ("type" in x) return asText(x.type);
    if ("axis" in x && "value" in x) return `${asText(x.axis)}:${asText(x.value)}`;
    if ("value" in x) return asText(x.value);
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }
  return String(x);
}

// ✅ 숫자처럼 써야 하는 값이 객체로 올 때 대비 (worstX/worstY 등)
function asNumber(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof x === "object" && x !== null) {
    if ("value" in x) return asNumber(x.value);
  }
  return null;
}

// ===============================
// ✅ 값 셀: 중앙(0) 기준 막대 + CHECK선(얇게)
// [SPEC LOCK] CHECK ±0.10 / NG ±0.15
// ===============================
function BarCell({ value, axis = "X" }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const NG = storeT.ng;
  const CHECK = storeT.check;

  const v = asNumber(value) ?? 0;
  const vClip = Math.max(-NG, Math.min(NG, v));

  const halfW = 64;
  const len = (Math.abs(vClip) / NG) * halfW;
  const isPos = vClip >= 0;

  const left = isPos ? halfW : halfW - len;
  const barW = Math.max(1, len);

  const checkPos = halfW + (CHECK / NG) * halfW;
  const checkNeg = halfW - (CHECK / NG) * halfW;

  const dirText =
    axis === "X" ? (v >= 0 ? "우측쏠림" : "좌측쏠림") : (v >= 0 ? "상측쏠림" : "하측쏠림");

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          position: "relative",
          width: halfW * 2,
          height: 14,
          borderRadius: 999,
          background: "rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
        title={`${dirText} · ${fmt2(v)} mm`}
      >
        {/* 0 line */}
        <Box
          sx={{
            position: "absolute",
            left: halfW,
            top: 0,
            bottom: 0,
            width: "1px",
            background: "rgba(0,0,0,0.18)",
          }}
        />

        {/* CHECK lines (얇게, 안 튀게) */}
        <Box
          sx={{
            position: "absolute",
            left: checkNeg,
            top: 2,
            bottom: 2,
            width: "1px",
            background: "rgba(0,0,0,0.12)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: checkPos,
            top: 2,
            bottom: 2,
            width: "1px",
            background: "rgba(0,0,0,0.12)",
          }}
        />

        {/* bar */}
        <Box
          sx={{
            position: "absolute",
            top: 2,
            height: 10,
            left,
            width: barW,
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            opacity: 0.9,
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ minWidth: 72, fontVariantNumeric: "tabular-nums" }}>
        {fmt2(v)}{" "}
        <Typography component="span" variant="caption" sx={{ color: "rgba(0,0,0,0.55)" }}>
          {dirText}
        </Typography>
      </Typography>
    </Box>
  );
}

// ===============================
// ✅ 미니 스트립 카드(기존 구조 유지)
// ===============================
function MiniStripCard({ mini, title }) {
  const NG = mini?.ng ?? 0.15;
  const db = mini?.deadband ?? 0.02;
  const points = Array.isArray(mini?.points) ? mini.points : [];

  const halfW = 120;
  const trackH = 46;

  const mapX = (v) => {
    const vc = Math.max(-NG, Math.min(NG, Number(v ?? 0)));
    return halfW + (vc / NG) * halfW;
  };

  const dbW = (db / NG) * halfW;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {title} · {mini?.direction ?? "-"}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.6)" }}>
              ng ±{fmt2(NG)} / db ±{fmt2(db)}
            </Typography>
          </Stack>

          <Box
            sx={{
              position: "relative",
              width: halfW * 2,
              height: trackH,
              borderRadius: 2,
              background: "rgba(0,0,0,0.03)",
              overflow: "hidden",
            }}
          >
            {/* 0 line */}
            <Box
              sx={{
                position: "absolute",
                left: halfW,
                top: 0,
                bottom: 0,
                width: "1px",
                background: "rgba(0,0,0,0.18)",
              }}
            />

            {/* deadband band */}
            <Box
              sx={{
                position: "absolute",
                left: halfW - dbW,
                width: dbW * 2,
                top: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.05)",
              }}
            />

            {/* points */}
            {points.map((p, idx) => {
              const x = mapX(p.value);
              const y = 12 + idx * 10; // 단순 배치
              return (
                <Box
                  key={`${p.pos}-${idx}`}
                  title={`${p.pos}: ${fmt2(p.value)} mm`}
                  sx={{
                    position: "absolute",
                    left: x - (p.isWorst ? 6 : 5),
                    top: y,
                    width: p.isWorst ? 12 : 10,
                    height: p.isWorst ? 12 : 10,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.55)",
                    border: p.isWorst ? "2px solid rgba(0,0,0,0.22)" : "1px solid rgba(0,0,0,0.18)",
                  }}
                />
              );
            })}
          </Box>

          {/* flags */}
          <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap" }}>
            {(mini?.flags ?? []).map((f, i) => (
              <Chip
                key={i}
                size="small"
                label={`${f.type}: ${f.text} (${fmt2(f.value)})`}
                sx={{ background: "rgba(0,0,0,0.06)" }}
              />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function SheetDetail({ detail, selected, jobId }) {
  const [tab, setTab] = useState(0);
  const [showAllRows, setShowAllRows] = useState(false);

  // 시트 변경 시 탭/토글 초기화
  const selectedKey = selected?.sheetKey ?? null;
  useEffect(() => { setTab(0); setShowAllRows(false); }, [selectedKey]);

  // App.jsx에서 setDetail(d)로 "전체 raw"를 넣는 구조
  const root = detail ?? null;           // { sheetKey, meta, rows, detail, ... }
  const d = root?.detail ?? root ?? {};  // 실제 디테일(진단/Top5/mini)

  const diagnosis = d?.diagnosis ?? {};
  const miniX = d?.mini?.X ?? d?.mini?.x ?? d?.miniStrip?.X ?? d?.miniStrip?.x ?? null;
  const miniY = d?.mini?.Y ?? d?.mini?.y ?? d?.miniStrip?.Y ?? d?.miniStrip?.y ?? null;

  // ✅ Top5 원본
  const top5 = useMemo(() => d?.problemRowsTop5 ?? [], [d]);

  // ✅ Top5 axis 분리
  const top5X = useMemo(() => top5.filter((r) => String(r?.axis ?? "").toUpperCase() === "X"), [top5]);
  const top5Y = useMemo(() => top5.filter((r) => String(r?.axis ?? "").toUpperCase() === "Y"), [top5]);

  // ✅ 전체(12 row)
  const allRows = useMemo(() => (Array.isArray(root?.rows) ? root.rows : []), [root]);

  // Punch
  const punchTop = useMemo(() => d?.punchTop3 ?? [], [d]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* ✅ 선택된 시트 고정 헤더 */}
      <Box sx={{ position: "sticky", top: 12, zIndex: 5 }}>
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            backdropFilter: "blur(8px)",
            background: "rgba(255,255,255,0.88)",
          }}
        >
          <CardContent sx={{ py: 1.1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                {asText(selected?.sheetKey ?? root?.sheetKey ?? "선택 시트")}
              </Typography>

              <Chip size="small" label={`Status: ${asText(diagnosis?.sheetStatus ?? selected?.status ?? "-")}`} />
              <Chip size="small" label={`Score: ${fmt2(root?.qualityScore ?? selected?.qualityScore ?? diagnosis?.qualityScore)}`} />

              <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />

              <Chip size="small" label={(() => { const v = asNumber(diagnosis?.worstX) ?? asNumber(root?.worstX); return v != null ? `WorstX: ${fmt2(v)} mm` : "WorstX: -"; })()} />
              <Chip size="small" label={(() => { const v = asNumber(diagnosis?.worstY) ?? asNumber(root?.worstY); return v != null ? `WorstY: ${fmt2(v)} mm` : "WorstY: -"; })()} />

              <Box sx={{ flex: 1 }} />
              <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.55)" }}>
                Job: {asText(jobId ?? "-")}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* ✅ 디테일 카드 */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  시트 디테일
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.7)" }}>
                  {asText(diagnosis?.summary ?? "좌측 시트에서 선택해 주세요.")}
                </Typography>
              </Box>

              <Chip label={diagnosis?.sheetStatus ?? "-"} sx={{ fontWeight: 900, background: "rgba(0,0,0,0.06)" }} />
            </Stack>

            <Divider />

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40 }}>
              <Tab label="Overview" sx={{ minHeight: 40 }} />
              <Tab label="X" sx={{ minHeight: 40 }} />
              <Tab label="Y" sx={{ minHeight: 40 }} />
              <Tab label="Punch" sx={{ minHeight: 40 }} />
            </Tabs>

            {(tab === 1 || tab === 2) && (
              <FormControlLabel
                control={<Switch size="small" checked={showAllRows} onChange={(e) => setShowAllRows(e.target.checked)} />}
                label={showAllRows ? "전체 12개 Row 보기" : "Problem Top5만 보기"}
                sx={{ mt: 0.5, mb: 0.5, userSelect: "none" }}
              />
            )}

            {/* ===================== Overview ===================== */}
            {tab === 0 && (
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.5 }}>
                      핵심 지표
                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      <Chip label={(() => { const v = asNumber(diagnosis?.worstX) ?? asNumber(root?.worstX); return v != null ? `WorstX: ${fmt2(v)} mm` : "WorstX: -"; })()} />
                      <Chip label={(() => { const v = asNumber(diagnosis?.worstY) ?? asNumber(root?.worstY); return v != null ? `WorstY: ${fmt2(v)} mm` : "WorstY: -"; })()} />
                      <Chip label={`Tags: ${asText(diagnosis?.tags ?? "-")}`} />
                    </Stack>

                    <Typography variant="subtitle2" sx={{ fontWeight: 900, mt: 2, mb: 0.5 }}>
                      Problem Rows Top5 (요약)
                    </Typography>

                    <Stack spacing={1.2}>
                      <Box>
                        <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.6)", fontWeight: 800 }}>
                          X (좌우)
                        </Typography>
                        <Stack spacing={0.6} sx={{ mt: 0.5 }}>
                          {top5X.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                              (X Top5 없음)
                            </Typography>
                          ) : (
                            top5X.map((r, idx) => (
                              <Card key={`${r.rowId}-${r.side}-${idx}`} variant="outlined" sx={{ borderRadius: 2 }}>
                                <CardContent sx={{ py: 1.0, "&:last-child": { pb: 1.0 } }}>
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    Row {asText(r.rowId)} · {asText(r.axis)}-{asText(r.side)} · {asText(r.direction)} ·{" "}
                                    {fmt2(r.value)} mm · {asText(r.rowStatus ?? r.severity)}
                                  </Typography>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </Stack>
                      </Box>

                      <Box>
                        <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.6)", fontWeight: 800 }}>
                          Y (상하)
                        </Typography>
                        <Stack spacing={0.6} sx={{ mt: 0.5 }}>
                          {top5Y.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                              (Y Top5 없음)
                            </Typography>
                          ) : (
                            top5Y.map((r, idx) => (
                              <Card key={`${r.rowId}-${r.side}-${idx}`} variant="outlined" sx={{ borderRadius: 2 }}>
                                <CardContent sx={{ py: 1.0, "&:last-child": { pb: 1.0 } }}>
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    Row {asText(r.rowId)} · {asText(r.axis)}-{asText(r.side)} · {asText(r.direction)} ·{" "}
                                    {fmt2(r.value)} mm · {asText(r.rowStatus ?? r.severity)}
                                  </Typography>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>

                  <Stack spacing={1.5} sx={{ width: { xs: "100%", md: 420 } }}>
                    {miniX ? <MiniStripCard mini={miniX} title="X 미니 스트립" /> : null}
                    {miniY ? <MiniStripCard mini={miniY} title="Y 미니 스트립" /> : null}
                  </Stack>
                </Stack>
              </Stack>
            )}

            {/* ===================== X ===================== */}
            {tab === 1 && (
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                    X (좌우) · {showAllRows ? "전체 12개 Row" : "Problem Rows Top5"}
                  </Typography>

                  {showAllRows ? (
                    allRows.length === 0 ? (
                      <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                        전체 Row 데이터(rows)가 없습니다.
                      </Typography>
                    ) : (
                      <Box sx={{ overflow: "auto" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 900, width: 80 }}>Row</TableCell>
                              <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>조립치우침L</TableCell>
                              <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>조립치우침R</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {allRows.map((r, idx) => (
                              <TableRow key={`${r.Row ?? idx}-${idx}`}>
                                <TableCell sx={{ fontWeight: 900 }}>{asText(r.Row ?? idx + 1)}</TableCell>
                                <TableCell><BarCell value={r["조립치우침L"]} axis="X" /></TableCell>
                                <TableCell><BarCell value={r["조립치우침R"]} axis="X" /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    )
                  ) : (
                    top5X.length === 0 ? (
                      <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                        X축 Problem Row 데이터가 없습니다. (Y축이 주 원인일 가능성이 큽니다)
                      </Typography>
                    ) : (
                      <Box sx={{ overflow: "auto" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 900, width: 80 }}>Row</TableCell>
                              <TableCell sx={{ fontWeight: 900, minWidth: 260 }}>값</TableCell>
                              <TableCell sx={{ fontWeight: 900, width: 110 }}>Side</TableCell>
                              <TableCell sx={{ fontWeight: 900, width: 140 }}>판정</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {top5X.map((it, idx) => (
                              <TableRow key={`${it.rowId}-${it.side}-${idx}`}>
                                <TableCell sx={{ fontWeight: 900 }}>{asText(it.rowId)}</TableCell>
                                <TableCell><BarCell value={it.value} axis="X" /></TableCell>
                                <TableCell sx={{ color: "rgba(0,0,0,0.7)" }}>{asText(it.side)}</TableCell>
                                <TableCell sx={{ color: "rgba(0,0,0,0.7)" }}>
                                  {asText(it.rowStatus ?? it.severity ?? it.direction)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {/* ===================== Y ===================== */}
            {tab === 2 && (
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                    Y (상하) · {showAllRows ? "전체 12개 Row" : "Problem Rows Top5"}
                  </Typography>

                  {showAllRows ? (
                    allRows.length === 0 ? (
                      <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                        전체 Row 데이터(rows)가 없습니다.
                      </Typography>
                    ) : (
                      <Box sx={{ overflow: "auto" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 900, width: 80 }}>Row</TableCell>
                              <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>상하치우침L</TableCell>
                              <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>상하치우침C</TableCell>
                              <TableCell sx={{ fontWeight: 900, minWidth: 300 }}>상하치우침R</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {allRows.map((r, idx) => (
                              <TableRow key={`${r.Row ?? idx}-${idx}`}>
                                <TableCell sx={{ fontWeight: 900 }}>{asText(r.Row ?? idx + 1)}</TableCell>
                                <TableCell><BarCell value={r["상하치우침L"]} axis="Y" /></TableCell>
                                <TableCell><BarCell value={r["상하치우침C"]} axis="Y" /></TableCell>
                                <TableCell><BarCell value={r["상하치우침R"]} axis="Y" /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    )
                  ) : (
                    top5Y.length === 0 ? (
                      <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                        Y축 Problem Row 데이터가 없습니다. (X축이 주 원인일 가능성이 큽니다)
                      </Typography>
                    ) : (
                      <Box sx={{ overflow: "auto" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 900, width: 80 }}>Row</TableCell>
                              <TableCell sx={{ fontWeight: 900, minWidth: 260 }}>값</TableCell>
                              <TableCell sx={{ fontWeight: 900, width: 110 }}>Side</TableCell>
                              <TableCell sx={{ fontWeight: 900, width: 140 }}>판정</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {top5Y.map((it, idx) => (
                              <TableRow key={`${it.rowId}-${it.side}-${idx}`}>
                                <TableCell sx={{ fontWeight: 900 }}>{asText(it.rowId)}</TableCell>
                                <TableCell><BarCell value={it.value} axis="Y" /></TableCell>
                                <TableCell sx={{ color: "rgba(0,0,0,0.7)" }}>{asText(it.side)}</TableCell>
                                <TableCell sx={{ color: "rgba(0,0,0,0.7)" }}>
                                  {asText(it.rowStatus ?? it.severity ?? it.direction)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {/* ===================== Punch ===================== */}
            {tab === 3 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  Punch Top3
                </Typography>
                {punchTop.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                    (Punch Top3 없음)
                  </Typography>
                ) : (
                  punchTop.map((p, idx) => (
                    <Chip
                      key={`${p.rowId}-${p.side}-${idx}`}
                      label={`Row ${asText(p.rowId)} · ${asText(p.side)} · ${asText(p.direction)} · ${fmt2(p.value)} mm · ${asText(
                        p.rowStatus ?? p.severity
                      )}`}
                      sx={{ justifyContent: "flex-start" }}
                    />
                  ))
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
