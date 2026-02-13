import React, { useMemo, useState } from "react";
import { ResponsiveRadar } from "@nivo/radar";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { CI_PRIMARY, CI_GREEN, COLOR_NG, COLOR_CHECK } from "../../components/shared/colors";
import useThresholdStore from "../../store/useThresholdStore";

function makeTargetCirclesLayer(checkVal, ngVal) {
  return ({ radiusScale, centerX, centerY }) => (
    <g>
      <circle cx={centerX} cy={centerY} r={radiusScale(checkVal)}
        fill="none" stroke={COLOR_CHECK} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} />
      <circle cx={centerX} cy={centerY} r={radiusScale(ngVal)}
        fill="none" stroke={COLOR_NG} strokeWidth={1.5} strokeDasharray="4 2" opacity={0.5} />
    </g>
  );
}

export default function NivoRadarChart({ perRow, axis = "y", modeLabel }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK_VAL = storeT.check;
  const NG_VAL = storeT.ng;
  const MAX_VALUE = storeT.scale;

  const TargetCirclesLayer = useMemo(
    () => makeTargetCirclesLayer(CHECK_VAL, NG_VAL), [CHECK_VAL, NG_VAL]
  );

  const isX = axis === "x";
  const title = isX ? "X(좌우) 절대값 패턴" : "Y(상하) 절대값 패턴";

  const allKeys = ["Before", "After"];
  const [hiddenKeys, setHiddenKeys] = useState(new Set());
  const visibleKeys = allKeys.filter((k) => !hiddenKeys.has(k));
  const toggleKey = (key) => {
    setHiddenKeys((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const data = useMemo(() => {
    if (!perRow || perRow.length === 0) return [];
    return perRow.map((r) => ({
      row: `R${r.row}`,
      Before: isX ? (r.beforeX ?? 0) : (r.beforeY ?? 0),
      After: isX ? (r.afterX ?? 0) : (r.afterY ?? 0),
    }));
  }, [perRow, isX]);

  if (data.length === 0) return null;

  const worstAfter = Math.max(...data.map((d) => d.After));
  const afterColor = worstAfter >= NG_VAL ? COLOR_NG : worstAfter >= CHECK_VAL ? COLOR_CHECK : CI_GREEN;
  const colors = visibleKeys.map((k) => k === "Before" ? "rgba(23,28,143,0.25)" : afterColor);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pl: 1, pr: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>{title}</Typography>
        <Stack direction="row" spacing={0.3}>
          {allKeys.map((k) => {
            const hidden = hiddenKeys.has(k);
            const c = k === "Before" ? CI_PRIMARY : afterColor;
            return (
              <Chip key={k} label={k} size="small" onClick={() => toggleKey(k)}
                sx={{
                  height: 18, fontSize: 9, fontWeight: 700, cursor: "pointer",
                  bgcolor: hidden ? "transparent" : c, color: hidden ? "#bbb" : "#fff",
                  border: hidden ? "1px solid #ddd" : "none",
                  textDecoration: hidden ? "line-through" : "none",
                  opacity: hidden ? 0.5 : (k === "Before" ? 0.6 : 1),
                  "& .MuiChip-label": { px: 0.5 },
                }} />
            );
          })}
        </Stack>
      </Stack>
      {modeLabel && (
        <Typography variant="caption" sx={{ pl: 1, fontSize: 9, color: CI_PRIMARY, fontWeight: 600 }}>{modeLabel}</Typography>
      )}
      <Box sx={{ height: 260 }}>
        <ResponsiveRadar
          data={data} keys={visibleKeys} indexBy="row" maxValue={MAX_VALUE}
          margin={{ top: 20, right: 50, bottom: 20, left: 50 }}
          curve="linearClosed" borderWidth={2} borderColor={{ from: "color" }}
          gridLevels={4} gridShape="circular" gridLabelOffset={16}
          dotSize={6} dotColor={{ theme: "background" }} dotBorderWidth={2}
          dotBorderColor={{ from: "color" }} colors={colors} fillOpacity={0.15}
          blendMode="normal" animate={true} motionConfig="gentle"
          isInteractive={true}
          layers={["grid", TargetCirclesLayer, "layers", "slices", "dots"]}
          sliceTooltip={({ index, data: sliceData }) => (
            <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
              padding: "6px 10px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <strong>{index}</strong>
              {sliceData.map((d) => (
                <div key={d.id} style={{ color: d.color, marginTop: 2 }}>{d.id}: {d.value.toFixed(3)} mm</div>
              ))}
            </div>
          )}
          theme={{ text: { fontSize: 11, fontWeight: 600 }, grid: { line: { stroke: "rgba(0,0,0,0.08)" } } }}
        />
      </Box>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 0.3 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box sx={{ width: 16, height: 0, borderTop: "2px dashed", borderColor: COLOR_CHECK }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: COLOR_CHECK, fontWeight: 600 }}>{CHECK_VAL.toFixed(2)}mm CHECK</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box sx={{ width: 16, height: 0, borderTop: "2px dashed", borderColor: COLOR_NG }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: COLOR_NG, fontWeight: 600 }}>{NG_VAL.toFixed(2)}mm NG</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
