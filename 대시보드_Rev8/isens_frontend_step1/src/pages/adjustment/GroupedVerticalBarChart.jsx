import React, { useMemo, useState, useCallback } from "react";
import { ResponsiveBar } from "@nivo/bar";
import { Box, Chip, Stack, Typography } from "@mui/material";
import {
  CI_PRIMARY,
  CI_GREEN,
  COLOR_NG,
  COLOR_CHECK,
} from "../../components/shared/colors";
import useThresholdStore from "../../store/useThresholdStore";

/* position colors */
const POS_COLORS = { L: "#3B82F6", C: "#8B5CF6", R: "#06B6D4" };

const POS_COLORS_BEFORE = {
  L: "rgba(59,130,246,0.28)",
  C: "rgba(139,92,246,0.28)",
  R: "rgba(6,182,212,0.28)",
};

/* after color based on value + position */
function getAfterColor(val, pos, ngLimit, check) {
  if (val >= ngLimit) return COLOR_NG;
  if (val >= check) return COLOR_CHECK;
  return POS_COLORS[pos] ?? CI_PRIMARY;
}

/* CHECK/NG reference lines layer (factory — receives thresholds via closure) */
function makeReferenceLinesLayer(check, ngLimit) {
  return ({ yScale, innerWidth }) => (
    <g>
      <line
        x1={0} x2={innerWidth}
        y1={yScale(check)} y2={yScale(check)}
        stroke={COLOR_CHECK} strokeWidth={1} strokeDasharray="4 3"
      />
      <text
        x={innerWidth - 2} y={yScale(check) - 4}
        textAnchor="end" fill={COLOR_CHECK} fontSize={9} fontWeight={700}
      >
        CHECK
      </text>
      <line
        x1={0} x2={innerWidth}
        y1={yScale(ngLimit)} y2={yScale(ngLimit)}
        stroke={COLOR_NG} strokeWidth={1.5}
      />
      <text
        x={innerWidth - 2} y={yScale(ngLimit) - 4}
        textAnchor="end" fill={COLOR_NG} fontSize={9} fontWeight={700}
      >
        NG
      </text>
    </g>
  );
}

/**
 * GroupedVerticalBarChart — L/C/R 그룹 세로 막대 (이전 버전)
 *
 * Before: native nivo bars (wide, semi-transparent)
 * After: custom SVG layer (narrow, opaque, overlaid on top)
 */
export default function GroupedVerticalBarChart({ perRow, axis = "y" }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK = storeT.check;
  const NG_LIMIT = storeT.ng;

  const ReferenceLinesLayer = useMemo(
    () => makeReferenceLinesLayer(CHECK, NG_LIMIT),
    [CHECK, NG_LIMIT]
  );

  const isX = axis === "x";
  const title = isX ? "X(좌우) L/R 상세" : "Y(상하) L/C/R 상세";

  /* native keys (Before only) */
  const posKeys = isX ? ["L", "R"] : ["L", "C", "R"];

  /* legend toggle state */
  const [hiddenPos, setHiddenPos] = useState(new Set());
  const [showBefore, setShowBefore] = useState(true);
  const [showAfter, setShowAfter] = useState(true);

  const togglePos = useCallback((p) => {
    setHiddenPos((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const visibleKeys = posKeys.filter((k) => !hiddenPos.has(k));

  /* data: Before values as native keys + After as aL/aC/aR fields */
  const data = useMemo(() => {
    if (!perRow || perRow.length === 0) return [];
    return perRow.map((r) => {
      if (isX) {
        return {
          row: `R${r.row}`,
          L: r.before_xL ?? 0,
          R: r.before_xR ?? 0,
          aL: r.after_xL ?? 0,
          aR: r.after_xR ?? 0,
        };
      }
      return {
        row: `R${r.row}`,
        L: r.before_yL ?? 0,
        C: r.before_yC ?? 0,
        R: r.before_yR ?? 0,
        aL: r.after_yL ?? 0,
        aC: r.after_yC ?? 0,
        aR: r.after_yR ?? 0,
      };
    });
  }, [perRow, isX]);

  /* After overlay layer */
  const AfterOverlayLayer = useCallback(
    ({ bars, yScale }) => {
      if (!showAfter) return null;
      return (
        <g>
          {bars.map((bar) => {
            const pos = bar.data.id; // "L", "C", "R"
            if (hiddenPos.has(pos)) return null;
            const afterKey = "a" + pos;
            const afterVal = bar.data.data[afterKey];
            if (afterVal == null || afterVal <= 0) return null;

            const narrowFactor = 0.55;
            const nw = bar.width * narrowFactor;
            const xOff = (bar.width - nw) / 2;
            const barY = yScale(afterVal);
            const barH = yScale(0) - barY;

            return (
              <rect
                key={`af-${bar.key}`}
                x={bar.x + xOff}
                y={barY}
                width={nw}
                height={Math.max(0, barH)}
                fill={getAfterColor(afterVal, pos, NG_LIMIT, CHECK)}
                rx={2}
                style={{ transition: "all 0.35s ease" }}
              />
            );
          })}
        </g>
      );
    },
    [showAfter, hiddenPos]
  );

  if (data.length === 0) return null;

  /* before bar color */
  const getBarColor = (bar) => {
    const pos = bar.id;
    return showBefore
      ? (POS_COLORS_BEFORE[pos] ?? "rgba(0,0,0,0.10)")
      : "rgba(0,0,0,0)"; /* fully transparent when hidden */
  };

  /* legend chip builder */
  const chipSx = (active, color) => ({
    height: 18,
    fontSize: 9,
    fontWeight: 700,
    cursor: "pointer",
    bgcolor: active ? color : "transparent",
    color: active ? "#fff" : "#bbb",
    border: active ? "none" : "1px solid #ddd",
    textDecoration: active ? "none" : "line-through",
    opacity: active ? 1 : 0.5,
    "& .MuiChip-label": { px: 0.5 },
  });

  return (
    <Box>
      {/* title + legend */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1, mb: 0.5 }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={0.3} flexWrap="wrap">
          <Chip
            label="Before"
            size="small"
            onClick={() => setShowBefore((v) => !v)}
            sx={chipSx(showBefore, "rgba(120,120,120,0.45)")}
          />
          <Chip
            label="After"
            size="small"
            onClick={() => setShowAfter((v) => !v)}
            sx={chipSx(showAfter, CI_PRIMARY)}
          />
          {posKeys.map((p) => (
            <Chip
              key={p}
              label={p}
              size="small"
              onClick={() => togglePos(p)}
              sx={chipSx(!hiddenPos.has(p), POS_COLORS[p])}
            />
          ))}
        </Stack>
      </Stack>

      <Box sx={{ height: 250 }}>
        <ResponsiveBar
          data={data}
          keys={showBefore ? visibleKeys : []}
          indexBy="row"
          groupMode="grouped"
          maxValue={0.20}
          margin={{ top: 5, right: 10, bottom: 30, left: 40 }}
          padding={0.15}
          innerPadding={0}
          valueScale={{ type: "linear" }}
          indexScale={{ type: "band", round: true }}
          colors={getBarColor}
          borderRadius={2}
          borderWidth={0}
          animate={true}
          motionConfig="gentle"
          enableLabel={false}
          enableGridY={true}
          gridYValues={[0, 0.05, 0.10, 0.15, 0.20]}
          axisLeft={{
            tickSize: 3,
            tickValues: [0, 0.05, 0.10, 0.15, 0.20],
            format: (v) => v.toFixed(2),
          }}
          axisBottom={{ tickSize: 3 }}
          layers={[
            "grid",
            "axes",
            ReferenceLinesLayer,
            "bars",
            AfterOverlayLayer,
            "markers",
            "legends",
          ]}
          tooltip={({ id, value, indexValue, data: d }) => {
            const afterVal = d["a" + id];
            const afterStatus =
              afterVal >= NG_LIMIT ? "NG" : afterVal >= CHECK ? "CHECK" : "OK";
            return (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <strong>{indexValue}</strong> &mdash; {id}
                <div style={{ color: POS_COLORS_BEFORE[id]?.replace("0.28", "0.8") ?? "#999" }}>
                  Before: {value.toFixed(3)} mm
                </div>
                <div
                  style={{
                    color: getAfterColor(afterVal ?? 0, id, NG_LIMIT, CHECK),
                    fontWeight: 700,
                  }}
                >
                  After: {(afterVal ?? 0).toFixed(3)} mm ({afterStatus})
                </div>
              </div>
            );
          }}
          theme={{
            text: { fontSize: 10, fontWeight: 600 },
            grid: {
              line: { stroke: "rgba(0,0,0,0.06)", strokeWidth: 1 },
            },
            axis: {
              ticks: { text: { fontSize: 10 } },
            },
          }}
        />
      </Box>
    </Box>
  );
}
