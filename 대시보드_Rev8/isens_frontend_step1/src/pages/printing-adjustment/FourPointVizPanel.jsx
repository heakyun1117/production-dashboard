import React, { useState } from "react";
import { Box, Chip, FormControlLabel, Checkbox, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { STATUS_STYLES } from "../../components/shared/colors";
import { classifyPoint, POINTS } from "../../utils/printingOptimizationEngine";

// ── SVG 상수 ──
const SVG_W = 600;
const SVG_H = 620;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const SCALE = 360;
const RING_R = 8;
const BOX_LEVELS = [0.05, 0.10, 0.15];
const POLY_ORDER = [1, 3, 4, 2, 1];

const DEFAULT_W = 294.6;
const DEFAULT_H = 320.0;

const C_CARBON = "#EC4899";
const C_INS = "#22C55E";

// ── 상태 표시 헬퍼 (MUST → NG 매핑) ──
const displayLabel = (tag) => tag === "MUST" ? "NG" : tag;

function badgeStyle(tag) {
  const key = tag === "MUST" ? "NG" : tag;
  return {
    bg: STATUS_STYLES[key]?.bg ?? STATUS_STYLES.OK.bg,
    fg: STATUS_STYLES[key]?.text ?? STATUS_STYLES.OK.text,
  };
}

function getAnchors() {
  const ratio = DEFAULT_H / DEFAULT_W;
  const halfX = 160;
  const halfY = halfX * ratio;
  return {
    1: { x: CX - halfX, y: CY - halfY },
    2: { x: CX - halfX, y: CY + halfY },
    3: { x: CX + halfX, y: CY - halfY },
    4: { x: CX + halfX, y: CY + halfY },
  };
}

function fmtVal(v) {
  return (v >= 0 ? "+" : "") + v.toFixed(3);
}

const ANCHORS = getAnchors();

/**
 * FourPointVizPanel — 단일 패널, 3-state 토글 (BEFORE/AFTER/조립추천) + CSS transition
 */
export default function FourPointVizPanel({
  carbonBefore, carbonAfter, insBefore, insAfter,
  carbonAssembly, insAssembly,
  carbonAssemblyOpt, insAssemblyOpt,
}) {
  const [showCarbon, setShowCarbon] = useState(true);
  const [showIns, setShowIns] = useState(true);
  const [viewMode, setViewMode] = useState("before"); // "before" | "after" | "assembly" | "assemblyOpt"

  // 현재 표시 데이터 선택
  const carbonData = viewMode === "assemblyOpt" ? (carbonAssemblyOpt ?? carbonBefore)
                   : viewMode === "assembly" ? (carbonAssembly ?? carbonBefore)
                   : viewMode === "after" ? carbonAfter : carbonBefore;
  const insData = viewMode === "assemblyOpt" ? (insAssemblyOpt ?? insBefore)
                : viewMode === "assembly" ? (insAssembly ?? insBefore)
                : viewMode === "after" ? insAfter : insBefore;

  const hasAssembly = !!(carbonAssembly || insAssembly);
  const hasAssemblyOpt = !!(carbonAssemblyOpt || insAssemblyOpt);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* 토글 컨트롤 */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <FormControlLabel
          control={
            <Checkbox checked={showCarbon} onChange={(e) => setShowCarbon(e.target.checked)}
              size="small" sx={{ color: C_CARBON, "&.Mui-checked": { color: C_CARBON } }} />
          }
          label={<Typography variant="caption" sx={{ fontWeight: 700, color: C_CARBON }}>Carbon</Typography>}
          sx={{ mr: 0 }}
        />
        <FormControlLabel
          control={
            <Checkbox checked={showIns} onChange={(e) => setShowIns(e.target.checked)}
              size="small" sx={{ color: C_INS, "&.Mui-checked": { color: C_INS } }} />
          }
          label={<Typography variant="caption" sx={{ fontWeight: 700, color: C_INS }}>Insulation</Typography>}
          sx={{ mr: 0 }}
        />

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="before" sx={{ px: 1.5, py: 0.2, fontSize: 11, fontWeight: 700 }}>
            BEFORE
          </ToggleButton>
          <ToggleButton value="after" sx={{ px: 1.5, py: 0.2, fontSize: 11, fontWeight: 700 }}>
            AFTER
          </ToggleButton>
          <ToggleButton
            value="assembly"
            disabled={!hasAssembly}
            sx={{ px: 1.5, py: 0.2, fontSize: 11, fontWeight: 700 }}
          >
            조립 추천
          </ToggleButton>
          <ToggleButton
            value="assemblyOpt"
            disabled={!hasAssemblyOpt}
            sx={{ px: 1.5, py: 0.2, fontSize: 11, fontWeight: 700 }}
          >
            조립+최적화
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* SVG 시각화 */}
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ maxWidth: 580, display: "block" }}>
        {/* 배경 */}
        <rect x="10" y="10" width={SVG_W - 20} height={SVG_H - 20} rx="12"
          fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />

        {/* 제목 */}
        <text x={CX} y="32" fontSize="13" fontWeight="700" fill="#334155" textAnchor="middle">
          {viewMode === "assemblyOpt" ? "조립 추천 + Q 최적화"
           : viewMode === "assembly" ? "조립 추천 (Assembly Rec.)"
           : viewMode === "after" ? "AFTER (보정 후)" : "BEFORE (현재)"}
        </text>

        {/* 그리드 */}
        <GridLines />

        {/* 점선 폴리곤 연결 */}
        {showCarbon && carbonData && <PolyConnect data={carbonData} color={C_CARBON} />}
        {showIns && insData && <PolyConnect data={insData} color={C_INS} />}

        {/* 각 포인트 */}
        {POINTS.map((pt) => (
          <PointGroup
            key={pt}
            pt={pt}
            anchor={ANCHORS[pt]}
            carbon={showCarbon ? carbonData?.[pt] : null}
            insulation={showIns ? insData?.[pt] : null}
          />
        ))}
      </svg>

      {/* 범례 */}
      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", justifyContent: "center" }}>
        <Chip size="small" variant="outlined"
          sx={{ borderColor: C_CARBON, color: C_CARBON, fontWeight: 700, fontSize: 11 }}
          label="○ 카본 (Carbon)" />
        <Chip size="small" variant="outlined"
          sx={{ borderColor: C_INS, color: C_INS, fontWeight: 700, fontSize: 11 }}
          label="○ 절연 (Insulation)" />
        {[
          { tag: "OK", threshold: "≤0.05mm" },
          { tag: "CHECK", threshold: "0.05~0.10" },
          { tag: "NG", threshold: ">0.12mm" },
        ].map(({ tag, threshold }) => (
          <Chip key={tag} size="small"
            sx={{ background: STATUS_STYLES[tag].bg, color: STATUS_STYLES[tag].text,
                  fontWeight: 700, fontSize: 10, height: 22 }}
            label={`${tag} ${threshold}`} />
        ))}
      </Stack>
    </Box>
  );
}

// ── 그리드 라인 ──
function GridLines() {
  const minX = ANCHORS[1].x;
  const maxX = ANCHORS[3].x;
  const minY = ANCHORS[1].y;
  const maxY = ANCHORS[2].y;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  return (
    <>
      <line x1={midX} y1={minY} x2={midX} y2={maxY} stroke="#94A3B8" strokeWidth="1" opacity="0.2" />
      <line x1={minX} y1={midY} x2={maxX} y2={midY} stroke="#94A3B8" strokeWidth="1" opacity="0.2" />
      <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY}
        fill="none" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="6 3" opacity="0.5" />
    </>
  );
}

// ── 점선 폴리곤 ──
function PolyConnect({ data, color }) {
  const pts = POLY_ORDER.map((pt) => {
    const a = ANCHORS[pt];
    const d = data[pt];
    if (!d) return `${a.x},${a.y}`;
    return `${a.x + d.x * SCALE},${a.y - d.y * SCALE}`;
  }).join(" ");

  return (
    <polyline points={pts} fill="none" stroke={color}
      strokeWidth="1.2" strokeDasharray="5 4" opacity="0.5"
      style={{ transition: "all 0.4s ease" }} />
  );
}

// ── 각 포인트 그룹 ──
function PointGroup({ pt, anchor, carbon, insulation }) {
  const a = anchor;

  // 상태 배지 (worst of both)
  let worstTag = "OK";
  const sev = { OK: 0, CHECK: 1, MUST: 2 };
  if (carbon) {
    const t = classifyPoint(carbon.x, carbon.y);
    if (sev[t] > sev[worstTag]) worstTag = t;
  }
  if (insulation) {
    const t = classifyPoint(insulation.x, insulation.y);
    if (sev[t] > sev[worstTag]) worstTag = t;
  }
  const badge = badgeStyle(worstTag);
  const label = displayLabel(worstTag);
  const bw = label === "CHECK" ? 46 : label === "NG" ? 34 : 34;

  return (
    <g>
      {/* 3중 기준 박스 + 크기 라벨 (G7) */}
      {BOX_LEVELS.map((lv) => {
        const half = lv * SCALE;
        let col, sw, dash, op;
        if (lv === 0.05) { col = "#5B8CFF"; sw = 1.5; dash = ""; op = 0.7; }
        else if (lv === 0.10) { col = "#2F6BFF"; sw = 1; dash = ""; op = 0.5; }
        else { col = "#94A3B8"; sw = 0.8; dash = "4 3"; op = 0.4; }
        return (
          <React.Fragment key={`box-${pt}-${lv}`}>
            <rect
              x={a.x - half} y={a.y - half} width={half * 2} height={half * 2}
              fill="none" stroke={col} strokeWidth={sw}
              strokeDasharray={dash || undefined} opacity={op} />
            {/* 포인트 1의 기준 박스에만 크기 라벨 표시 */}
            {pt === 1 && (
              <text
                x={a.x - half - 2}
                y={a.y - half - 3}
                fontSize="8" fill={col} textAnchor="end" opacity={0.8}>
                {lv.toFixed(2)}mm
              </text>
            )}
          </React.Fragment>
        );
      })}

      {/* 기준점 (흰색 사각형) */}
      <rect x={a.x - 4} y={a.y - 4} width="8" height="8"
        fill="white" stroke="#CBD5E1" strokeWidth="0.5" rx="1" />

      {/* 포인트 번호 — 배지보다 먼저 (G3: 렌더 순서) */}
      <text x={a.x - 30} y={a.y - 62}
        fontSize="13" fontWeight="700" fill="#64748B" textAnchor="end">{pt}</text>

      {/* 상태 배지 — 링보다 먼저 그려서 링이 위에 오도록 (G3) */}
      <rect x={a.x - 22} y={a.y - 75} width={bw} height="16" rx="4"
        fill={badge.bg} opacity="0.75" />
      <text x={a.x - 22 + bw / 2} y={a.y - 64}
        fontSize="9" fontWeight="700" fill={badge.fg} textAnchor="middle">{label}</text>

      {/* 카본 링 (CSS transition 애니메이션) — 배지 위에 렌더 */}
      {carbon && (
        <circle
          cx={a.x + carbon.x * SCALE}
          cy={a.y - carbon.y * SCALE}
          r={RING_R} fill="none" stroke={C_CARBON} strokeWidth="2" opacity="0.9"
          style={{ transition: "cx 0.4s ease, cy 0.4s ease" }}
        />
      )}

      {/* 절연 링 (CSS transition 애니메이션) — 배지 위에 렌더 */}
      {insulation && (
        <circle
          cx={a.x + insulation.x * SCALE}
          cy={a.y - insulation.y * SCALE}
          r={RING_R} fill="none" stroke={C_INS} strokeWidth="2" opacity="0.9"
          style={{ transition: "cx 0.4s ease, cy 0.4s ease" }}
        />
      )}

      {/* 편차값 텍스트 — 방향 용어 (G5) */}
      {carbon && (
        <text x={a.x} y={a.y + 68} fontSize="9" fill="#94A3B8" textAnchor="middle"
          style={{ transition: "all 0.3s ease" }}>
          C: 좌우 {fmtVal(carbon.x)}, 상하 {fmtVal(carbon.y)}
        </text>
      )}
      {insulation && (
        <text x={a.x} y={a.y + (carbon ? 80 : 68)} fontSize="9" fill="#94A3B8" textAnchor="middle"
          style={{ transition: "all 0.3s ease" }}>
          I: 좌우 {fmtVal(insulation.x)}, 상하 {fmtVal(insulation.y)}
        </text>
      )}
    </g>
  );
}
