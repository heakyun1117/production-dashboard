import React, { useMemo } from "react";
import { Box, Typography, Stack, Chip } from "@mui/material";
import { STATUS_STYLES } from "../shared/colors";

/**
 * FourPointDeviationViz — 4포인트 편차 시각화
 *
 * 참조: 프린팅위치보정.ipynb (v3.3)
 * 카본(핑크) / 절연(녹색) 4포인트 링 + 기준박스 + 상태배지
 *
 * @param {Object} printingCalc - 백엔드 printingCalc 딕셔너리
 * @param {boolean} isInterference - true면 카본기준 데이터 표시
 */

// ── 상수 ──
const POINTS = [1, 2, 3, 4];
const SCALE = 360;       // mm → SVG px 스케일
const RING_R = 7;
const BOX_LEVELS = [0.05, 0.10, 0.15];

// 상태 기준 (mm)
const T_OK = 0.05;
const T_CHECK = 0.10;
const T_MUST = 0.12;

// 색상
const C_CARBON = "#EC4899";   // 핑크
const C_INS    = "#22C55E";   // 녹색

// 직사각형 원단 비율 (기본 타발 거리 W x H)
const DEFAULT_W = 294.6;
const DEFAULT_H = 320.0;

// SVG 레이아웃
const SVG_W = 560;
const SVG_H = 620;
const CX = SVG_W / 2;
const CY = SVG_H / 2;

// 앵커 포인트 (직사각형 비율 반영)
function getAnchors(w = DEFAULT_W, h = DEFAULT_H) {
  const ratio = h / w;
  const halfX = 160;
  const halfY = halfX * ratio;
  return {
    1: { x: CX - halfX, y: CY - halfY },  // 좌상
    2: { x: CX - halfX, y: CY + halfY },  // 좌하
    3: { x: CX + halfX, y: CY - halfY },  // 우상
    4: { x: CX + halfX, y: CY + halfY },  // 우하
  };
}

const POLY_ORDER = [1, 3, 4, 2, 1];

// ── 상태 분류 ──
function classifyPoint(x, y) {
  const m = Math.max(Math.abs(x), Math.abs(y));
  if (m <= T_OK) return "OK";
  if (m > T_MUST) return "MUST";
  if (m > T_CHECK) return "CHECK";
  return "OK";
}

// ── 상태 표시 헬퍼 (MUST → NG 매핑, STATUS_STYLES 통일) ──
const displayLabel = (tag) => tag === "MUST" ? "NG" : tag;

function badgeStyle(tag) {
  const key = tag === "MUST" ? "NG" : tag;
  return {
    bg: STATUS_STYLES[key]?.bg ?? STATUS_STYLES.OK.bg,
    fg: STATUS_STYLES[key]?.text ?? STATUS_STYLES.OK.text,
  };
}

// ── 데이터 파싱 ──
function parse4PointData(printingCalc, refFilter = "타발기준") {
  const carbon = {};
  const insulation = {};

  for (const [key, val] of Object.entries(printingCalc)) {
    const match = key.match(/\('(.+?)',\s*'(.+?)',\s*'(.+?)',\s*(\d+)\)/);
    if (!match) continue;
    const [, ref, layer, axis, pt] = match;
    if (ref !== refFilter) continue;

    const target = layer === "카본" ? carbon : layer === "절연" ? insulation : null;
    if (!target) continue;

    const ptNum = parseInt(pt);
    if (!target[ptNum]) target[ptNum] = { x: 0, y: 0 };
    if (axis === "X") target[ptNum].x = val;
    if (axis === "Y") target[ptNum].y = val;
  }

  return { carbon, insulation };
}

function has4Points(d) {
  return d && POINTS.every((pt) => d[pt] && typeof d[pt].x === "number");
}

// ── 메인 컴포넌트 ──
export default function FourPointDeviationViz({ printingCalc, isInterference = false }) {
  const parsed = useMemo(() => {
    if (!printingCalc || Object.keys(printingCalc).length === 0) return null;
    const ref = isInterference ? "카본기준" : "타발기준";
    return parse4PointData(printingCalc, ref);
  }, [printingCalc, isInterference]);

  if (!parsed) return <EmptyMsg />;

  const hasCarbon = !isInterference && has4Points(parsed.carbon);
  const hasIns = has4Points(parsed.insulation);

  if (!hasCarbon && !hasIns) return <EmptyMsg />;

  const ANCHORS = getAnchors();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ maxWidth: 560, display: "block" }}
      >
        {/* 배경 */}
        <rect x="10" y="10" width={SVG_W - 20} height={SVG_H - 20} rx="12"
          fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />

        {/* 제목 */}
        <text x={CX} y="32" fontSize="13" fontWeight="700" fill="#334155" textAnchor="middle">
          {isInterference ? "간섭 (카본기준 절연 편차)" : "카본 / 절연 (타발기준)"}
        </text>

        {/* 그리드 */}
        <GridLines anchors={ANCHORS} />

        {/* 점선 폴리곤 연결 */}
        {hasCarbon && <PolyConnect data={parsed.carbon} anchors={ANCHORS} color={C_CARBON} />}
        {hasIns && <PolyConnect data={parsed.insulation} anchors={ANCHORS} color={C_INS} />}

        {/* 각 포인트 */}
        {POINTS.map((pt) => (
          <PointGroup
            key={pt}
            pt={pt}
            anchor={ANCHORS[pt]}
            carbon={hasCarbon ? parsed.carbon[pt] : null}
            insulation={hasIns ? parsed.insulation[pt] : null}
            isInterference={isInterference}
          />
        ))}
      </svg>

      {/* 범례 */}
      <Stack direction="row" spacing={1.5} sx={{ mt: 1, flexWrap: "wrap", justifyContent: "center" }}>
        {!isInterference && (
          <Chip size="small" variant="outlined"
            sx={{ borderColor: C_CARBON, color: C_CARBON, fontWeight: 700, fontSize: 11 }}
            label="○ 카본 (Carbon)" />
        )}
        <Chip size="small" variant="outlined"
          sx={{ borderColor: C_INS, color: C_INS, fontWeight: 700, fontSize: 11 }}
          label={isInterference ? "○ 절연 편차 (I-C)" : "○ 절연 (Insulation)"} />
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
function GridLines({ anchors }) {
  const a = anchors;
  const minX = a[1].x;
  const maxX = a[3].x;
  const minY = a[1].y;
  const maxY = a[2].y;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const lines = [];
  // 수직/수평 중앙선
  lines.push(
    <line key="cx" x1={midX} y1={minY} x2={midX} y2={maxY}
      stroke="#94A3B8" strokeWidth="1" opacity="0.2" />
  );
  lines.push(
    <line key="cy" x1={minX} y1={midY} x2={maxX} y2={midY}
      stroke="#94A3B8" strokeWidth="1" opacity="0.2" />
  );
  // 외곽 점선
  lines.push(
    <rect key="outline" x={minX} y={minY} width={maxX - minX} height={maxY - minY}
      fill="none" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="6 3" opacity="0.5" />
  );
  return <>{lines}</>;
}

// ── 점선 폴리곤 ──
function PolyConnect({ data, anchors, color }) {
  const pts = POLY_ORDER.map((pt) => {
    const a = anchors[pt];
    const d = data[pt];
    return `${a.x + d.x * SCALE},${a.y - d.y * SCALE}`;
  }).join(" ");

  return (
    <polyline points={pts} fill="none" stroke={color}
      strokeWidth="1" strokeDasharray="5 4" opacity="0.5" />
  );
}

// ── 각 포인트 그룹 ──
function PointGroup({ pt, anchor, carbon, insulation, isInterference }) {
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
      {/* 3중 기준 박스 + 크기 라벨 */}
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

      {/* 포인트 번호 — 배지보다 먼저 */}
      <text x={a.x - 30} y={a.y - 62}
        fontSize="13" fontWeight="700" fill="#64748B" textAnchor="end">{pt}</text>

      {/* 상태 배지 — 링보다 먼저 그려서 링이 위에 오도록 */}
      <rect x={a.x - 22} y={a.y - 75} width={bw} height="16" rx="4"
        fill={badge.bg} opacity="0.75" />
      <text x={a.x - 22 + bw / 2} y={a.y - 64}
        fontSize="9" fontWeight="700" fill={badge.fg} textAnchor="middle">{label}</text>

      {/* 카본 링 — 배지 위에 렌더 */}
      {carbon && (
        <circle cx={a.x + carbon.x * SCALE} cy={a.y - carbon.y * SCALE}
          r={RING_R} fill="none" stroke={C_CARBON} strokeWidth="2" opacity="0.9" />
      )}

      {/* 절연 링 — 배지 위에 렌더 */}
      {insulation && (
        <circle cx={a.x + insulation.x * SCALE} cy={a.y - insulation.y * SCALE}
          r={RING_R} fill="none" stroke={C_INS} strokeWidth="2" opacity="0.9" />
      )}

      {/* 편차값 텍스트 — 방향 용어 (좌우/상하) */}
      {carbon && (
        <text x={a.x} y={a.y + 68} fontSize="9" fill="#94A3B8" textAnchor="middle">
          C: 좌우 {fmtVal(carbon.x)}, 상하 {fmtVal(carbon.y)}
        </text>
      )}
      {insulation && (
        <text x={a.x} y={a.y + (carbon ? 80 : 68)} fontSize="9" fill="#94A3B8" textAnchor="middle">
          {isInterference ? "I-C" : "I"}: 좌우 {fmtVal(insulation.x)}, 상하 {fmtVal(insulation.y)}
        </text>
      )}
    </g>
  );
}

function fmtVal(v) {
  return (v >= 0 ? "+" : "") + v.toFixed(3);
}

function EmptyMsg() {
  return (
    <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>
      시각화할 데이터가 없습니다
    </Typography>
  );
}
